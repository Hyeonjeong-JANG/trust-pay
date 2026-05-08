import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { XrplService } from '../xrpl/xrpl.service';
import { CryptoService } from '../common/crypto.service';
import { Wallet } from 'xrpl';
import { CreateEscrowDto } from './dto/create-escrow.dto';
import type { SessionUser } from '../common/session-token';

function safeWalletFromSeed(secret: string): Wallet {
  try {
    return Wallet.fromSeed(secret);
  } catch {
    // Dummy/demo seed — generate a throwaway wallet for mock XRPL calls
    return Wallet.generate();
  }
}

@Injectable()
export class EscrowService {
  private readonly logger = new Logger(EscrowService.name);

  constructor(
    private prisma: PrismaService,
    private xrplService: XrplService,
    private configService: ConfigService,
    private crypto: CryptoService,
  ) {}

  async create(dto: CreateEscrowDto, user: SessionUser) {
    if (user.role !== 'consumer' || user.userId !== dto.consumerId) {
      throw new ForbiddenException('본인 소비자 계정으로만 에스크로를 생성할 수 있습니다');
    }

    const consumer = await this.prisma.consumer.findUnique({
      where: { id: dto.consumerId },
    });
    if (!consumer) throw new NotFoundException('Consumer not found');

    const business = await this.prisma.business.findUnique({
      where: { id: dto.businessId },
    });
    if (!business) throw new NotFoundException('Business not found');

    const monthlyAmount = dto.totalAmount / dto.months;
    const issuer = this.configService.get<string>('rlusd.issuer')!;

    // Reconstruct sender wallet from encrypted secret
    const senderWallet = safeWalletFromSeed(this.crypto.decrypt(consumer.xrplSecret));

    const escrowResults = await this.xrplService.createMonthlyEscrows(
      senderWallet,
      business.xrplAddress,
      String(monthlyAmount),
      dto.months,
    );

    const escrow = await this.prisma.escrow.create({
      data: {
        consumerId: consumer.id,
        businessId: business.id,
        consumerAddress: consumer.xrplAddress,
        businessAddress: business.xrplAddress,
        totalAmount: dto.totalAmount,
        monthlyAmount,
        months: dto.months,
        issuer,
        entries: {
          create: escrowResults.map((r) => ({
            month: r.month,
            sequence: r.sequence,
            amount: r.amount,
            finishAfter: r.finishAfter,
            cancelAfter: r.cancelAfter,
            txHash: r.txHash,
          })),
        },
      },
      include: { entries: true },
    });

    this.logger.log(`Created escrow ${escrow.id} with ${escrow.entries.length} entries`);
    return escrow;
  }

  async findById(id: string, user: SessionUser) {
    const escrow = await this.prisma.escrow.findUnique({
      where: { id },
      include: { entries: true, business: true, consumer: true },
    });
    if (!escrow) throw new NotFoundException('Escrow not found');
    this.assertEscrowAccess(escrow, user);
    return this.stripSecrets(escrow);
  }

  async finishEntry(escrowId: string, entryMonth: number, user: SessionUser) {
    const escrow = await this.prisma.escrow.findUnique({
      where: { id: escrowId },
      include: { entries: true },
    });
    if (!escrow) throw new NotFoundException('Escrow not found');
    if (user.role !== 'business' || user.userId !== escrow.businessId) {
      throw new ForbiddenException('해당 사업자만 에스크로를 정산할 수 있습니다');
    }

    const entry = escrow.entries.find((e) => e.month === entryMonth);
    if (!entry) throw new NotFoundException('Entry not found');
    if (entry.status !== 'pending') {
      throw new BadRequestException(`Entry already ${entry.status}`);
    }

    // Use business wallet for finish (business claims payment)
    const business = await this.prisma.business.findUnique({
      where: { id: escrow.businessId },
    });
    const wallet = safeWalletFromSeed(this.crypto.decrypt(business!.xrplSecret));

    const txHash = await this.xrplService.finishEscrow(
      wallet,
      escrow.consumerAddress,
      entry.sequence,
    );

    await this.prisma.escrowEntry.update({
      where: { id: entry.id },
      data: { status: 'released', txHash },
    });

    const allReleased = escrow.entries.every(
      (e) => e.id === entry.id || e.status === 'released',
    );
    if (allReleased) {
      await this.prisma.escrow.update({
        where: { id: escrowId },
        data: { status: 'completed' },
      });
    }

    this.logger.log(`Finished escrow entry month ${entryMonth} for ${escrowId}`);
    return { txHash };
  }

  async cancelEscrow(escrowId: string, user: SessionUser) {
    const escrow = await this.prisma.escrow.findUnique({
      where: { id: escrowId },
      include: { entries: true },
    });
    if (!escrow) throw new NotFoundException('Escrow not found');
    if (user.role !== 'consumer' || user.userId !== escrow.consumerId) {
      throw new ForbiddenException('해당 소비자만 에스크로를 취소할 수 있습니다');
    }

    // Use consumer wallet for cancel (consumer reclaims funds)
    const consumer = await this.prisma.consumer.findUnique({
      where: { id: escrow.consumerId },
    });
    const wallet = safeWalletFromSeed(this.crypto.decrypt(consumer!.xrplSecret));

    const pendingEntries = escrow.entries.filter((e) => e.status === 'pending');

    for (const entry of pendingEntries) {
      try {
        const txHash = await this.xrplService.cancelEscrow(
          wallet,
          escrow.consumerAddress,
          entry.sequence,
        );
        await this.prisma.escrowEntry.update({
          where: { id: entry.id },
          data: { status: 'refunded', txHash },
        });
      } catch (err) {
        this.logger.warn(`Failed to cancel entry ${entry.month}: ${err}`);
      }
    }

    await this.prisma.escrow.update({
      where: { id: escrowId },
      data: { status: 'cancelled' },
    });

    this.logger.log(`Cancelled escrow ${escrowId}`);
    return { cancelled: pendingEntries.length };
  }

  async findByConsumer(consumerId: string, user: SessionUser) {
    if (user.role !== 'consumer' || user.userId !== consumerId) {
      throw new ForbiddenException('본인 에스크로 목록만 조회할 수 있습니다');
    }

    const escrows = await this.prisma.escrow.findMany({
      where: { consumerId },
      include: { entries: true, business: true },
    });
    return escrows.map((e) => this.stripSecrets(e));
  }

  private assertEscrowAccess(escrow: { consumerId: string; businessId: string }, user: SessionUser) {
    const isConsumerOwner = user.role === 'consumer' && user.userId === escrow.consumerId;
    const isBusinessOwner = user.role === 'business' && user.userId === escrow.businessId;
    if (!isConsumerOwner && !isBusinessOwner) {
      throw new ForbiddenException('해당 에스크로에 접근할 수 없습니다');
    }
  }

  private stripSecrets(escrow: any) {
    if (escrow.business) {
      const { xrplSecret: _, ...business } = escrow.business;
      escrow = { ...escrow, business };
    }
    if (escrow.consumer) {
      const { xrplSecret: _, ...consumer } = escrow.consumer;
      escrow = { ...escrow, consumer };
    }
    return escrow;
  }
}

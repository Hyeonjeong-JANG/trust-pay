import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { XrplService } from '../xrpl/xrpl.service';
import { Wallet } from 'xrpl';
import { CreateEscrowDto } from './dto/create-escrow.dto';

@Injectable()
export class EscrowService {
  private readonly logger = new Logger(EscrowService.name);

  constructor(
    private prisma: PrismaService,
    private xrplService: XrplService,
  ) {}

  async create(dto: CreateEscrowDto) {
    const consumer = await this.prisma.consumer.findUnique({
      where: { xrplAddress: dto.consumerAddress },
    });
    if (!consumer) throw new NotFoundException('Consumer not found');

    const business = await this.prisma.business.findUnique({
      where: { xrplAddress: dto.businessAddress },
    });
    if (!business) throw new NotFoundException('Business not found');

    const monthlyAmount = dto.totalAmount / dto.months;

    // For prototype: use test wallet (in production, consumer signs client-side)
    const senderWallet = await this.xrplService.fundTestWallet();

    const escrowResults = await this.xrplService.createMonthlyEscrows(
      senderWallet,
      dto.businessAddress,
      String(monthlyAmount),
      dto.months,
    );

    const escrow = await this.prisma.escrow.create({
      data: {
        consumerId: consumer.id,
        businessId: business.id,
        consumerAddress: dto.consumerAddress,
        businessAddress: dto.businessAddress,
        totalAmount: dto.totalAmount,
        monthlyAmount,
        months: dto.months,
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

  async findById(id: string) {
    const escrow = await this.prisma.escrow.findUnique({
      where: { id },
      include: { entries: true, business: true, consumer: true },
    });
    if (!escrow) throw new NotFoundException('Escrow not found');
    return escrow;
  }

  async finishEntry(escrowId: string, entryMonth: number) {
    const escrow = await this.prisma.escrow.findUnique({
      where: { id: escrowId },
      include: { entries: true },
    });
    if (!escrow) throw new NotFoundException('Escrow not found');

    const entry = escrow.entries.find((e) => e.month === entryMonth);
    if (!entry) throw new NotFoundException('Entry not found');
    if (entry.status !== 'pending') {
      throw new BadRequestException(`Entry already ${entry.status}`);
    }

    // For prototype: use test wallet
    const wallet = await this.xrplService.fundTestWallet();

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

  async cancelEscrow(escrowId: string) {
    const escrow = await this.prisma.escrow.findUnique({
      where: { id: escrowId },
      include: { entries: true },
    });
    if (!escrow) throw new NotFoundException('Escrow not found');

    const wallet = await this.xrplService.fundTestWallet();
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

  async findByConsumer(consumerAddress: string) {
    return this.prisma.escrow.findMany({
      where: { consumerAddress },
      include: { entries: true, business: true },
    });
  }
}

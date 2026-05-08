import { Injectable, NotFoundException, Logger, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { XrplService } from '../xrpl/xrpl.service';
import { CryptoService } from '../common/crypto.service';
import type { SessionUser } from '../common/session-token';

@Injectable()
export class ConsumerService {
  private readonly logger = new Logger(ConsumerService.name);

  constructor(
    private prisma: PrismaService,
    private xrplService: XrplService,
    private crypto: CryptoService,
  ) {}

  async register(data: { name: string; phone?: string; email?: string }) {
    const { wallet, address: xrplAddress, secret: xrplSecret } =
      await this.xrplService.createWallet();
    await this.xrplService.setTrustLine(wallet);

    const consumer = await this.prisma.consumer.create({
      data: {
        name: data.name,
        phone: data.phone,
        email: data.email,
        xrplAddress,
        xrplSecret: this.crypto.encrypt(xrplSecret),
      },
    });

    this.logger.log(`소비자 등록: ${consumer.id} (${xrplAddress})`);

    const { xrplSecret: _, ...result } = consumer;
    return result;
  }

  async findById(id: string, user: SessionUser) {
    this.assertConsumerOwner(id, user);
    const consumer = await this.prisma.consumer.findUnique({ where: { id } });
    if (!consumer) throw new NotFoundException('Consumer not found');
    const { xrplSecret: _, ...result } = consumer;
    return result;
  }

  async getBalance(id: string, user: SessionUser) {
    this.assertConsumerOwner(id, user);
    const consumer = await this.prisma.consumer.findUnique({ where: { id } });
    if (!consumer) throw new NotFoundException('Consumer not found');
    const balance = await this.xrplService.getBalance(consumer.xrplAddress);
    return { xrplAddress: consumer.xrplAddress, balance };
  }

  async findAll(_user: SessionUser) {
    throw new ForbiddenException('소비자 목록 조회는 관리자 권한이 필요합니다');
  }

  private assertConsumerOwner(id: string, user: SessionUser) {
    if (user.role !== 'consumer' || user.userId !== id) {
      throw new ForbiddenException('본인 소비자 계정으로만 접근할 수 있습니다');
    }
  }
}

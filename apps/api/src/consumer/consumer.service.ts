import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { XrplService } from '../xrpl/xrpl.service';
import { CryptoService } from '../common/crypto.service';

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

  async findById(id: string) {
    const consumer = await this.prisma.consumer.findUnique({ where: { id } });
    if (!consumer) throw new NotFoundException('Consumer not found');
    const { xrplSecret: _, ...result } = consumer;
    return result;
  }

  async getBalance(id: string) {
    const consumer = await this.prisma.consumer.findUnique({ where: { id } });
    if (!consumer) throw new NotFoundException('Consumer not found');
    const balance = await this.xrplService.getBalance(consumer.xrplAddress);
    return { xrplAddress: consumer.xrplAddress, balance };
  }

  async findAll() {
    const consumers = await this.prisma.consumer.findMany();
    return consumers.map(({ xrplSecret: _, ...c }) => c);
  }
}

import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { XrplService } from '../xrpl/xrpl.service';

@Injectable()
export class BusinessService {
  private readonly logger = new Logger(BusinessService.name);

  constructor(
    private prisma: PrismaService,
    private xrplService: XrplService,
  ) {}

  async register(data: { name: string; category: string; address: string; phone?: string; email?: string }) {
    // Auto-create XRPL wallet + Trust Line
    const { wallet, address: xrplAddress, secret: xrplSecret } = await this.xrplService.createWallet();
    await this.xrplService.setTrustLine(wallet);

    const business = await this.prisma.business.create({
      data: {
        name: data.name,
        category: data.category,
        address: data.address,
        phone: data.phone,
        email: data.email,
        xrplAddress,
        xrplSecret,
      },
    });

    this.logger.log(`Registered business ${business.id} with XRPL address ${xrplAddress}`);

    // Return without xrplSecret
    const { xrplSecret: _, ...result } = business;
    return result;
  }

  async findById(id: string) {
    const business = await this.prisma.business.findUnique({ where: { id } });
    if (!business) throw new NotFoundException('Business not found');
    const { xrplSecret: _, ...result } = business;
    return result;
  }

  async dashboard(id: string) {
    const business = await this.prisma.business.findUnique({
      where: { id },
      include: {
        escrows: {
          include: { entries: true, consumer: true },
        },
      },
    });
    if (!business) throw new NotFoundException('Business not found');

    const totalReceived = business.escrows.reduce((sum, e) => {
      const released = e.entries.filter((en) => en.status === 'released');
      return sum + released.length * e.monthlyAmount;
    }, 0);

    const totalPending = business.escrows.reduce((sum, e) => {
      const pending = e.entries.filter((en) => en.status === 'pending');
      return sum + pending.length * e.monthlyAmount;
    }, 0);

    return {
      business: { id: business.id, name: business.name },
      totalReceived,
      totalPending,
      activeEscrows: business.escrows.filter((e) => e.status === 'active').length,
      escrows: business.escrows,
    };
  }

  async findAll() {
    const businesses = await this.prisma.business.findMany({ where: { isActive: true } });
    return businesses.map(({ xrplSecret: _, ...b }) => b);
  }
}

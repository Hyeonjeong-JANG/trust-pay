import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BusinessService {
  constructor(private prisma: PrismaService) {}

  async register(data: { name: string; category: string; address: string; xrplAddress: string }) {
    return this.prisma.business.create({ data });
  }

  async findById(id: string) {
    const business = await this.prisma.business.findUnique({ where: { id } });
    if (!business) throw new NotFoundException('Business not found');
    return business;
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
    return this.prisma.business.findMany({ where: { isActive: true } });
  }
}

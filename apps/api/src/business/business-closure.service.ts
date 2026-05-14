import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { BusinessClosureStatus } from '@prepaid-shield/shared-types';

type BusinessClosureCheckResult = {
  status: BusinessClosureStatus;
  source: 'nts' | 'internal';
  checkedAt: Date;
  raw?: string;
};

@Injectable()
export class BusinessClosureService {
  private readonly logger = new Logger(BusinessClosureService.name);

  constructor(private configService: ConfigService) {}

  async checkBusinessStatus(registrationNumber?: string | null): Promise<BusinessClosureCheckResult> {
    const checkedAt = new Date();
    const businessNumber = registrationNumber?.replace(/\D/g, '');
    if (!businessNumber) {
      return { status: 'not_configured', source: 'internal', checkedAt };
    }

    const serviceKey = this.configService.get<string>('nts.serviceKey');
    const statusUrl = this.configService.get<string>('nts.statusUrl');
    if (!serviceKey || !statusUrl) {
      return { status: 'unavailable', source: 'internal', checkedAt };
    }

    try {
      const response = await fetch(`${statusUrl}?serviceKey=${encodeURIComponent(serviceKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ b_no: [businessNumber] }),
      });

      if (!response.ok) {
        this.logger.warn(`NTS business status check failed with HTTP ${response.status}`);
        return { status: 'unavailable', source: 'nts', checkedAt };
      }

      const body: any = await response.json();
      const item = Array.isArray(body?.data) ? body.data[0] : undefined;
      return {
        status: this.mapNtsStatus(item?.b_stt_cd, item?.b_stt),
        source: 'nts',
        checkedAt,
        raw: JSON.stringify(item ?? body).slice(0, 2000),
      };
    } catch (err) {
      this.logger.warn(`NTS business status check unavailable: ${err}`);
      return { status: 'unavailable', source: 'nts', checkedAt };
    }
  }

  private mapNtsStatus(statusCode?: string, statusText?: string): BusinessClosureStatus {
    if (statusCode === '01' || statusText?.includes('계속')) return 'active';
    if (statusCode === '02' || statusText?.includes('휴업')) return 'suspended';
    if (statusCode === '03' || statusText?.includes('폐업')) return 'closed';
    return 'unavailable';
  }
}

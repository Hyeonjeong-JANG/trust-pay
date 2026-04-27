import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client, Wallet } from 'xrpl';
import { XrplEscrowClient, EscrowResult, CreateWalletResult } from '@prepaid-shield/xrpl-client';

@Injectable()
export class XrplService implements OnModuleDestroy {
  private client: Client | null = null;
  private readonly escrowClient = new XrplEscrowClient();
  private readonly logger = new Logger(XrplService.name);

  constructor(private configService: ConfigService) {}

  async getClient(): Promise<Client> {
    if (!this.client || !this.client.isConnected()) {
      const url = this.configService.get<string>('xrpl.url');
      this.client = new Client(url!);
      await this.client.connect();
      this.logger.log('Connected to XRPL');
    }
    return this.client;
  }

  async createWallet(): Promise<CreateWalletResult> {
    const client = await this.getClient();
    return this.escrowClient.createWallet(client);
  }

  async setTrustLine(wallet: Wallet): Promise<string> {
    const client = await this.getClient();
    const currency = this.configService.get<string>('rlusd.currency')!;
    const issuer = this.configService.get<string>('rlusd.issuer')!;

    return this.escrowClient.setTrustLine({
      client,
      wallet,
      currency,
      issuer,
      limit: '1000000',
    });
  }

  async createMonthlyEscrows(
    senderWallet: Wallet,
    destinationAddress: string,
    monthlyAmount: string,
    months: number,
  ): Promise<EscrowResult[]> {
    const client = await this.getClient();
    const demoMode = this.configService.get<boolean>('demoMode') ?? false;
    const currency = this.configService.get<string>('rlusd.currency')!;
    const issuer = this.configService.get<string>('rlusd.issuer')!;

    return this.escrowClient.createMonthlyEscrows({
      client,
      senderWallet,
      destinationAddress,
      monthlyAmount,
      months,
      currency,
      issuer,
      demoMode,
    });
  }

  async finishEscrow(
    wallet: Wallet,
    ownerAddress: string,
    escrowSequence: number,
  ): Promise<string> {
    const client = await this.getClient();
    return this.escrowClient.finishEscrow({
      client,
      wallet,
      ownerAddress,
      escrowSequence,
    });
  }

  async cancelEscrow(
    wallet: Wallet,
    ownerAddress: string,
    escrowSequence: number,
  ): Promise<string> {
    const client = await this.getClient();
    return this.escrowClient.cancelEscrow({
      client,
      wallet,
      ownerAddress,
      escrowSequence,
    });
  }

  async onModuleDestroy() {
    if (this.client?.isConnected()) {
      await this.client.disconnect();
      this.logger.log('Disconnected from XRPL');
    }
  }
}

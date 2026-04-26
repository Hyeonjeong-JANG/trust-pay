import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client, Wallet } from 'xrpl';
import { XrplEscrowClient, EscrowResult } from '@prepaid-shield/xrpl-client';

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

  async fundTestWallet(): Promise<Wallet> {
    const client = await this.getClient();
    const { wallet } = await client.fundWallet();
    return wallet;
  }

  async createMonthlyEscrows(
    senderWallet: Wallet,
    destinationAddress: string,
    monthlyAmountXrp: string,
    months: number,
  ): Promise<EscrowResult[]> {
    const client = await this.getClient();
    const demoMode = this.configService.get<boolean>('demoMode') ?? false;

    return this.escrowClient.createMonthlyEscrows({
      client,
      senderWallet,
      destinationAddress,
      monthlyAmountXrp,
      months,
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

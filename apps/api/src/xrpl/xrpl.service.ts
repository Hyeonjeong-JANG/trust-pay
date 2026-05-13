import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client, Wallet, Payment, IssuedCurrencyAmount, EscrowCreate } from 'xrpl';
import { XrplEscrowClient, EscrowResult, CreateWalletResult, isoToRippleTime, monthsFromNow, currencyToHex } from '@prepaid-shield/xrpl-client';
import { randomUUID } from 'crypto';

export class PartialPrepaidEscrowCreationError extends Error {
  constructor(message: string, readonly escrowResults: EscrowResult[]) {
    super(message);
    this.name = 'PartialPrepaidEscrowCreationError';
  }
}

@Injectable()
export class XrplService implements OnModuleDestroy {
  private client: Client | null = null;
  private readonly escrowClient = new XrplEscrowClient();
  private readonly logger = new Logger(XrplService.name);
  private demoSequence = 1000;

  constructor(private configService: ConfigService) {}

  private get isDemoMode(): boolean {
    return this.configService.get<boolean>('demoMode') ?? false;
  }

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
    if (this.isDemoMode) {
      // Demo Mode keeps the UX deterministic and offline; Testnet Mode uses funded XRPL wallets.
      const wallet = Wallet.generate();
      this.logger.log(`[DEMO] Generated wallet ${wallet.address}`);
      return { wallet, address: wallet.address, secret: wallet.seed! };
    }
    const client = await this.getClient();
    return this.escrowClient.createWallet(client);
  }

  async setTrustLine(wallet: Wallet): Promise<string> {
    if (this.isDemoMode) {
      const hash = `DEMO_TRUST_${randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase()}`;
      this.logger.log(`[DEMO] TrustLine set for ${wallet.address}`);
      return hash;
    }
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

  async issueRLUSD(recipientAddress: string, amount: string): Promise<string> {
    if (this.isDemoMode) {
      this.logger.log(`[DEMO] Issued ${amount} RLUSD to ${recipientAddress}`);
      return `DEMO_ISSUE_${randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase()}`;
    }

    const issuerSeed = this.configService.get<string>('rlusd.issuerSeed');
    if (!issuerSeed) {
      this.logger.warn('RLUSD_ISSUER_SEED not set — skipping RLUSD issuance');
      return '';
    }

    const client = await this.getClient();
    const issuerWallet = Wallet.fromSeed(issuerSeed);
    const currency = this.configService.get<string>('rlusd.currency')!;

    const paymentAmount: IssuedCurrencyAmount = {
      currency: currencyToHex(currency),
      issuer: issuerWallet.address,
      value: amount,
    };

    const tx: Payment = {
      TransactionType: 'Payment',
      Account: issuerWallet.address,
      Destination: recipientAddress,
      Amount: paymentAmount,
    };

    const response = await client.submitAndWait(tx, { wallet: issuerWallet });
    this.logger.log(`Issued ${amount} RLUSD to ${recipientAddress}: ${response.result.hash}`);
    return response.result.hash;
  }

  async createMonthlyEscrows(
    senderWallet: Wallet,
    destinationAddress: string,
    monthlyAmount: string,
    months: number,
  ): Promise<EscrowResult[]> {
    if (this.isDemoMode) {
      const results: EscrowResult[] = [];
      for (let month = 1; month <= months; month++) {
        // Synthetic tx hashes let the app display ledger-like evidence without Testnet latency.
        const finishDate = monthsFromNow(month - 1, false);
        const cancelDate = monthsFromNow(month, false);
        results.push({
          month,
          sequence: this.demoSequence++,
          amount: monthlyAmount,
          finishAfter: isoToRippleTime(finishDate.toISOString()),
          cancelAfter: isoToRippleTime(cancelDate.toISOString()),
          txHash: `DEMO_ESCROW_${randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase()}`,
        });
      }
      this.logger.log(`[DEMO] Created ${months} escrow entries`);
      return results;
    }

    const client = await this.getClient();
    const fastMode = this.configService.get<boolean>('escrowFastMode') ?? this.isDemoMode;
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
      demoMode: fastMode,
    });
  }

  async createPrepaidEscrows(
    senderWallet: Wallet,
    destinationAddress: string,
    unitPrice: string,
    entryCount: number,
    validityMonths: number,
    options: { validFrom?: string; validUntil?: string } = {},
  ): Promise<EscrowResult[]> {
    const finishAfterDate = options.validFrom ? new Date(`${options.validFrom}T00:00:00.000Z`) : new Date(Date.now() + 60_000);
    const cancelAfterDate = options.validUntil ? new Date(`${options.validUntil}T00:00:00.000Z`) : monthsFromNow(validityMonths, this.isDemoMode);
    const finishAfter = isoToRippleTime(finishAfterDate.toISOString());
    const cancelAfter = isoToRippleTime(cancelAfterDate.toISOString());

    if (this.isDemoMode) {
      const results: EscrowResult[] = [];
      for (let entry = 1; entry <= entryCount; entry++) {
        results.push({
          month: entry,
          sequence: this.demoSequence++,
          amount: unitPrice,
          finishAfter,
          cancelAfter,
          txHash: `DEMO_PREPAID_${randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase()}`,
        });
      }
      this.logger.log(`[DEMO] Created ${entryCount} prepaid escrow entries`);
      return results;
    }

    const client = await this.getClient();
    const currency = this.configService.get<string>('rlusd.currency')!;
    const issuer = this.configService.get<string>('rlusd.issuer')!;
    const results: EscrowResult[] = [];

    try {
      for (let entry = 1; entry <= entryCount; entry++) {
        const amount: IssuedCurrencyAmount = {
          currency: currencyToHex(currency),
          issuer,
          value: unitPrice,
        };

        const tx: EscrowCreate = {
          TransactionType: 'EscrowCreate',
          Account: senderWallet.address,
          Destination: destinationAddress,
          Amount: amount,
          FinishAfter: finishAfter,
          CancelAfter: cancelAfter,
        };

        const response = await client.submitAndWait(tx, { wallet: senderWallet });
        const sequence = (response.result.tx_json as Record<string, unknown>).Sequence as number;

        results.push({
          month: entry,
          sequence,
          amount: unitPrice,
          finishAfter,
          cancelAfter,
          txHash: response.result.hash,
        });
      }
    } catch (err) {
      if (results.length > 0) {
        throw new PartialPrepaidEscrowCreationError('XRPL prepaid escrow creation failed after partial submission', results);
      }
      throw err;
    }

    return results;
  }

  async finishEscrow(
    wallet: Wallet,
    ownerAddress: string,
    escrowSequence: number,
  ): Promise<string> {
    if (this.isDemoMode) {
      const hash = `DEMO_FINISH_${randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase()}`;
      this.logger.log(`[DEMO] Finished escrow seq ${escrowSequence}`);
      return hash;
    }
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
    if (this.isDemoMode) {
      const hash = `DEMO_CANCEL_${randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase()}`;
      this.logger.log(`[DEMO] Cancelled escrow seq ${escrowSequence}`);
      return hash;
    }
    const client = await this.getClient();
    return this.escrowClient.cancelEscrow({
      client,
      wallet,
      ownerAddress,
      escrowSequence,
    });
  }

  async getBalance(xrplAddress: string): Promise<string> {
    if (this.isDemoMode) {
      this.logger.log(`[DEMO] Balance check for ${xrplAddress}`);
      return '10000.00';
    }
    try {
      const client = await this.getClient();
      const issuer = this.configService.get<string>('rlusd.issuer')!;
      const currency = this.configService.get<string>('rlusd.currency')!;
      const hexCurrency = currencyToHex(currency);
      const response = await client.request({
        command: 'account_lines',
        account: xrplAddress,
        peer: issuer,
      });
      const line = (response.result as any).lines.find(
        (l: any) => l.currency === currency || l.currency === hexCurrency,
      );
      return line?.balance ?? '0';
    } catch (err) {
      this.logger.warn(`Balance check failed for ${xrplAddress}: ${err}`);
      return '0';
    }
  }

  async onModuleDestroy() {
    if (this.client?.isConnected()) {
      await this.client.disconnect();
      this.logger.log('Disconnected from XRPL');
    }
  }
}

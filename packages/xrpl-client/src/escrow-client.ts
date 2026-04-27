import {
  Client,
  Wallet,
  EscrowCreate,
  EscrowFinish,
  EscrowCancel,
  TrustSet,
  IssuedCurrencyAmount,
} from 'xrpl';
import { isoToRippleTime, monthsFromNow, currencyToHex } from './utils';

export interface TokenEscrowParams {
  client: Client;
  senderWallet: Wallet;
  destinationAddress: string;
  monthlyAmount: string;
  months: number;
  currency: string;
  issuer: string;
  demoMode?: boolean;
}

export interface EscrowResult {
  month: number;
  sequence: number;
  amount: string;
  finishAfter: number;
  cancelAfter: number;
  txHash: string;
}

export interface FinishEscrowParams {
  client: Client;
  wallet: Wallet;
  ownerAddress: string;
  escrowSequence: number;
}

export interface CancelEscrowParams {
  client: Client;
  wallet: Wallet;
  ownerAddress: string;
  escrowSequence: number;
}

export interface SetTrustLineParams {
  client: Client;
  wallet: Wallet;
  currency: string;
  issuer: string;
  limit: string;
}

export interface CreateWalletResult {
  wallet: Wallet;
  address: string;
  secret: string;
}

export class XrplEscrowClient {
  /**
   * Create monthly Token Escrow entries on the XRPL (XLS-85).
   * Each month gets its own EscrowCreate with RLUSD IssuedCurrencyAmount.
   */
  async createMonthlyEscrows(
    params: TokenEscrowParams,
  ): Promise<EscrowResult[]> {
    const {
      client,
      senderWallet,
      destinationAddress,
      monthlyAmount,
      months,
      currency,
      issuer,
      demoMode = false,
    } = params;

    const results: EscrowResult[] = [];

    for (let month = 1; month <= months; month++) {
      const finishDate = monthsFromNow(month, demoMode);
      const cancelDate = monthsFromNow(month + 1, demoMode);

      const finishAfter = isoToRippleTime(finishDate.toISOString());
      const cancelAfter = isoToRippleTime(cancelDate.toISOString());

      const amount: IssuedCurrencyAmount = {
        currency: currencyToHex(currency),
        issuer,
        value: monthlyAmount,
      };

      const tx: EscrowCreate = {
        TransactionType: 'EscrowCreate',
        Account: senderWallet.address,
        Destination: destinationAddress,
        Amount: amount,
        FinishAfter: finishAfter,
        CancelAfter: cancelAfter,
      };

      const response = await client.submitAndWait(tx, {
        wallet: senderWallet,
      });

      const sequence =
        (response.result.tx_json as Record<string, unknown>).Sequence as number;

      results.push({
        month,
        sequence,
        amount: monthlyAmount,
        finishAfter,
        cancelAfter,
        txHash: response.result.hash,
      });
    }

    return results;
  }

  /**
   * Finish (release) a Token Escrow — business claims monthly RLUSD payment.
   * Only succeeds after FinishAfter time has passed.
   */
  async finishEscrow(params: FinishEscrowParams): Promise<string> {
    const { client, wallet, ownerAddress, escrowSequence } = params;

    const tx: EscrowFinish = {
      TransactionType: 'EscrowFinish',
      Account: wallet.address,
      Owner: ownerAddress,
      OfferSequence: escrowSequence,
    };

    const response = await client.submitAndWait(tx, { wallet });
    return response.result.hash;
  }

  /**
   * Cancel a Token Escrow — consumer reclaims RLUSD funds.
   * Only succeeds after CancelAfter time has passed.
   */
  async cancelEscrow(params: CancelEscrowParams): Promise<string> {
    const { client, wallet, ownerAddress, escrowSequence } = params;

    const tx: EscrowCancel = {
      TransactionType: 'EscrowCancel',
      Account: wallet.address,
      Owner: ownerAddress,
      OfferSequence: escrowSequence,
    };

    const response = await client.submitAndWait(tx, { wallet });
    return response.result.hash;
  }

  /**
   * Set a Trust Line so the wallet can hold RLUSD (or other issued tokens).
   */
  async setTrustLine(params: SetTrustLineParams): Promise<string> {
    const { client, wallet, currency, issuer, limit } = params;

    const tx: TrustSet = {
      TransactionType: 'TrustSet',
      Account: wallet.address,
      LimitAmount: {
        currency: currencyToHex(currency),
        issuer,
        value: limit,
      },
    };

    const response = await client.submitAndWait(tx, { wallet });
    return response.result.hash;
  }

  /**
   * Enable TrustLine Locking on an issuer account (required for XLS-85 Token Escrow).
   * Must be called once on the issuer before any EscrowCreate with issued tokens.
   */
  async enableTokenEscrow(client: Client, issuerWallet: Wallet): Promise<string> {
    const tx = {
      TransactionType: 'AccountSet' as const,
      Account: issuerWallet.address,
      SetFlag: 17, // asfAllowTrustLineLocking
    };
    const response = await client.submitAndWait(tx, { wallet: issuerWallet });
    return response.result.hash;
  }

  /**
   * Create a new funded wallet on Testnet and return credentials.
   * In production, this would use a different key generation approach.
   */
  async createWallet(client: Client): Promise<CreateWalletResult> {
    const { wallet } = await client.fundWallet();
    return {
      wallet,
      address: wallet.address,
      secret: wallet.seed!,
    };
  }
}

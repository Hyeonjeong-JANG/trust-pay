import {
  Client,
  Wallet,
  EscrowCreate,
  EscrowFinish,
  EscrowCancel,
} from 'xrpl';
import { isoToRippleTime, monthsFromNow, xrpToDrops } from './utils';

export interface CreateEscrowParams {
  client: Client;
  senderWallet: Wallet;
  destinationAddress: string;
  monthlyAmountXrp: string;
  months: number;
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

export class XrplEscrowClient {
  /**
   * Create monthly escrow entries on the XRPL.
   * Each month gets its own EscrowCreate with staggered FinishAfter/CancelAfter.
   */
  async createMonthlyEscrows(
    params: CreateEscrowParams,
  ): Promise<EscrowResult[]> {
    const {
      client,
      senderWallet,
      destinationAddress,
      monthlyAmountXrp,
      months,
      demoMode = false,
    } = params;

    const results: EscrowResult[] = [];
    const amountDrops = xrpToDrops(monthlyAmountXrp);

    for (let month = 1; month <= months; month++) {
      const finishDate = monthsFromNow(month, demoMode);
      const cancelDate = monthsFromNow(month + 1, demoMode);

      const finishAfter = isoToRippleTime(finishDate.toISOString());
      const cancelAfter = isoToRippleTime(cancelDate.toISOString());

      const tx: EscrowCreate = {
        TransactionType: 'EscrowCreate',
        Account: senderWallet.address,
        Destination: destinationAddress,
        Amount: amountDrops,
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
        amount: amountDrops,
        finishAfter,
        cancelAfter,
        txHash: response.result.hash,
      });
    }

    return results;
  }

  /**
   * Finish (release) an escrow — business claims their monthly payment.
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
   * Cancel an escrow — consumer reclaims funds.
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
}

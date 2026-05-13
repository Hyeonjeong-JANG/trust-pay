import { ConfigService } from '@nestjs/config';
import { PartialPrepaidEscrowCreationError, XrplService } from './xrpl.service';
import type { Wallet } from 'xrpl';

describe('XrplService', () => {
  it('should expose prepaid entries created before XRPL submission fails', async () => {
    const configService = {
      get: jest.fn((key: string) => {
        const map: Record<string, unknown> = {
          demoMode: false,
          'xrpl.url': 'wss://example.test',
          'rlusd.currency': 'USD',
          'rlusd.issuer': 'rIssuerAddress',
        };
        return map[key];
      }),
    } as unknown as ConfigService;
    const service = new XrplService(configService);
    const submitAndWait = jest
      .fn()
      .mockResolvedValueOnce({
        result: {
          hash: 'PREPAID_TX_1',
          tx_json: { Sequence: 300 },
        },
      })
      .mockRejectedValueOnce(new Error('XRPL submit failed'));

    jest.spyOn(service, 'getClient').mockResolvedValue({ submitAndWait } as never);

    await expect(service.createPrepaidEscrows(
      { address: 'rSenderAddress' } as Wallet,
      'rBusinessAddress',
      '5',
      2,
      3,
    )).rejects.toMatchObject({
      name: 'PartialPrepaidEscrowCreationError',
      escrowResults: [
        expect.objectContaining({
          month: 1,
          sequence: 300,
          amount: '5',
          txHash: 'PREPAID_TX_1',
        }),
      ],
    } satisfies Partial<PartialPrepaidEscrowCreationError>);
  });
});

import { ConfigService } from '@nestjs/config';
import { PartialPrepaidEscrowCreationError, XrplService } from './xrpl.service';
import type { Wallet } from 'xrpl';

describe('XrplService', () => {
  function rippleTimeToDate(rippleTime: number): Date {
    const rippleEpoch = 946684800;
    return new Date((rippleTime + rippleEpoch) * 1000);
  }

  it('should create demo monthly escrows from the approval date on calendar month boundaries', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-13T09:00:00.000Z'));
    const configService = {
      get: jest.fn((key: string) => ({ demoMode: true } as Record<string, unknown>)[key]),
    } as unknown as ConfigService;
    const service = new XrplService(configService);

    try {
      const results = await service.createMonthlyEscrows(
        { address: 'rSenderAddress' } as Wallet,
        'rBusinessAddress',
        '100',
        3,
      );

      expect(results.map((entry) => rippleTimeToDate(entry.finishAfter).toISOString().slice(0, 10))).toEqual([
        '2026-05-13',
        '2026-06-13',
        '2026-07-13',
      ]);
      expect(results.map((entry) => rippleTimeToDate(entry.cancelAfter).toISOString().slice(0, 10))).toEqual([
        '2026-06-13',
        '2026-07-13',
        '2026-08-13',
      ]);
    } finally {
      jest.useRealTimers();
    }
  });

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

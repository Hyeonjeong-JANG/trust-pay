import { BusinessClosureService } from './business-closure.service';

describe('BusinessClosureService', () => {
  let configService: { get: jest.Mock };

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string) => ({
        'nts.serviceKey': 'demo-key',
        'nts.statusUrl': 'https://example.test/nts-status',
      })[key]),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return not_configured when no business registration number is stored', async () => {
    const service = new BusinessClosureService(configService as any);

    const result = await service.checkBusinessStatus(null);

    expect(result.status).toBe('not_configured');
    expect(result.source).toBe('internal');
  });

  it('should return unavailable when the NTS service key is not configured', async () => {
    configService.get.mockImplementation((key: string) => (key === 'nts.statusUrl' ? 'https://example.test/nts-status' : ''));
    const service = new BusinessClosureService(configService as any);

    const result = await service.checkBusinessStatus('123-45-67890');

    expect(result.status).toBe('unavailable');
    expect(result.source).toBe('internal');
  });

  it('should map NTS closed business status to closed', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ b_stt_cd: '03', b_stt: '폐업자' }] }),
    } as Response);
    const service = new BusinessClosureService(configService as any);

    const result = await service.checkBusinessStatus('123-45-67890');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.test/nts-status?serviceKey=demo-key',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ b_no: ['1234567890'] }),
      }),
    );
    expect(result.status).toBe('closed');
    expect(result.source).toBe('nts');
  });
});

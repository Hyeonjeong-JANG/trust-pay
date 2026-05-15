import { createMobileQueryClient } from './queryClient';

describe('createMobileQueryClient', () => {
  it('should keep fetched data fresh briefly and avoid aggressive mobile retries', () => {
    const queryClient = createMobileQueryClient();
    const defaults = queryClient.getDefaultOptions();

    expect(defaults.queries?.staleTime).toBe(30_000);
    expect(defaults.queries?.gcTime).toBe(5 * 60 * 1000);
    expect(defaults.queries?.retry).toBe(1);
    expect(defaults.mutations?.retry).toBe(false);
  });
});

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { useAuthStore } from '../store/auth';
import { useAppStore } from '../store/app';
import type { EscrowRecord, EscrowEntry } from '@prepaid-shield/shared-types';

export function useUnreadCount(): number {
  const userId = useAuthStore((s) => s.userId);
  const lastViewed = useAppStore((s) => s.notificationsLastViewed);

  const { data: escrows } = useQuery({
    queryKey: ['consumerEscrows', userId],
    queryFn: () => api.getConsumerEscrows(userId!),
    enabled: !!userId,
  });

  return useMemo(() => {
    if (!escrows) return 0;
    let count = 0;
    for (const escrow of escrows as EscrowRecord[]) {
      const createdTs = new Date(escrow.createdAt).getTime();
      if (createdTs > lastViewed) count++;

      for (const entry of escrow.entries) {
        if (entry.status === 'released' || entry.status === 'refunded') {
          const updatedTs = new Date(
            (entry as any).updatedAt ?? (entry as any).createdAt ?? escrow.updatedAt,
          ).getTime();
          if (updatedTs > lastViewed) count++;
        }
      }
    }
    return count;
  }, [escrows, lastViewed]);
}

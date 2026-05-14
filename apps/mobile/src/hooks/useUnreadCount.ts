import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { useAuthStore } from '../store/auth';
import { useAppStore } from '../store/app';
import type { BusinessDashboard, ChargeRequest, EscrowRecord, RefundReviewRequest } from '@prepaid-shield/shared-types';

const MERCHANT_VISIBLE_REFUND_REVIEW_STATUSES = new Set([
  'platform_review',
  'merchant_response_requested',
  'merchant_responded',
  'merchant_review',
  'merchant_disputed',
  'platform_investigation',
  'auto_approved',
  'platform_approved',
  'refunded',
  'rejected',
]);

function getTime(value?: Date | string | null, fallback?: Date | string | null): number {
  return new Date(value ?? fallback ?? Date.now()).getTime();
}

export function useUnreadCount(): number {
  const userId = useAuthStore((s) => s.userId);
  const role = useAuthStore((s) => s.role);
  const lastViewed = useAppStore((s) => s.notificationsLastViewed);

  const { data: consumerEscrows } = useQuery({
    queryKey: ['consumerEscrows', userId],
    queryFn: () => api.getConsumerEscrows(userId!),
    enabled: role === 'consumer' && !!userId,
  });

  const { data: businessDashboard } = useQuery({
    queryKey: ['businessDashboard', userId],
    queryFn: () => api.getBusinessDashboard(userId!),
    enabled: role === 'business' && !!userId,
  });

  return useMemo(() => {
    if (role === 'business') {
      if (!businessDashboard) return 0;

      let count = 0;
      for (const escrow of (businessDashboard as BusinessDashboard).escrows) {
        const createdTs = getTime(escrow.createdAt);
        if (escrow.status === 'active' && createdTs > lastViewed) count++;

        for (const request of escrow.chargeRequests ?? []) {
          const charge = request as ChargeRequest;
          if (charge.status !== 'settled' && charge.status !== 'rejected') continue;
          const updatedTs = getTime(charge.settledAt ?? charge.rejectedAt ?? charge.approvedAt, charge.requestedAt);
          if (updatedTs > lastViewed) count++;
        }

        for (const request of escrow.refundReviewRequests ?? []) {
          const refund = request as RefundReviewRequest;
          if (!MERCHANT_VISIBLE_REFUND_REVIEW_STATUSES.has(refund.status)) continue;
          const requestedTs = getTime(refund.requestedAt);
          if (requestedTs > lastViewed) count++;
        }
      }
      return count;
    }

    if (!consumerEscrows) return 0;
    let count = 0;
    for (const escrow of consumerEscrows as EscrowRecord[]) {
      const createdTs = getTime(escrow.createdAt);
      if (createdTs > lastViewed) count++;

      for (const entry of escrow.entries) {
        if (entry.status === 'released' || entry.status === 'refunded') {
          const updatedTs = getTime((entry as any).updatedAt ?? (entry as any).createdAt, escrow.updatedAt);
          if (updatedTs > lastViewed) count++;
        }
      }
    }
    return count;
  }, [businessDashboard, consumerEscrows, lastViewed, role]);
}

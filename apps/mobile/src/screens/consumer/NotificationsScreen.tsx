import React, { useEffect, useMemo } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { useAuthStore } from '../../store/auth';
import { useAppStore } from '../../store/app';
import { colors, spacing, radius, font, shadow } from '../../theme';
import { formatKrwFromRlusd, formatKrwWithRlusd } from '../../utils/money';
import type { BusinessDashboard, ChargeRequest, EscrowRecord, RefundReviewRequest } from '@prepaid-shield/shared-types';

type EscrowWithBusiness = EscrowRecord & { business?: { name: string } };
type EscrowWithConsumer = EscrowRecord & { consumer?: { name: string } };

interface NotificationItem {
  id: string;
  icon: string;
  title: string;
  description: string;
  timestamp: number;
  isUnread: boolean;
}

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

const RIPPLE_EPOCH = 946684800;

function formatRelativeTime(ts: number): string {
  const now = Date.now();
  const diff = now - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '방금 전';
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}일 전`;
  const months = Math.floor(days / 30);
  return `${months}개월 전`;
}

export function NotificationsScreen() {
  const userId = useAuthStore((s) => s.userId);
  const role = useAuthStore((s) => s.role);
  const lastViewed = useAppStore((s) => s.notificationsLastViewed);
  const setNotificationsLastViewed = useAppStore((s) => s.setNotificationsLastViewed);

  const { data: escrows } = useQuery({
    queryKey: ['consumerEscrows', userId],
    queryFn: () => api.getConsumerEscrows(userId!),
    enabled: role === 'consumer' && !!userId,
  });

  const { data: businessDashboard } = useQuery({
    queryKey: ['businessDashboard', userId],
    queryFn: () => api.getBusinessDashboard(userId!),
    enabled: role === 'business' && !!userId,
  });

  useEffect(() => {
    setNotificationsLastViewed(Date.now());
  }, [setNotificationsLastViewed]);

  const notifications = useMemo((): NotificationItem[] => {
    if (role === 'business') {
      if (!businessDashboard) return [];
      const items: NotificationItem[] = [];
      for (const escrow of (businessDashboard as BusinessDashboard).escrows as EscrowWithConsumer[]) {
        const consumerName = escrow.consumer?.name ?? '손님';
        const createdTs = new Date(escrow.createdAt ?? Date.now()).getTime();
        if (escrow.status === 'active') {
          items.push({
            id: `${escrow.id}-business-created`,
            icon: '📝',
            title: '보호 결제 승인',
            description: `${consumerName}님이 ${formatKrwFromRlusd(escrow.totalAmount)} 보호 결제를 승인했습니다.`,
            timestamp: createdTs,
            isUnread: createdTs > lastViewed,
          });
        }

        for (const request of escrow.chargeRequests ?? []) {
          const charge = request as ChargeRequest;
          const ts = new Date(charge.settledAt ?? charge.rejectedAt ?? charge.approvedAt ?? charge.requestedAt ?? Date.now()).getTime();
          if (charge.status === 'settled') {
            items.push({
              id: `${charge.id}-business-charge-settled`,
              icon: '✅',
              title: '차감 정산 완료',
              description: `${consumerName}님이 ${charge.menuName} ${formatKrwFromRlusd(charge.amount)} 차감을 승인했습니다.`,
              timestamp: ts,
              isUnread: ts > lastViewed,
            });
          }
          if (charge.status === 'rejected') {
            items.push({
              id: `${charge.id}-business-charge-rejected`,
              icon: '↩️',
              title: '차감 요청 거절',
              description: `${consumerName}님이 ${charge.menuName} ${formatKrwFromRlusd(charge.amount)} 차감 요청을 거절했습니다.`,
              timestamp: ts,
              isUnread: ts > lastViewed,
            });
          }
        }

        for (const request of escrow.refundReviewRequests ?? []) {
          const refund = request as RefundReviewRequest;
          if (!MERCHANT_VISIBLE_REFUND_REVIEW_STATUSES.has(refund.status)) continue;
          const requestedTs = new Date(refund.requestedAt ?? Date.now()).getTime();
          items.push({
            id: `${refund.id}-business-refund-review`,
            icon: '🔎',
            title: '환불 검토 요청',
            description: `${consumerName}님이 ${formatKrwFromRlusd(refund.refundableAmount)} 환불 검토를 요청했습니다. ${refund.merchantNotice ?? ''}`.trim(),
            timestamp: requestedTs,
            isUnread: requestedTs > lastViewed,
          });
        }
      }
      items.sort((a, b) => b.timestamp - a.timestamp);
      return items;
    }

    if (!escrows) return [];
    const items: NotificationItem[] = [];

    for (const escrow of escrows as EscrowWithBusiness[]) {
      const bizName = escrow.business?.name ?? '사업자';
      const createdTs = new Date(escrow.createdAt).getTime();

      items.push({
        id: `${escrow.id}-created`,
        icon: '📝',
        title: '보호 결제 시작',
        description: `${bizName} 보호 결제가 시작되었습니다. 보호 금액 ${formatKrwWithRlusd(escrow.totalAmount)}`,
        timestamp: createdTs,
        isUnread: createdTs > lastViewed,
      });

      for (const entry of escrow.entries) {
        if (entry.status === 'released') {
          const ts = new Date(
            (entry as any).updatedAt ?? (entry as any).createdAt ?? escrow.updatedAt,
          ).getTime();
          items.push({
            id: `${entry.id}-released`,
            icon: '✅',
            title: '정산 완료',
            description: `${bizName} ${entry.month}월차 정산이 완료되었습니다. 정산액 ${formatKrwWithRlusd(entry.amount)}`,
            timestamp: ts,
            isUnread: ts > lastViewed,
          });
        }
        if (entry.status === 'refunded') {
          const ts = new Date(
            (entry as any).updatedAt ?? (entry as any).createdAt ?? escrow.updatedAt,
          ).getTime();
          items.push({
            id: `${entry.id}-refunded`,
            icon: '↩️',
            title: '환불 완료',
            description: `${bizName} ${entry.month}월차 대기 금액이 환불되었습니다. 환불액 ${formatKrwWithRlusd(entry.amount)}`,
            timestamp: ts,
            isUnread: ts > lastViewed,
          });
        }
      }

      if (escrow.status === 'cancelled') {
        const cancelTs = new Date(escrow.updatedAt).getTime();
        items.push({
          id: `${escrow.id}-cancelled`,
          icon: '❌',
          title: '보호 결제 취소',
          description: `${bizName} 보호 결제가 취소되었습니다.`,
          timestamp: cancelTs,
          isUnread: cancelTs > lastViewed,
        });
      }
    }

    items.sort((a, b) => b.timestamp - a.timestamp);
    return items;
  }, [businessDashboard, escrows, lastViewed, role]);

  return (
    <View style={s.container}>
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={s.card}>
            {item.isUnread && <View style={s.unreadDot} />}
            <View style={s.iconWrap}>
              <Text style={s.icon}>{item.icon}</Text>
            </View>
            <View style={s.content}>
              <Text style={s.title}>{item.title}</Text>
              <Text style={s.desc}>{item.description}</Text>
              <Text style={s.time}>{formatRelativeTime(item.timestamp)}</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={s.emptyContainer}>
            <Text style={s.emptyIcon}>🔔</Text>
            <Text style={s.emptyTitle}>알림이 없습니다</Text>
            <Text style={s.emptyDesc}>보호 결제 활동 알림이 여기에 표시됩니다</Text>
          </View>
        }
        contentContainerStyle={s.listContent}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  listContent: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  card: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    padding: spacing.lg,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    ...shadow.sm,
  },
  unreadDot: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.sm,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.gray50,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  icon: { fontSize: 18 },
  content: { flex: 1 },
  title: {
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
    color: colors.gray800,
    marginBottom: 2,
  },
  desc: {
    fontSize: font.size.sm,
    color: colors.gray500,
    lineHeight: 20,
  },
  time: {
    fontSize: font.size.xs,
    color: colors.gray400,
    marginTop: spacing.xs,
  },
  emptyContainer: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 40, marginBottom: spacing.md },
  emptyTitle: {
    fontSize: font.size.lg,
    fontWeight: font.weight.semibold,
    color: colors.gray700,
    marginBottom: spacing.xs,
  },
  emptyDesc: { fontSize: font.size.sm, color: colors.gray400, textAlign: 'center' },
});

import React, { useEffect, useRef, useState } from 'react';
import { Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { useAuthStore } from '../store/auth';
import { useAppStore } from '../store/app';
import { formatKrwFromRlusd, formatRlusd } from '../utils/money';
import { colors, font, radius, shadow, spacing } from '../theme';
import type { BusinessDashboard, ChargeRequest, EscrowRecord, RefundReviewRequest } from '@prepaid-shield/shared-types';

type EscrowWithBusiness = EscrowRecord & { business?: { name: string } };
type EscrowWithConsumer = EscrowRecord & { consumer?: { name: string } };

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

type RealtimeEvent = {
  id: string;
  title: string;
  body: string;
  detail?: string;
};

function notifySystem(event: RealtimeEvent) {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !('Notification' in window)) return;
  const NotificationApi = window.Notification;
  if (NotificationApi.permission === 'granted') {
    new NotificationApi(event.title, { body: event.body });
    return;
  }
  if (NotificationApi.permission === 'default') {
    NotificationApi.requestPermission().then((permission) => {
      if (permission === 'granted') new NotificationApi(event.title, { body: event.body });
    });
  }
}

export function buildConsumerRealtimeEvents(escrows: EscrowWithBusiness[] = []): RealtimeEvent[] {
  return escrows.flatMap((escrow) => {
    const businessName = escrow.business?.name ?? '사업자';
    return (escrow.chargeRequests ?? [])
      .filter((request) => request.status === 'pending_approval')
      .map((request: ChargeRequest) => ({
        id: `consumer-charge-${request.id}`,
        title: '차감 승인 요청 도착',
        body: `${businessName}에서 ${request.menuName} ${formatKrwFromRlusd(request.amount)} 차감 승인을 요청했습니다.`,
        detail: formatRlusd(request.amount),
      }));
  });
}

export function buildBusinessRealtimeEvents(dashboard?: BusinessDashboard): RealtimeEvent[] {
  if (!dashboard) return [];
  return (dashboard.escrows as EscrowWithConsumer[]).flatMap((escrow) => {
    const consumerName = escrow.consumer?.name ?? '손님';
    const escrowEvents: RealtimeEvent[] = escrow.status === 'active'
      ? [{
          id: `business-escrow-${escrow.id}`,
          title: '보호 결제 승인',
          body: `${consumerName}님이 ${formatKrwFromRlusd(escrow.totalAmount)} 보호 결제를 승인했습니다.`,
          detail: formatRlusd(escrow.totalAmount),
        }]
      : [];
    const chargeEvents = (escrow.chargeRequests ?? [])
      .flatMap((request: ChargeRequest) => {
        if (request.status === 'settled') {
          return [{
            id: `business-charge-${request.id}`,
            title: '차감 정산 완료',
            body: `${consumerName}님이 ${request.menuName} ${formatKrwFromRlusd(request.amount)} 차감을 승인했습니다.`,
            detail: formatRlusd(request.amount),
          }];
        }
        if (request.status === 'rejected') {
          return [{
            id: `business-charge-rejected-${request.id}`,
            title: '차감 요청 거절',
            body: `${consumerName}님이 ${request.menuName} ${formatKrwFromRlusd(request.amount)} 차감 요청을 거절했습니다.`,
            detail: formatRlusd(request.amount),
          }];
        }
        return [];
      });
    const refundEvents = (escrow.refundReviewRequests ?? [])
      .filter((request: RefundReviewRequest) => MERCHANT_VISIBLE_REFUND_REVIEW_STATUSES.has(request.status))
      .map((request: RefundReviewRequest) => ({
        id: `business-refund-review-${request.id}`,
        title: '환불 검토 요청 도착',
        body: `${consumerName}님이 ${formatKrwFromRlusd(request.refundableAmount)} 환불 검토를 요청했습니다.`,
        detail: request.merchantNotice ?? undefined,
      }));
    return [...escrowEvents, ...chargeEvents, ...refundEvents];
  });
}

function useRealtimeEventQueue(
  events: RealtimeEvent[],
  scopeKey: string,
  seenIds: string[],
  markSeen: (id: string) => void,
) {
  const seenRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);
  const scopeRef = useRef(scopeKey);
  const [queue, setQueue] = useState<RealtimeEvent[]>([]);

  useEffect(() => {
    if (scopeRef.current !== scopeKey) {
      scopeRef.current = scopeKey;
      seenRef.current = new Set(seenIds);
      initializedRef.current = false;
      setQueue([]);
    }
  }, [scopeKey, seenIds]);

  useEffect(() => {
    for (const id of seenIds) seenRef.current.add(id);
  }, [seenIds]);

  useEffect(() => {
    if (!initializedRef.current) {
      seenRef.current = new Set([...seenIds, ...events.map((event) => event.id)]);
      initializedRef.current = true;
      return;
    }
    const nextEvents = events.filter((event) => !seenRef.current.has(event.id));
    if (nextEvents.length === 0) return;

    for (const event of nextEvents) {
      seenRef.current.add(event.id);
      notifySystem(event);
    }
    setQueue((current) => [...current, ...nextEvents]);
  }, [events, seenIds]);

  const dismiss = () => setQueue((current) => {
    const [dismissed, ...rest] = current;
    if (dismissed) markSeen(dismissed.id);
    return rest;
  });
  return { activeEvent: queue[0], dismiss };
}

export function RealtimeNotificationCenter() {
  const role = useAuthStore((s) => s.role);
  const userId = useAuthStore((s) => s.userId);
  const seenIds = useAppStore((s) => s.realtimeNotificationSeenIds);
  const markSeen = useAppStore((s) => s.markRealtimeNotificationSeen);

  const { data: consumerEscrows } = useQuery({
    queryKey: ['consumerEscrows', userId],
    queryFn: () => api.getConsumerEscrows(userId!),
    enabled: role === 'consumer' && !!userId,
    refetchInterval: 4000,
    refetchIntervalInBackground: true,
  });

  const { data: businessDashboard } = useQuery({
    queryKey: ['businessDashboard', userId],
    queryFn: () => api.getBusinessDashboard(userId!),
    enabled: role === 'business' && !!userId,
    refetchInterval: 4000,
    refetchIntervalInBackground: true,
  });

  const events = role === 'business'
    ? buildBusinessRealtimeEvents(businessDashboard)
    : buildConsumerRealtimeEvents((consumerEscrows ?? []) as EscrowWithBusiness[]);
  const { activeEvent, dismiss } = useRealtimeEventQueue(
    events,
    `${role ?? 'none'}:${userId ?? 'none'}`,
    seenIds,
    markSeen,
  );

  return (
    <Modal visible={!!activeEvent} transparent animationType="fade" onRequestClose={dismiss}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Text style={styles.icon}>🔔</Text>
          </View>
          <Text style={styles.eyebrow}>TrustPay 알림</Text>
          <Text style={styles.title}>{activeEvent?.title}</Text>
          <Text style={styles.body}>{activeEvent?.body}</Text>
          {activeEvent?.detail && <Text style={styles.detail}>{activeEvent.detail}</Text>}
          <TouchableOpacity style={styles.primaryButton} onPress={dismiss} activeOpacity={0.84}>
            <Text style={styles.primaryText}>확인</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.42)',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadow.lg,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  icon: { fontSize: 22 },
  eyebrow: {
    fontSize: font.size.xs,
    color: colors.primary,
    fontWeight: font.weight.bold,
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: font.size.xl,
    color: colors.gray900,
    fontWeight: font.weight.bold,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  body: {
    fontSize: font.size.sm,
    color: colors.gray600,
    lineHeight: 20,
    textAlign: 'center',
  },
  detail: {
    fontSize: font.size.xs,
    color: colors.gray400,
    marginTop: spacing.sm,
  },
  primaryButton: {
    alignSelf: 'stretch',
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  primaryText: {
    color: colors.white,
    fontSize: font.size.sm,
    fontWeight: font.weight.bold,
  },
});

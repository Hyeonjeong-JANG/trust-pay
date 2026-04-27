import React, { useEffect, useMemo } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { useAuthStore } from '../../store/auth';
import { useAppStore } from '../../store/app';
import { colors, spacing, radius, font, shadow } from '../../theme';
import type { EscrowRecord } from '@prepaid-shield/shared-types';

type EscrowWithBusiness = EscrowRecord & { business?: { name: string } };

interface NotificationItem {
  id: string;
  icon: string;
  title: string;
  description: string;
  timestamp: number;
  isUnread: boolean;
}

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
  const lastViewed = useAppStore((s) => s.notificationsLastViewed);
  const setNotificationsLastViewed = useAppStore((s) => s.setNotificationsLastViewed);

  const { data: escrows } = useQuery({
    queryKey: ['consumerEscrows', userId],
    queryFn: () => api.getConsumerEscrows(userId!),
    enabled: !!userId,
  });

  useEffect(() => {
    setNotificationsLastViewed(Date.now());
  }, [setNotificationsLastViewed]);

  const notifications = useMemo((): NotificationItem[] => {
    if (!escrows) return [];
    const items: NotificationItem[] = [];

    for (const escrow of escrows as EscrowWithBusiness[]) {
      const bizName = escrow.business?.name ?? '사업자';
      const createdTs = new Date(escrow.createdAt).getTime();

      items.push({
        id: `${escrow.id}-created`,
        icon: '📝',
        title: '에스크로 생성',
        description: `${bizName}에 ${escrow.totalAmount.toLocaleString()} RLUSD 에스크로가 생성되었습니다.`,
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
            title: '릴리즈 완료',
            description: `${bizName} ${entry.month}월차 ${Number(entry.amount).toLocaleString()} RLUSD가 릴리즈되었습니다.`,
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
            description: `${bizName} ${entry.month}월차 ${Number(entry.amount).toLocaleString()} RLUSD가 환불되었습니다.`,
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
          title: '에스크로 취소',
          description: `${bizName} 에스크로가 취소되었습니다.`,
          timestamp: cancelTs,
          isUnread: cancelTs > lastViewed,
        });
      }
    }

    items.sort((a, b) => b.timestamp - a.timestamp);
    return items;
  }, [escrows, lastViewed]);

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
            <Text style={s.emptyDesc}>에스크로 활동 알림이 여기에 표시됩니다</Text>
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

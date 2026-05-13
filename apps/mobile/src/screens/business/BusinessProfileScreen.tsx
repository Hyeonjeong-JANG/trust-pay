import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  TextInput,
  Platform,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { useAuthStore } from '../../store/auth';
import { useBusinessMenuStore } from '../../store/businessMenus';
import { formatKrwFromRlusd, krwToRlusd } from '../../utils/money';
import { showErrorToast, showSuccessToast } from '../../utils/toast';
import { colors, spacing, radius, font, shadow } from '../../theme';
import type { ScreenProps } from '../../navigation/types';

const EMPTY_MENUS: never[] = [];

export function BusinessProfileScreen(_props: ScreenProps<'BusinessProfile'>) {
  const userId = useAuthStore((s) => s.userId);
  const name = useAuthStore((s) => s.name);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const menusByBusinessId = useBusinessMenuStore((s) => s.menusByBusinessId);
  const addMenu = useBusinessMenuStore((s) => s.addMenu);
  const queryClient = useQueryClient();
  const [menuName, setMenuName] = useState('');
  const [menuAmount, setMenuAmount] = useState('');
  const menus = userId ? menusByBusinessId[userId] ?? EMPTY_MENUS : EMPTY_MENUS;

  const { data: balanceData, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['balance', userId],
    queryFn: () => api.getBalance(userId!, 'business'),
    enabled: !!userId,
    retry: 1,
  });

  const copyAddress = async () => {
    if (balanceData?.xrplAddress) {
      await Clipboard.setStringAsync(balanceData.xrplAddress);
      Alert.alert('복사됨', 'XRPL 주소가 클립보드에 복사되었습니다.');
    }
  };

  const logout = () => {
    queryClient.clear();
    clearAuth();
  };

  const submitMenu = () => {
    const trimmedName = menuName.trim();
    const amount = krwToRlusd(menuAmount);
    if (!userId || !trimmedName || amount <= 0) {
      showErrorToast('메뉴 추가 실패', '차감 항목명과 금액을 입력해주세요.');
      return;
    }
    addMenu(userId, trimmedName, amount);
    setMenuName('');
    setMenuAmount('');
    showSuccessToast('메뉴 추가 완료', '상세 화면 차감 요청에서 선택할 수 있습니다.');
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
      }
    >
      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(name ?? '?')[0]}</Text>
        </View>
        <Text style={styles.screenTitle}>가게관리</Text>
        <Text style={styles.name}>{name ?? '사업자'}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>사업자</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>차감 메뉴 등록</Text>
        <View style={styles.card}>
          <Text style={styles.menuDesc}>
            자주 차감하는 항목을 등록하면 손님 상세 화면에서 드롭다운으로 바로 요청할 수 있습니다.
          </Text>
          <View style={styles.menuInputRow}>
            <TextInput
              style={[styles.menuInput, styles.menuNameInput]}
              placeholder="예: PT 1회"
              placeholderTextColor={colors.gray400}
              value={menuName}
              onChangeText={setMenuName}
            />
            <TextInput
              style={[styles.menuInput, styles.menuAmountInput]}
              placeholder="예: 67,500"
              placeholderTextColor={colors.gray400}
              keyboardType="number-pad"
              value={menuAmount}
              onChangeText={setMenuAmount}
            />
          </View>
          <TouchableOpacity style={styles.addMenuButton} onPress={submitMenu} activeOpacity={0.8}>
            <Text style={styles.addMenuButtonText}>메뉴 추가</Text>
          </TouchableOpacity>
          {menus.length > 0 && (
            <View style={styles.menuList}>
              {menus.map((menu) => (
                <Text key={menu.id} style={styles.menuItemText}>
                  {menu.name} · {formatKrwFromRlusd(menu.amount)}
                </Text>
              ))}
            </View>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>XRPL 지갑</Text>
        <View style={styles.card}>
          {isLoading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : balanceData ? (
            <>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>잔액</Text>
                <Text style={styles.infoValue}>
                  {Number(balanceData.balance).toLocaleString()} RLUSD
                </Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>주소</Text>
                <Text style={styles.addressValue} numberOfLines={1}>
                  {balanceData.xrplAddress}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.copyButton}
                onPress={copyAddress}
                activeOpacity={0.7}
              >
                <Text style={styles.copyButtonText}>주소 복사</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={styles.errorText}>지갑 정보를 불러올 수 없습니다</Text>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>앱 정보</Text>
        <View style={styles.card}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>네트워크</Text>
            <Text style={styles.infoValue}>XRPL Testnet</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>통화</Text>
            <Text style={styles.infoValue}>RLUSD</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>에스크로</Text>
            <Text style={styles.infoValue}>Token Escrow (XLS-85)</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>계정</Text>
        <TouchableOpacity style={styles.logoutButton} onPress={logout} activeOpacity={0.75}>
          <Text style={styles.logoutButtonText}>로그아웃</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  profileHeader: { alignItems: 'center', paddingVertical: spacing.xxl },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
    ...shadow.md,
  },
  avatarText: { fontSize: font.size.xxl, fontWeight: font.weight.bold, color: colors.white },
  screenTitle: {
    fontSize: font.size.xxl,
    fontWeight: font.weight.bold,
    color: colors.gray900,
    marginBottom: spacing.xs,
  },
  name: { fontSize: font.size.xl, fontWeight: font.weight.bold, color: colors.gray900, marginBottom: spacing.sm },
  roleBadge: {
    backgroundColor: colors.successLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  roleText: { fontSize: font.size.sm, color: colors.success, fontWeight: font.weight.medium },
  section: { marginTop: spacing.xl },
  sectionTitle: {
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
    color: colors.gray400,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.lg,
    ...shadow.sm,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  infoLabel: { fontSize: font.size.md, color: colors.gray500 },
  infoValue: { fontSize: font.size.md, fontWeight: font.weight.semibold, color: colors.gray900 },
  addressValue: {
    fontSize: font.size.sm,
    fontFamily: font.mono,
    color: colors.gray700,
    flex: 1,
    textAlign: 'right',
    marginLeft: spacing.md,
  },
  divider: { height: 1, backgroundColor: colors.gray100 },
  copyButton: {
    marginTop: spacing.md,
    backgroundColor: colors.successLight,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  copyButtonText: { color: colors.success, fontWeight: font.weight.semibold, fontSize: font.size.sm },
  menuDesc: {
    fontSize: font.size.sm,
    color: colors.gray500,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  menuInputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  menuInput: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? spacing.md : spacing.sm,
    fontSize: font.size.md,
    color: colors.gray900,
  },
  menuNameInput: { flex: 1 },
  menuAmountInput: { width: 128 },
  addMenuButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  addMenuButtonText: { color: colors.white, fontWeight: font.weight.semibold, fontSize: font.size.sm },
  menuList: {
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  menuItemText: {
    backgroundColor: colors.gray50,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: font.size.sm,
    color: colors.gray700,
    fontWeight: font.weight.medium,
  },
  logoutButton: {
    minHeight: 48,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.sm,
  },
  logoutButtonText: { color: colors.danger, fontWeight: font.weight.semibold, fontSize: font.size.md },
  errorText: { fontSize: font.size.md, color: colors.gray400, textAlign: 'center' },
});

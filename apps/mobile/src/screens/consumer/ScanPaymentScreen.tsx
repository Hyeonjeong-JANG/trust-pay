import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { api } from '../../api/client';
import type { ApiError } from '../../api/client';
import { showErrorToast } from '../../utils/toast';
import { formatKrwWithRlusd } from '../../utils/money';
import { colors, spacing, radius, font, shadow } from '../../theme';
import type { ScreenProps } from '../../navigation/types';

type Tab = 'camera' | 'manual';

export function ScanPaymentScreen({ navigation }: ScreenProps<'ScanPayment'>) {
  const [tab, setTab] = useState<Tab>('camera');
  const [code, setCode] = useState('');
  const [scanned, setScanned] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const mutation = useMutation({
    mutationFn: (value: string) => api.getPaymentRequest(value),
    onSuccess: (request) => {
      navigation.navigate('Payment', {
        businessId: request.businessId,
        businessName: request.businessName,
        businessCategory: request.businessCategory ?? undefined,
        paymentRequest: request,
      });
    },
    onError: (err: Error) => {
      const apiErr = err as ApiError;
      showErrorToast('QR 조회 실패', apiErr.userMessage ?? err.message);
      setScanned(false);
    },
  });

  const handleBarCodeScanned = useCallback(
    (result: BarcodeScanningResult) => {
      if (scanned || mutation.isPending) return;
      setScanned(true);
      const normalized = result.data.trim().toUpperCase();
      mutation.mutate(normalized);
    },
    [scanned, mutation],
  );

  const submitManual = useCallback(() => {
    const normalized = code.trim().toUpperCase();
    if (!normalized) {
      showErrorToast('QR 조회 실패', '결제 QR 코드를 입력해주세요.');
      return;
    }
    mutation.mutate(normalized);
  }, [code, mutation]);

  const isWeb = Platform.OS === 'web';
  const cameraAvailable = !isWeb && permission?.granted;
  const activeTab = isWeb ? 'manual' : tab;

  return (
    <View style={styles.container}>
      <View style={styles.heroCard}>
        <Text style={styles.eyebrow}>TrustPay 현장 결제</Text>
        <Text style={styles.title}>QR 코드 입력</Text>
        <Text style={styles.desc}>
          사업자가 보여준 결제 QR의 코드를 입력한 뒤, 손님은 앱에서 계좌 승인만 합니다.
        </Text>
      </View>

      {!isWeb && (
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'camera' && styles.tabButtonActive]}
            onPress={() => { setTab('camera'); setScanned(false); }}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === 'camera' && styles.tabTextActive]}>
              카메라 스캔
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'manual' && styles.tabButtonActive]}
            onPress={() => setTab('manual')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === 'manual' && styles.tabTextActive]}>
              직접 입력
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {activeTab === 'camera' && !isWeb && (
        <View style={styles.cameraCard}>
          {!permission ? (
            <ActivityIndicator color={colors.primary} style={styles.cameraLoading} />
          ) : !permission.granted ? (
            <View style={styles.permissionBox}>
              <Text style={styles.permissionText}>
                QR 코드를 스캔하려면 카메라 권한이 필요합니다.
              </Text>
              <TouchableOpacity style={styles.permissionButton} onPress={requestPermission} activeOpacity={0.8}>
                <Text style={styles.permissionButtonText}>카메라 권한 허용</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setTab('manual')} activeOpacity={0.8}>
                <Text style={styles.fallbackLink}>직접 입력으로 전환</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.cameraWrapper}>
                <CameraView
                  style={styles.camera}
                  facing="back"
                  barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                  onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                />
                {scanned && (
                  <View style={styles.cameraOverlay}>
                    <ActivityIndicator color={colors.white} size="large" />
                    <Text style={styles.overlayText}>결제 정보 조회 중...</Text>
                  </View>
                )}
              </View>
              <Text style={styles.cameraTip}>QR 코드를 카메라에 비춰주세요</Text>
            </>
          )}
        </View>
      )}

      {activeTab === 'manual' && (
        <View style={styles.inputCard}>
          <Text style={styles.label}>결제 코드 입력</Text>
          <Text style={styles.guideText}>사업자 화면에 표시된 TP-xxxxxx 코드를 입력하세요.</Text>
          <TextInput
            style={styles.input}
            placeholder="예: TP-123456"
            placeholderTextColor={colors.gray400}
            autoCapitalize="characters"
            value={code}
            onChangeText={setCode}
          />
          <TouchableOpacity
            style={[styles.button, mutation.isPending && styles.buttonDisabled]}
            onPress={submitManual}
            disabled={mutation.isPending}
            activeOpacity={0.85}
          >
            {mutation.isPending ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.buttonText}>결제 QR 불러오기</Text>
            )}
          </TouchableOpacity>
          {mutation.data && (
            <Text style={styles.previewText}>
              {mutation.data.businessName} · {formatKrwWithRlusd(mutation.data.totalAmount)}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  heroCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.md,
    ...shadow.md,
  },
  eyebrow: { fontSize: font.size.xs, color: colors.primary, fontWeight: font.weight.bold, marginBottom: spacing.xs },
  title: { fontSize: font.size.xxl, color: colors.gray900, fontWeight: font.weight.bold, marginBottom: spacing.sm },
  desc: { fontSize: font.size.sm, color: colors.gray500, textAlign: 'center', lineHeight: 20 },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: colors.gray100,
    borderRadius: radius.md,
    padding: 4,
    marginBottom: spacing.md,
    gap: 4,
  },
  tabButton: {
    flex: 1,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: colors.white,
    ...shadow.sm,
  },
  tabText: { fontSize: font.size.sm, color: colors.gray500, fontWeight: font.weight.semibold },
  tabTextActive: { color: colors.primary },
  cameraCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadow.sm,
  },
  cameraLoading: { padding: spacing.xxxl },
  cameraWrapper: {
    width: '100%',
    aspectRatio: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  camera: { flex: 1 },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayText: { color: colors.white, fontSize: font.size.sm, marginTop: spacing.sm },
  cameraTip: {
    fontSize: font.size.sm,
    color: colors.gray500,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  permissionBox: { padding: spacing.xl, alignItems: 'center' },
  permissionText: {
    fontSize: font.size.sm,
    color: colors.gray600,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  permissionButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  permissionButtonText: { color: colors.white, fontSize: font.size.sm, fontWeight: font.weight.semibold },
  fallbackLink: { color: colors.primary, fontSize: font.size.sm, fontWeight: font.weight.semibold },
  inputCard: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, ...shadow.sm },
  label: { fontSize: font.size.sm, color: colors.gray700, fontWeight: font.weight.semibold, marginBottom: spacing.sm },
  guideText: { fontSize: font.size.xs, color: colors.gray500, lineHeight: 18, marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.gray50,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: font.size.lg,
    color: colors.gray900,
    fontFamily: font.mono,
    marginBottom: spacing.md,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    minHeight: 52,
  },
  buttonDisabled: { opacity: 0.55 },
  buttonText: { color: colors.white, fontSize: font.size.md, fontWeight: font.weight.bold },
  previewText: { fontSize: font.size.sm, color: colors.gray500, marginTop: spacing.md, textAlign: 'center' },
});

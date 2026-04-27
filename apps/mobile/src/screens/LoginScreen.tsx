import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { api } from '../api/client';
import { useAuthStore } from '../store/auth';

type UserRole = 'consumer' | 'business';
type LoginMethod = 'phone' | 'email';

export function LoginScreen() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const [role, setRole] = useState<UserRole>('consumer');
  const [method, setMethod] = useState<LoginMethod>('phone');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');

  const loginMutation = useMutation({
    mutationFn: () =>
      api.login({
        ...(method === 'phone' ? { phone } : { email }),
        role,
        ...(name ? { name } : {}),
      }),
    onSuccess: (data) => {
      setAuth(data.role, data.userId, data.name);
    },
    onError: (err: Error) => {
      Alert.alert('Login Failed', err.message);
    },
  });

  const isPhoneValid = /^01[016789]-?\d{3,4}-?\d{4}$/.test(phone);
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const canSubmit = method === 'phone' ? isPhoneValid : isEmailValid;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>PrepaidShield</Text>
        <Text style={styles.subtitle}>RLUSD Prepaid Protection on XRPL</Text>

        {/* Role selector */}
        <View style={styles.segmentRow}>
          {(['consumer', 'business'] as UserRole[]).map((r) => (
            <TouchableOpacity
              key={r}
              style={[styles.segment, role === r && styles.segmentActive]}
              onPress={() => setRole(r)}
            >
              <Text style={[styles.segmentText, role === r && styles.segmentTextActive]}>
                {r === 'consumer' ? 'Consumer' : 'Business'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Login method selector */}
        <View style={styles.methodRow}>
          {(['phone', 'email'] as LoginMethod[]).map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.methodButton, method === m && styles.methodActive]}
              onPress={() => setMethod(m)}
            >
              <Text style={[styles.methodText, method === m && styles.methodTextActive]}>
                {m === 'phone' ? 'Phone' : 'Email'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Input fields */}
        {method === 'phone' ? (
          <>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="010-1234-5678"
              keyboardType="phone-pad"
              autoComplete="tel"
            />
          </>
        ) : (
          <>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="user@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </>
        )}

        {role === 'consumer' && (
          <>
            <Text style={styles.label}>Name (optional)</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
            />
          </>
        )}

        {/* Login button */}
        <TouchableOpacity
          style={[styles.button, (!canSubmit || loginMutation.isPending) && styles.buttonDisabled]}
          onPress={() => loginMutation.mutate()}
          disabled={!canSubmit || loginMutation.isPending}
        >
          {loginMutation.isPending ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.buttonText}>
                {role === 'consumer' ? ' Creating wallet...' : ' Logging in...'}
              </Text>
            </View>
          ) : (
            <Text style={styles.buttonText}>Login</Text>
          )}
        </TouchableOpacity>

        {role === 'consumer' && (
          <Text style={styles.hint}>
            First login auto-creates your XRPL wallet + RLUSD trust line
          </Text>
        )}
        {role === 'business' && (
          <Text style={styles.hint}>
            Business accounts must be pre-registered by admin
          </Text>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  inner: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 32, fontWeight: 'bold', textAlign: 'center', color: '#1a1a1a' },
  subtitle: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 36 },
  segmentRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  segment: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  segmentActive: { borderColor: '#4A90D9', backgroundColor: '#EBF3FB' },
  segmentText: { fontSize: 16, color: '#666' },
  segmentTextActive: { color: '#4A90D9', fontWeight: '600' },
  methodRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  methodButton: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
  },
  methodActive: { backgroundColor: '#4A90D9' },
  methodText: { fontSize: 14, color: '#666' },
  methodTextActive: { color: '#fff', fontWeight: '600' },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 4, color: '#333' },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#4A90D9',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  loadingRow: { flexDirection: 'row', alignItems: 'center' },
  hint: { fontSize: 12, color: '#999', textAlign: 'center', marginTop: 12 },
});

import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuthStore } from '../store/auth';

type UserRole = 'consumer' | 'business';

export function LoginScreen() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const [address, setAddress] = useState('');
  const [role, setRole] = useState<UserRole>('consumer');

  const handleLogin = () => {
    if (!address.startsWith('r') || address.length < 25) return;
    // Prototype: use address as userId
    setAuth(role, address, address);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>PrepaidShield</Text>
      <Text style={styles.subtitle}>Prepaid Payment Protection on XRPL</Text>

      <View style={styles.roleRow}>
        {(['consumer', 'business'] as UserRole[]).map((r) => (
          <TouchableOpacity
            key={r}
            style={[styles.roleButton, role === r && styles.roleActive]}
            onPress={() => setRole(r)}
          >
            <Text style={[styles.roleText, role === r && styles.roleTextActive]}>
              {r === 'consumer' ? 'Consumer' : 'Business'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>XRPL Address</Text>
      <TextInput
        style={styles.input}
        value={address}
        onChangeText={setAddress}
        placeholder="rXXXXXXXX..."
        autoCapitalize="none"
      />

      <TouchableOpacity
        style={[styles.button, !address && styles.buttonDisabled]}
        onPress={handleLogin}
        disabled={!address}
      >
        <Text style={styles.buttonText}>Enter</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 32, fontWeight: 'bold', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 40 },
  roleRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  roleButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  roleActive: { borderColor: '#4A90D9', backgroundColor: '#EBF3FB' },
  roleText: { fontSize: 16, color: '#666' },
  roleTextActive: { color: '#4A90D9', fontWeight: '600' },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#4A90D9',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

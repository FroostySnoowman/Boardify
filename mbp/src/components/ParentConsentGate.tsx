import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Keyboard,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { requestParentalConsent } from '../api/user';
import { hapticLight, hapticMedium } from '../utils/haptics';

export function isUnder13(birthdate: string | null | undefined): boolean {
  if (!birthdate) return false;
  const birth = new Date(birthdate);
  const today = new Date();
  const age = today.getFullYear() - birth.getFullYear() -
    ((today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) ? 1 : 0);
  return age < 13;
}

export function needsParentalConsent(user: { birthdate?: string | null; parentalConsentAt?: string | null } | null): boolean {
  if (!user?.birthdate) return false;
  if (user.parentalConsentAt) return false;
  return isUnder13(user.birthdate);
}

export default function ParentConsentGate() {
  const { user, refreshUser } = useAuth();
  const [parentEmail, setParentEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    const email = parentEmail.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      Alert.alert('Invalid email', 'Please enter a valid parent or guardian email address.');
      return;
    }
    Keyboard.dismiss();
    hapticMedium();
    setSending(true);
    try {
      await requestParentalConsent(email);
      setSent(true);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not send email. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleCheckAgain = async () => {
    hapticLight();
    await refreshUser();
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={[styles.iconWrap, styles.iconWrapSafety]}>
          <Feather name="shield" size={44} color="#34d399" />
        </View>
        <Text style={styles.title}>Parent or guardian consent needed</Text>
        {!sent ? (
          <>
            <Text style={styles.message}>
              Because you're under 13, a parent or legal guardian must agree to our Terms of Service and Privacy Policy before you can use the app. We'll send them an email with a link to confirm.
            </Text>
            <TextInput
              value={parentEmail}
              onChangeText={setParentEmail}
              placeholder="Parent or guardian's email"
              placeholderTextColor="#64748b"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
              editable={!sending}
            />
            <TouchableOpacity
              onPress={handleSend}
              disabled={sending}
              activeOpacity={0.8}
              style={[styles.primaryButton, sending && styles.primaryButtonDisabled]}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.primaryButtonText}>Send link to parent</Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.message}>
              We've sent an email to {parentEmail.trim()}. Your parent or guardian needs to click the link in that email to agree. When they've done that, you can use the app.
            </Text>
            <TouchableOpacity onPress={handleCheckAgain} style={styles.secondaryButton}>
              <Feather name="refresh-cw" size={18} color="#60a5fa" />
              <Text style={styles.secondaryButtonText}>I've done it — check again</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    maxWidth: 400,
    width: '100%',
    padding: 28,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  iconWrapSafety: {
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  message: {
    fontSize: 15,
    lineHeight: 23,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginBottom: 24,
  },
  input: {
    width: '100%',
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    fontSize: 17,
    color: '#ffffff',
    marginBottom: 20,
  },
  primaryButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ffffff',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#60a5fa',
  },
});

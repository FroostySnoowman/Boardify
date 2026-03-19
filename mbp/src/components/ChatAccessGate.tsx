import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
  ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { BirthdatePicker } from './BirthdatePicker';
import { useAuth } from '../contexts/AuthContext';
import { updateUserProfile } from '../api/user';
import { hapticLight, hapticMedium } from '../utils/haptics';
import { formatBirthdateForApi } from '../utils/birthdate';

export type ChatBlockReason = 'birthdate' | 'parental';

const defaultBirthdate = (() => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 20);
  return d;
})();

export function useChatAccess(): { canChat: boolean; reason: ChatBlockReason | null } {
  const { user } = useAuth();
  const canChat = !!(user?.birthdate && !user?.chatDisabled);
  const reason: ChatBlockReason | null = !user?.birthdate
    ? 'birthdate'
    : user?.chatDisabled
      ? 'parental'
      : null;
  return { canChat, reason };
}

export function ChatBlockScreen({ reason }: { reason: ChatBlockReason }) {
  const { user, setUserContext } = useAuth();
  const [birthdate, setBirthdate] = useState<Date>(defaultBirthdate);
  const [showPicker, setShowPicker] = useState(Platform.OS === 'ios');
  const [saving, setSaving] = useState(false);
  const [showWhy, setShowWhy] = useState(false);

  const goToSettings = () => {
    hapticLight();
    router.push('/settings');
  };

  const handleSaveBirthdate = async () => {
    hapticMedium();
    setSaving(true);
    try {
      const formatted = formatBirthdateForApi(birthdate);
      await updateUserProfile({ birthdate: formatted });
      if (user) {
        setUserContext({ ...user, birthdate: formatted });
      }
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const isBirthdate = reason === 'birthdate';
  const icon = isBirthdate ? 'shield' : 'lock';

  if (reason === 'parental') {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <View style={[styles.iconWrap, styles.iconWrapSafety]}>
            <Feather name={icon} size={40} color="#94a3b8" />
          </View>
          <Text style={styles.title}>Chat is disabled</Text>
          <Text style={styles.message}>
            A parent or guardian has turned off chat for this account. To turn it back on, they need to enter the parental PIN in Settings.
          </Text>
          <TouchableOpacity onPress={goToSettings} activeOpacity={0.8} style={styles.button}>
            <Text style={styles.buttonText}>Open Settings</Text>
            <Feather name="chevron-right" size={18} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.card}>
        <View style={[styles.iconWrap, styles.iconWrapSafety]}>
          <Feather name={icon} size={44} color="#34d399" />
        </View>
        <Text style={styles.title}>One quick step to use chat</Text>
        <Text style={styles.message}>
          We ask for your birth date so we can keep the app safe for everyone and meet rules that protect young people. We use it only for safety and access—never for ads or marketing.
        </Text>

        <TouchableOpacity
          onPress={() => { hapticLight(); setShowPicker(true); }}
          activeOpacity={0.8}
          style={styles.dateButton}
        >
          <Feather name="calendar" size={20} color="#60a5fa" />
          <Text style={styles.dateButtonText}>
            {birthdate.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
          </Text>
          <Feather name="chevron-down" size={18} color="#94a3b8" />
        </TouchableOpacity>

        {showPicker && (
          <View style={styles.pickerWrap}>
            {(Platform.OS === 'ios' || Platform.OS === 'web') && (
              <View style={styles.pickerHeader}>
                <TouchableOpacity onPress={() => setShowPicker(false)} style={styles.pickerDone}>
                  <Text style={styles.pickerDoneText}>Done</Text>
                </TouchableOpacity>
              </View>
            )}
            <BirthdatePicker
              value={birthdate}
              onChange={(date) => {
                setBirthdate(date);
                if (Platform.OS === 'android' || Platform.OS === 'web') setShowPicker(false);
              }}
              style={Platform.OS === 'android' ? undefined : styles.picker}
            />
          </View>
        )}

        <TouchableOpacity
          onPress={() => { hapticLight(); setShowWhy(!showWhy); }}
          style={styles.whyRow}
        >
          <Feather name="info" size={16} color="#60a5fa" />
          <Text style={styles.whyLabel}>{showWhy ? 'Hide' : 'Why we ask'}</Text>
          <Feather name={showWhy ? 'chevron-up' : 'chevron-down'} size={16} color="#94a3b8" />
        </TouchableOpacity>
        {showWhy && (
          <View style={styles.whyBox}>
            <Text style={styles.whyText}>
              Many countries require apps that offer chat to take steps to protect minors. Asking for a birth date helps us apply the right safeguards and lets parents control chat with a PIN. We don’t use this for advertising or to identify you to third parties.
            </Text>
          </View>
        )}

        <TouchableOpacity
          onPress={handleSaveBirthdate}
          disabled={saving}
          activeOpacity={0.8}
          style={[styles.primaryButton, saving && styles.primaryButtonDisabled]}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <>
              <Text style={styles.primaryButtonText}>Save and continue</Text>
              <Feather name="check" size={18} color="#ffffff" />
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={goToSettings} style={styles.settingsLink}>
          <Text style={styles.settingsLinkText}>Set or change in Settings instead</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
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
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    paddingVertical: 40,
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
    backgroundColor: 'rgba(255,255,255,0.08)',
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
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    marginBottom: 16,
  },
  dateButtonText: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: '#ffffff',
  },
  pickerWrap: {
    width: '100%',
    marginBottom: 16,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 8,
  },
  pickerDone: {
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  pickerDoneText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#60a5fa',
  },
  picker: {
    height: 160,
    backgroundColor: 'transparent',
  },
  whyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'stretch',
    marginBottom: 8,
    paddingVertical: 8,
  },
  whyLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#60a5fa',
    flex: 1,
  },
  whyBox: {
    alignSelf: 'stretch',
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(96, 165, 250, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.15)',
    marginBottom: 24,
  },
  whyText: {
    fontSize: 13,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.75)',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 14,
    backgroundColor: '#22c55e',
    marginBottom: 16,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ffffff',
  },
  settingsLink: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  settingsLinkText: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '500',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#3b82f6',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});

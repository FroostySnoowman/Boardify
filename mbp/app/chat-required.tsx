import React, { useState } from 'react';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BirthdatePicker } from '../src/components/BirthdatePicker';
import { useAuth } from '../src/contexts/AuthContext';
import { updateUserProfile } from '../src/api/user';
import { hapticLight, hapticMedium } from '../src/utils/haptics';
import { formatBirthdateForApi } from '../src/utils/birthdate';
import type { ChatBlockReason } from '../src/components/ChatAccessGate';

const BACKGROUND_COLOR = '#020617';

const defaultBirthdate = (() => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 20);
  return d;
})();

export default function ChatRequiredScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ reason?: string }>();
  const reason = (params.reason === 'parental' ? 'parental' : 'birthdate') as ChatBlockReason;
  const { user, setUserContext } = useAuth();
  const [birthdate, setBirthdate] = useState<Date>(defaultBirthdate);
  const [showPicker, setShowPicker] = useState(Platform.OS === 'ios');
  const [saving, setSaving] = useState(false);

  const isBirthdate = reason === 'birthdate';
  const title = isBirthdate ? 'Birth date required' : 'Chat disabled';
  const message = isBirthdate
    ? 'To use chat we need your birth date (for safety and compliance). You can set it below or in Settings.'
    : 'Chat is disabled by your parent or guardian. To turn chat back on, they need to enter the parental PIN in Settings.';

  const handleSaveBirthdate = async () => {
    hapticMedium();
    setSaving(true);
    try {
      const formatted = formatBirthdateForApi(birthdate);
      await updateUserProfile({ birthdate: formatted });
      if (user) {
        setUserContext({ ...user, birthdate: formatted });
      }
      hapticLight();
      router.back();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenSettings = () => {
    hapticLight();
    router.back();
    setTimeout(() => router.push('/settings'), 100);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen>
        <Stack.Header
          style={(Platform.OS === 'android' || Platform.OS === 'web') ? { backgroundColor: BACKGROUND_COLOR } : undefined}
         />
          <Stack.Screen.Title style={{ fontWeight: '800', color: '#ffffff' }}>
            {title}
          </Stack.Screen.Title>
          <Stack.Toolbar placement="left">
            <Stack.Toolbar.Button
              icon="xmark"
              onPress={() => router.back()}
              tintColor="#ffffff"
            />
          </Stack.Toolbar>
      </Stack.Screen>

      <LinearGradient
        colors={['rgba(96, 165, 250, 0.18)', 'rgba(34, 197, 94, 0.14)', 'rgba(2, 6, 23, 0.95)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 16,
          flexGrow: 1,
          justifyContent: 'center',
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <View style={[styles.iconWrap, isBirthdate ? styles.iconWrapSafety : styles.iconWrapLock]}>
            <Feather name={isBirthdate ? 'shield' : 'lock'} size={44} color={isBirthdate ? '#34d399' : '#94a3b8'} />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          {isBirthdate ? (
            <>
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
                  {Platform.OS === 'ios' && (
                    <View style={styles.pickerHeader}>
                      <TouchableOpacity onPress={() => setShowPicker(false)} style={styles.pickerDone}>
                        <Text style={styles.pickerDoneText}>Done</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  {Platform.OS === 'web' && (
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
            </>
          ) : null}

          <TouchableOpacity onPress={handleOpenSettings} style={styles.settingsLink}>
            <Text style={styles.settingsLinkText}>
              {isBirthdate ? 'Set or change in Settings instead' : 'Open Settings'}
            </Text>
            <Feather name="chevron-right" size={18} color="#60a5fa" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
  },
  card: {
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
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
  iconWrapLock: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 12,
    textAlign: 'center',
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
    paddingVertical: 8,
  },
  pickerDone: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  pickerDoneText: {
    color: '#60a5fa',
    fontSize: 16,
    fontWeight: '600',
  },
  picker: {
    height: 180,
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
    backgroundColor: 'rgba(34, 197, 94, 0.9)',
    marginBottom: 16,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
  settingsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  settingsLinkText: {
    color: '#60a5fa',
    fontSize: 15,
    fontWeight: '500',
  },
});

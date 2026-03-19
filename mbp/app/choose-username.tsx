import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  Keyboard,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { BirthdatePicker } from '../src/components/BirthdatePicker';

import { updateUserProfile, markOnboardingComplete } from '../src/api/user';
import { useAuth } from '../src/contexts/AuthContext';
import { hapticLight, hapticMedium } from '../src/utils/haptics';
import { formatBirthdateForApi } from '../src/utils/birthdate';

const isGlassAvailable = isLiquidGlassAvailable();

const defaultBirthdate = (() => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 20);
  return d;
})();

export default function ChooseUsernameScreen() {
  const insets = useSafeAreaInsets();
  const { user, setUserContext } = useAuth();
  const inputRef = useRef<TextInput>(null);
  const [username, setUsername] = useState('');
  const [saving, setSaving] = useState(false);
  const [focused, setFocused] = useState(false);
  const [birthdate, setBirthdate] = useState<Date | null>(null);
  const [showBirthdatePicker, setShowBirthdatePicker] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  const isValid = username.trim().length >= 3 && username.trim().length <= 30;
  const charCount = username.trim().length;

  async function handleSave() {
    if (!agreeToTerms) {
      Alert.alert('Agree to terms', 'Please agree to the Terms of Service and Privacy Policy to continue.');
      return;
    }
    if (!isValid) return;
    hapticMedium();
    Keyboard.dismiss();
    setSaving(true);
    try {
      await updateUserProfile({
        username: username.trim(),
        birthdate: birthdate ? formatBirthdateForApi(birthdate) : null,
      });
      markOnboardingComplete().catch(() => {});
      hapticMedium();
      if (user) {
        setUserContext({
          ...user,
          username: username.trim(),
          birthdate: birthdate ? formatBirthdateForApi(birthdate) : null,
        });
      }
      router.replace('/(tabs)');
    } catch (error) {
      setSaving(false);
      Alert.alert(
        'Could not set username',
        error instanceof Error ? error.message : 'Please try again.',
      );
    }
  }

  function handleSkip() {
    if (!agreeToTerms) {
      Alert.alert('Agree to terms', 'Please agree to the Terms of Service and Privacy Policy to continue.');
      return;
    }
    hapticLight();
    markOnboardingComplete().catch(() => {});
    router.replace('/(tabs)');
  }

  function onBirthdateChange(date: Date) {
    setBirthdate(date);
    if (Platform.OS === 'android' || Platform.OS === 'web') {
      setShowBirthdatePicker(false);
    }
  }

  const renderInputContent = () => (
    <View style={styles.inputInner}>
      <View style={styles.inputRow}>
        <Feather
          name="at-sign"
          size={18}
          color={focused ? '#60a5fa' : 'rgba(255,255,255,0.4)'}
          style={{ marginRight: 10 }}
        />
        <TextInput
          ref={inputRef}
          value={username}
          onChangeText={setUsername}
          placeholder="username"
          placeholderTextColor="rgba(255,255,255,0.25)"
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          maxLength={30}
          returnKeyType="done"
          onSubmitEditing={isValid ? handleSave : undefined}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          editable={!saving}
        />
      </View>
      <View style={styles.inputMeta}>
        <Text style={[styles.charCount, charCount > 0 && charCount < 3 && styles.charCountWarn]}>
          {charCount > 0 ? `${charCount}/30` : '3-30 characters'}
        </Text>
      </View>
    </View>
  );

  const renderSaveContent = () => (
    <View style={styles.saveInner}>
      {saving ? (
        <ActivityIndicator size="small" color="#ffffff" />
      ) : (
        <>
          <Text style={[styles.saveText, !isValid && styles.saveTextDisabled]}>Set Username</Text>
          <Feather name="arrow-right" size={18} color={isValid ? '#ffffff' : 'rgba(255,255,255,0.4)'} />
        </>
      )}
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.skipContainer}>
        {isGlassAvailable ? (
          <GlassView style={styles.skipGlass} isInteractive tintColor="rgba(255, 255, 255, 0.08)">
            <TouchableOpacity onPress={handleSkip} activeOpacity={0.7} style={styles.skipTouchable}>
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
          </GlassView>
        ) : (
          <TouchableOpacity onPress={handleSkip} activeOpacity={0.7} style={styles.skipFallback}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      >
        <View style={styles.content}>
        <View style={styles.iconContainer}>
          {isGlassAvailable ? (
            <GlassView style={styles.glassIcon} tintColor="rgba(255, 255, 255, 0.08)">
              <Feather name="user" size={32} color="rgba(255,255,255,0.9)" />
            </GlassView>
          ) : (
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.15)', 'rgba(255, 255, 255, 0.08)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.fallbackIcon}
            >
              <Feather name="user" size={32} color="rgba(255,255,255,0.9)" />
            </LinearGradient>
          )}
        </View>

        <Text style={styles.title}>Choose a Username</Text>
        <Text style={styles.subtitle}>
          Pick a unique name that other players will see.{'\n'}You can always change it later.
        </Text>

        <View style={styles.inputWrapper}>
          {isGlassAvailable ? (
            <GlassView style={styles.inputGlass} isInteractive tintColor="rgba(255, 255, 255, 0.08)">
              {renderInputContent()}
            </GlassView>
          ) : (
            <View style={styles.inputFallback}>
              {renderInputContent()}
            </View>
          )}
        </View>

        <View style={styles.birthdateWrapper}>
          {isGlassAvailable ? (
            <GlassView style={styles.birthdateGlass} isInteractive tintColor="rgba(255, 255, 255, 0.08)">
              <TouchableOpacity
                onPress={() => {
                  hapticLight();
                  setShowBirthdatePicker(true);
                }}
                activeOpacity={0.7}
                style={styles.birthdateTouchable}
              >
                <Feather name="calendar" size={18} color="rgba(255,255,255,0.4)" style={{ marginRight: 10 }} />
                <Text style={styles.birthdateLabel}>
                  {birthdate ? birthdate.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'Birth date (optional)'}
                </Text>
                {birthdate ? (
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation();
                      hapticLight();
                      setBirthdate(null);
                    }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={styles.birthdateClear}
                  >
                    <Feather name="x-circle" size={20} color="rgba(255,255,255,0.5)" />
                  </TouchableOpacity>
                ) : (
                  <Feather name="chevron-right" size={18} color="rgba(255,255,255,0.3)" />
                )}
              </TouchableOpacity>
            </GlassView>
          ) : (
            <TouchableOpacity
              onPress={() => {
                hapticLight();
                setShowBirthdatePicker(true);
              }}
              activeOpacity={0.7}
              style={styles.birthdateFallback}
            >
              <Feather name="calendar" size={18} color="rgba(255,255,255,0.4)" style={{ marginRight: 10 }} />
              <Text style={styles.birthdateLabel}>
                {birthdate ? birthdate.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'Birth date (optional)'}
              </Text>
              {birthdate ? (
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    hapticLight();
                    setBirthdate(null);
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={styles.birthdateClear}
                >
                  <Feather name="x-circle" size={20} color="rgba(255,255,255,0.5)" />
                </TouchableOpacity>
              ) : (
                <Feather name="chevron-right" size={18} color="rgba(255,255,255,0.3)" />
              )}
            </TouchableOpacity>
          )}
        </View>
        {showBirthdatePicker && (
          <View style={styles.birthdatePickerContainer}>
            {(Platform.OS === 'ios' || Platform.OS === 'web') && (
              <View style={styles.birthdatePickerHeader}>
                <TouchableOpacity onPress={() => setShowBirthdatePicker(false)} style={styles.birthdatePickerDone}>
                  <Text style={styles.birthdatePickerDoneText}>Done</Text>
                </TouchableOpacity>
              </View>
            )}
            <BirthdatePicker
              value={birthdate ?? defaultBirthdate}
              onChange={onBirthdateChange}
              style={Platform.OS === 'android' ? undefined : styles.birthdatePicker}
            />
          </View>
        )}

        <View style={styles.saveWrapper}>
          {isGlassAvailable ? (
            <GlassView
              style={[styles.saveGlass, (!isValid || !agreeToTerms || saving) && styles.saveDisabled]}
              isInteractive
              tintColor="rgba(96, 165, 250, 0.25)"
            >
              <TouchableOpacity
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.8}
                style={styles.saveTouchable}
              >
                {renderSaveContent()}
              </TouchableOpacity>
            </GlassView>
          ) : (
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.8}
              style={[styles.saveFallbackOuter, (!isValid || !agreeToTerms || saving) && styles.saveDisabled]}
            >
              <LinearGradient
                colors={isValid ? ['#3b82f6', '#06b6d4'] : ['#334155', '#1e293b']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.saveFallbackGradient}
              >
                {renderSaveContent()}
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
        </View>

        <TouchableOpacity
          onPress={() => { hapticLight(); setAgreeToTerms(!agreeToTerms); }}
          activeOpacity={0.7}
          style={styles.termsRow}
        >
          <View style={styles.checkboxTouch}>
            <Feather name={agreeToTerms ? 'check-square' : 'square'} size={22} color={agreeToTerms ? '#60a5fa' : 'rgba(255,255,255,0.4)'} />
          </View>
          <View style={styles.termsTextRow}>
            <Text style={styles.termsText}>I agree to the </Text>
            <TouchableOpacity onPress={() => { hapticLight(); router.push({ pathname: '/legal', params: { tab: 'tos' } }); }} activeOpacity={0.7}>
              <Text style={styles.termsLink}>Terms of Service</Text>
            </TouchableOpacity>
            <Text style={styles.termsText}> and </Text>
            <TouchableOpacity onPress={() => { hapticLight(); router.push({ pathname: '/legal', params: { tab: 'privacy' } }); }} activeOpacity={0.7}>
              <Text style={styles.termsLink}>Privacy Policy</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
        <View style={styles.bottomHint}>
          <Text style={styles.bottomHintText}>
            You can set or change your username anytime in Settings.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
    paddingHorizontal: 24,
  },
  scrollContent: {
    flexGrow: 1,
  },

  skipContainer: {
    alignSelf: 'flex-end',
  },
  skipGlass: {
    borderRadius: 20,
  },
  skipTouchable: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipFallback: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  skipText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },

  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 20,
    minHeight: 500,
  },

  iconContainer: {
    marginBottom: 28,
  },
  glassIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginBottom: 36,
    maxWidth: 300,
  },

  inputWrapper: {
    width: '100%',
    maxWidth: 360,
    marginBottom: 12,
  },
  birthdateWrapper: {
    width: '100%',
    maxWidth: 360,
    marginBottom: 20,
  },
  birthdateGlass: {
    borderRadius: 16,
  },
  birthdateTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  birthdateFallback: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  birthdateLabel: {
    flex: 1,
    fontSize: 16,
    color: 'rgba(255,255,255,0.85)',
  },
  birthdateClear: {
    padding: 4,
  },
  birthdatePickerContainer: {
    width: '100%',
    maxWidth: 360,
    marginBottom: 16,
    marginTop: 8,
  },
  birthdatePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 8,
  },
  birthdatePickerDone: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  birthdatePickerDoneText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#60a5fa',
  },
  birthdatePicker: {
    height: 180,
    backgroundColor: 'transparent',
  },
  inputGlass: {
    borderRadius: 16,
  },
  inputFallback: {
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  inputInner: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    paddingVertical: Platform.OS === 'ios' ? 4 : 2,
  },
  inputMeta: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  charCount: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
  },
  charCountWarn: {
    color: '#f59e0b',
  },

  saveWrapper: {
    width: '100%',
    maxWidth: 360,
  },
  saveGlass: {
    borderRadius: 14,
  },
  saveTouchable: {
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  saveInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  saveText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ffffff',
  },
  saveTextDisabled: {
    color: 'rgba(255,255,255,0.4)',
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 16,
    paddingHorizontal: 8,
    flexWrap: 'wrap',
  },
  checkboxTouch: {
    padding: 4,
    marginRight: 8,
  },
  termsTextRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    flex: 1,
  },
  termsText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.65)',
  },
  termsLink: {
    fontSize: 14,
    color: '#60a5fa',
    fontWeight: '600',
  },
  saveDisabled: {
    opacity: 0.45,
  },
  saveFallbackOuter: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  saveFallbackGradient: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },

  bottomHint: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  bottomHintText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.3)',
    textAlign: 'center',
    lineHeight: 18,
  },
});

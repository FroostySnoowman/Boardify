import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  Image,
  KeyboardAvoidingView,
  Keyboard,
} from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { hapticLight } from '../utils/haptics';
import { BoardStyleActionButton } from '../components/BoardStyleActionButton';
import {
  signInWithEmail,
  signUpWithEmail,
  signInWithGoogle,
  signInWithApple,
  forgotPassword,
  verifyResetCode,
  resetPassword,
} from '../api/auth';
import { fetchCurrentUser } from '../api/auth';
import { useAuth } from '../contexts/AuthContext';
import { useNetwork } from '../contexts/NetworkContext';
import { ENV } from '../config/env';
import { isNetworkError } from '../utils/networkError';
import { useTheme } from '../theme';
import type { ThemeColors } from '../theme/colors';

function isGoogleSignInConfigured(): boolean {
  return !!(ENV.GOOGLE_OAUTH_CLIENT_ID || ENV.GOOGLE_OAUTH_CLIENT_ID_DEV);
}

const BELOW_HEADER_GAP = 10;

function createLoginStyles(colors: ThemeColors) {
  const cardShadow =
    Platform.OS === 'ios'
      ? {
          shadowColor: '#000',
          shadowOffset: { width: 5, height: 5 },
          shadowOpacity: 0.2,
          shadowRadius: 0,
        }
      : { elevation: 5 };

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.modalCreamCanvas,
    },
    flex: {
      flex: 1,
    },
    sheetFill: {
      flex: 1,
      backgroundColor: colors.modalCreamCanvas,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: 'flex-start',
      paddingHorizontal: 20,
      maxWidth: 480,
      width: '100%',
      alignSelf: 'center',
    },
    card: {
      alignSelf: 'stretch',
      backgroundColor: colors.surfaceElevated,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: colors.border,
      padding: 24,
      ...cardShadow,
    },
    helper: {
      fontSize: 15,
      lineHeight: 22,
      color: colors.textSecondary,
      marginBottom: 22,
      fontWeight: '500',
    },
    fieldLabel: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.textPrimary,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 10,
    },
    errorContainer: {
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.danger,
      borderRadius: 10,
      padding: 12,
      marginBottom: 16,
    },
    errorText: {
      color: colors.dangerText,
      fontSize: 14,
      fontWeight: '600',
    },
    inputContainer: {
      position: 'relative',
      marginBottom: 16,
    },
    input: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.textPrimary,
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 14,
      backgroundColor: colors.modalCreamCanvas,
      minHeight: 48,
    },
    inputWithEye: {
      paddingRight: 48,
    },
    codeInput: {
      textAlign: 'center',
      letterSpacing: 8,
      fontSize: 24,
      fontWeight: '700',
    },
    eyeButton: {
      position: 'absolute',
      right: 12,
      top: 14,
      padding: 4,
    },
    strengthContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 16,
    },
    strengthBar: {
      flex: 1,
      height: 8,
      backgroundColor: colors.divider,
      borderRadius: 4,
      overflow: 'hidden',
    },
    strengthFill: {
      height: '100%',
      borderRadius: 4,
    },
    strengthText: {
      fontSize: 14,
      fontWeight: '600',
      width: 60,
      textAlign: 'right',
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginTop: 8,
      gap: 12,
      width: '100%',
      overflow: 'hidden',
      paddingBottom: 11,
    },
    labelPrimaryDisabled: {
      color: colors.textTertiary,
    },
    divider: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: 20,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.divider,
    },
    dividerText: {
      marginHorizontal: 16,
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    socialStack: {
      width: '100%',
      gap: 12,
      marginBottom: 8,
    },
    socialIcon: {
      width: 20,
      height: 20,
    },
    switchButton: {
      marginTop: 12,
    },
    switchText: {
      color: colors.textSecondary,
      fontSize: 14,
      textAlign: 'center',
    },
    switchLink: {
      color: colors.successEmphasis,
      fontWeight: '700',
    },
    linkText: {
      color: colors.successEmphasis,
      fontSize: 14,
      textAlign: 'center',
      fontWeight: '600',
    },
    resetHint: {
      color: colors.dangerText,
      fontSize: 12,
      textAlign: 'center',
      marginBottom: 16,
      fontWeight: '600',
    },
    successIconWrap: {
      alignItems: 'center',
      marginBottom: 16,
    },
    successIconCircle: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.successTrack,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    resetOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.modalCreamCanvas,
      zIndex: 100,
    },
    resetScrollContent: {
      flexGrow: 1,
      paddingHorizontal: 20,
      maxWidth: 480,
      width: '100%',
      alignSelf: 'center',
    },
  });
}

export default function LoginScreen() {
  const { colors, resolvedScheme } = useTheme();
  const styles = useMemo(() => createLoginStyles(colors), [colors]);
  const appleIconSource = useMemo(
    () =>
      resolvedScheme === 'dark'
        ? require('../../assets/apple-white.png')
        : require('../../assets/apple-black.png'),
    [resolvedScheme]
  );
  const { setUserContext } = useAuth();
  const { isOnline } = useNetwork();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();

  const navigateToHome = () => {
    router.replace('/');
  };
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<'Weak' | 'Medium' | 'Strong' | ''>('');

  const [resetStep, setResetStep] = useState<'none' | 'email' | 'code' | 'newPassword' | 'success'>('none');
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const resendTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (resendCooldown <= 0) {
      if (resendTimerRef.current) {
        clearInterval(resendTimerRef.current);
        resendTimerRef.current = null;
      }
      return;
    }
    resendTimerRef.current = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) {
          if (resendTimerRef.current) clearInterval(resendTimerRef.current);
          resendTimerRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (resendTimerRef.current) clearInterval(resendTimerRef.current);
    };
  }, [resendCooldown > 0]);

  function evaluateStrength(pw: string) {
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    if (score <= 1) return 'Weak';
    if (score <= 3) return 'Medium';
    return 'Strong';
  }

  async function handleSubmit() {
    setError('');
    setLoading(true);
    try {
      if (isRegister) {
        if (password !== confirmPassword) {
          setError('Passwords do not match');
          setLoading(false);
          return;
        }
        await signUpWithEmail(email, password);
        const newUser = await fetchCurrentUser();
        setUserContext(newUser);
        router.replace('/verify-email');
      } else {
        await signInWithEmail(email, password);
        const user = await fetchCurrentUser();
        setUserContext(user);
        if (user.emailVerified === false) {
          router.replace('/verify-email');
        } else {
          navigateToHome();
        }
      }
    } catch (err: unknown) {
      const message = isNetworkError(err)
        ? "You're offline. Sign in when you're back online."
        : err instanceof Error ? err.message : 'Authentication failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError('');
    setLoading(true);
    try {
      await signInWithGoogle();
      if (Platform.OS === 'web') {
        return;
      }
      const user = await fetchCurrentUser();
      setUserContext(user);
      navigateToHome();
    } catch (err: unknown) {
      const message = isNetworkError(err)
        ? "You're offline. Sign in when you're back online."
        : err instanceof Error ? err.message : 'Google sign-in failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleApple() {
    setError('');
    setLoading(true);
    try {
      await signInWithApple();
      if (Platform.OS === 'web') {
        return;
      }
      const user = await fetchCurrentUser();
      setUserContext(user);
      navigateToHome();
    } catch (err: unknown) {
      const message = isNetworkError(err)
        ? "You're offline. Sign in when you're back online."
        : err instanceof Error ? err.message : 'Apple sign-in failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotSendCode() {
    setResetError('');
    setResetLoading(true);
    try {
      await forgotPassword(resetEmail);
      setResendCooldown(30);
      setResetStep('code');
    } catch (err: unknown) {
      setResetError(err instanceof Error ? err.message : 'Failed to send reset code');
    } finally {
      setResetLoading(false);
    }
  }

  async function handleVerifyCode() {
    setResetError('');
    setResetLoading(true);
    try {
      const token = await verifyResetCode(resetEmail, resetCode);
      setResetToken(token);
      setResetStep('newPassword');
    } catch (err: unknown) {
      setResetError(err instanceof Error ? err.message : 'Invalid code');
    } finally {
      setResetLoading(false);
    }
  }

  async function handleResetPassword() {
    setResetError('');
    if (newPassword !== confirmNewPassword) {
      setResetError('Passwords do not match');
      return;
    }
    setResetLoading(true);
    try {
      await resetPassword(resetToken, newPassword);
      setResetStep('success');
    } catch (err: unknown) {
      setResetError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setResetLoading(false);
    }
  }

  function exitResetFlow() {
    setResetStep('none');
    setResetEmail('');
    setResetCode('');
    setResetToken('');
    setNewPassword('');
    setConfirmNewPassword('');
    setResetError('');
    setResendCooldown(0);
    setShowNewPassword(false);
    setShowConfirmNewPassword(false);
  }

  const showApple = Platform.OS === 'ios';
  const signInDisabled = !isOnline || loading;
  const canSubmit =
    email.trim().length > 0 && password.length > 0 && (!isRegister || confirmPassword.length > 0);

  const screenTitle =
    resetStep !== 'none'
      ? resetStep === 'email'
        ? 'Reset password'
        : resetStep === 'code'
          ? 'Enter code'
          : resetStep === 'newPassword'
            ? 'New password'
            : 'Password reset'
      : isRegister
        ? 'Create account'
        : 'Sign in';

  const toolbarClose = () => {
    hapticLight();
    Keyboard.dismiss();
    if (resetStep !== 'none') {
      if (resetStep === 'code') setResetStep('email');
      else if (resetStep === 'newPassword') setResetStep('code');
      else exitResetFlow();
      return;
    }
    router.back();
  };

  const cancelPress = () => {
    hapticLight();
    Keyboard.dismiss();
    exitResetFlow();
    router.back();
  };

  return (
    <View style={styles.container}>
      <Stack.Screen>
        <Stack.Header
          style={
            Platform.OS === 'ios'
              ? { backgroundColor: 'transparent' }
              : { backgroundColor: colors.modalCreamCanvas }
          }
        />
        <Stack.Screen.Title style={{ fontWeight: '800', color: colors.modalCreamHeaderTint }}>{screenTitle}</Stack.Screen.Title>
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button icon="xmark" onPress={toolbarClose} tintColor={colors.modalCreamHeaderTint} />
        </Stack.Toolbar>
      </Stack.Screen>

      <KeyboardAvoidingView
        style={[styles.flex, styles.sheetFill]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
      >
        <ScrollView
          style={styles.sheetFill}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: headerHeight + BELOW_HEADER_GAP,
              paddingBottom: insets.bottom + 28,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <Text style={styles.helper}>
              Sign in to sync your boards across devices.
            </Text>

            {!isOnline ? (
              <View style={[styles.errorContainer, { backgroundColor: colors.offlineBanner, marginBottom: 12 }]}>
                <Text style={[styles.errorText, { color: colors.offlineBannerText }]}>
                  You're offline. Sign in when you're back online.
                </Text>
              </View>
            ) : null}

            {error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Text style={styles.fieldLabel}>Email</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor={colors.placeholder}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <Text style={styles.fieldLabel}>Password</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Your password"
                placeholderTextColor={colors.placeholder}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (text) {
                    setPasswordStrength(evaluateStrength(text));
                  } else {
                    setPasswordStrength('');
                  }
                }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
                hitSlop={8}
              >
                <Feather
                  name={showPassword ? 'eye-off' : 'eye'}
                  size={20}
                  color={colors.iconMuted}
                />
              </TouchableOpacity>
            </View>

            {isRegister && (
              <>
                <Text style={styles.fieldLabel}>Confirm password</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="Same as above"
                    placeholderTextColor={colors.placeholder}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    <Feather
                      name={showConfirmPassword ? 'eye-off' : 'eye'}
                      size={20}
                      color={colors.iconMuted}
                    />
                  </TouchableOpacity>
                </View>

                {password ? (
                  <View style={styles.strengthContainer}>
                    <View style={styles.strengthBar}>
                      <View
                        style={[
                          styles.strengthFill,
                          {
                            width:
                              passwordStrength === 'Weak'
                                ? '33%'
                                : passwordStrength === 'Medium'
                                  ? '66%'
                                  : passwordStrength === 'Strong'
                                    ? '100%'
                                    : '0%',
                            backgroundColor:
                              passwordStrength === 'Weak'
                                ? '#ef4444'
                                : passwordStrength === 'Medium'
                                  ? '#22c55e'
                                  : passwordStrength === 'Strong'
                                    ? '#22c55e'
                                    : 'transparent',
                          },
                        ]}
                      />
                    </View>
                    <Text
                      style={[
                        styles.strengthText,
                        {
                          color:
                            passwordStrength === 'Weak'
                              ? '#ef4444'
                              : passwordStrength === 'Medium'
                                ? '#22c55e'
                                : passwordStrength === 'Strong'
                                  ? '#22c55e'
                                  : colors.iconMuted,
                        },
                      ]}
                    >
                      {passwordStrength}
                    </Text>
                  </View>
                ) : null}
              </>
            )}

            {!isRegister && (
              <TouchableOpacity
                onPress={() => {
                  setResetEmail(email);
                  setResetStep('email');
                }}
                style={{ marginBottom: 16, alignSelf: 'flex-end', marginTop: -8 }}
              >
                <Text style={{ color: colors.successEmphasis, fontSize: 14, fontWeight: '600' }}>
                  Forgot Password?
                </Text>
              </TouchableOpacity>
            )}

            <View style={styles.actions}>
              <BoardStyleActionButton
                shadowColor={colors.shadowFill}
                onPress={cancelPress}
                label="Cancel"
              />
              <BoardStyleActionButton
                shadowColor={canSubmit && !signInDisabled ? colors.success : colors.shadowFill}
                onPress={() => void handleSubmit()}
                disabled={!canSubmit || signInDisabled}
                label={
                  loading
                    ? isRegister
                      ? 'Creating…'
                      : 'Signing in…'
                    : isRegister
                      ? 'Create account'
                      : 'Sign in'
                }
                labelStyle={
                  canSubmit && !signInDisabled ? {} : styles.labelPrimaryDisabled
                }
              />
            </View>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.socialStack}>
              <BoardStyleActionButton
                layout="stack"
                leading={
                  <Image source={require('../../assets/google.png')} style={styles.socialIcon} />
                }
                shadowColor={isGoogleSignInConfigured() ? colors.surfaceMuted : colors.shadowFill}
                onPress={handleGoogle}
                disabled={signInDisabled || !isGoogleSignInConfigured()}
                label={
                  isGoogleSignInConfigured()
                    ? 'Continue with Google'
                    : 'Google (not configured)'
                }
                labelStyle={
                  isGoogleSignInConfigured() && !signInDisabled
                    ? {}
                    : styles.labelPrimaryDisabled
                }
              />
              {showApple ? (
                <BoardStyleActionButton
                  layout="stack"
                  leading={
                    <Image source={appleIconSource} style={styles.socialIcon} />
                  }
                  shadowColor={colors.surfaceMuted}
                  onPress={handleApple}
                  disabled={signInDisabled}
                  label="Continue with Apple"
                  labelStyle={!signInDisabled ? {} : styles.labelPrimaryDisabled}
                />
              ) : null}
            </View>

            <TouchableOpacity
              style={styles.switchButton}
              onPress={() => {
                setError('');
                setPassword('');
                setConfirmPassword('');
                setPasswordStrength('');
                setShowPassword(false);
                setShowConfirmPassword(false);
                setIsRegister(!isRegister);
              }}
            >
              <Text style={styles.switchText}>
                {isRegister ? 'Already have an account? ' : "Don't have an account? "}
                <Text style={styles.switchLink}>
                  {isRegister ? 'Sign in' : 'Register'}
                </Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {resetStep !== 'none' && (
        <View style={styles.resetOverlay}>
          <KeyboardAvoidingView
            style={[styles.flex, styles.sheetFill]}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
          >
            <ScrollView
              contentContainerStyle={[
                styles.resetScrollContent,
                {
                  paddingTop: headerHeight + BELOW_HEADER_GAP,
                  paddingBottom: insets.bottom + 28,
                },
              ]}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.card}>
              {resetStep === 'email' && (
                <>
                  <Text style={styles.helper}>
                    Enter your email and we&apos;ll send you a 6-digit code.
                  </Text>
                  {resetError ? (
                    <View style={styles.errorContainer}>
                      <Text style={styles.errorText}>{resetError}</Text>
                    </View>
                  ) : null}
                  <Text style={styles.fieldLabel}>Email</Text>
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={styles.input}
                      placeholder="you@example.com"
                      placeholderTextColor={colors.placeholder}
                      value={resetEmail}
                      onChangeText={setResetEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoFocus
                    />
                  </View>
                  <BoardStyleActionButton
                    layout="stack"
                    shadowColor={
                      resetEmail.trim() && !resetLoading && resendCooldown === 0
                        ? colors.success
                        : colors.shadowFill
                    }
                    onPress={() => void handleForgotSendCode()}
                    disabled={!resetEmail.trim() || resetLoading || resendCooldown > 0}
                    label={
                      resetLoading
                        ? 'Sending…'
                        : resendCooldown > 0
                          ? `Send code (${resendCooldown}s)`
                          : 'Send code'
                    }
                    labelStyle={
                      resetEmail.trim() && !resetLoading && resendCooldown === 0
                        ? {}
                        : styles.labelPrimaryDisabled
                    }
                  />
                </>
              )}

              {resetStep === 'code' && (
                <>
                  <Text style={styles.helper}>
                    We sent a 6-digit code to{' '}
                    <Text style={{ fontWeight: '800', color: colors.textPrimary }}>{resetEmail}</Text>
                  </Text>
                  {resetError ? (
                    <View style={styles.errorContainer}>
                      <Text style={styles.errorText}>{resetError}</Text>
                    </View>
                  ) : null}
                  <Text style={styles.fieldLabel}>Code</Text>
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={[styles.input, styles.codeInput]}
                      placeholder="000000"
                      placeholderTextColor={colors.placeholder}
                      value={resetCode}
                      onChangeText={(t) => setResetCode(t.replace(/[^0-9]/g, '').slice(0, 6))}
                      keyboardType="number-pad"
                      maxLength={6}
                      autoFocus
                    />
                  </View>
                  <Text style={styles.resetHint}>Code expires in 15 minutes.</Text>
                  <BoardStyleActionButton
                    layout="stack"
                    shadowColor={resetCode.length === 6 && !resetLoading ? colors.success : colors.shadowFill}
                    onPress={() => void handleVerifyCode()}
                    disabled={resetCode.length !== 6 || resetLoading}
                    label={resetLoading ? 'Verifying…' : 'Verify code'}
                    labelStyle={
                      resetCode.length === 6 && !resetLoading ? {} : styles.labelPrimaryDisabled
                    }
                  />
                  <TouchableOpacity
                    onPress={() => void handleForgotSendCode()}
                    disabled={resetLoading || resendCooldown > 0}
                    style={{ marginTop: 12, opacity: resendCooldown > 0 ? 0.5 : 1 }}
                  >
                    <Text style={styles.linkText}>
                      {resendCooldown > 0 ? `Resend code (${resendCooldown}s)` : 'Resend code'}
                    </Text>
                  </TouchableOpacity>
                </>
              )}

              {resetStep === 'newPassword' && (
                <>
                  <Text style={styles.helper}>Choose a new password for your account.</Text>
                  {resetError ? (
                    <View style={styles.errorContainer}>
                      <Text style={styles.errorText}>{resetError}</Text>
                    </View>
                  ) : null}
                  <Text style={styles.fieldLabel}>New password</Text>
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={[styles.input, styles.inputWithEye]}
                      placeholder="New password"
                      placeholderTextColor={colors.placeholder}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      secureTextEntry={!showNewPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoFocus
                    />
                    <TouchableOpacity
                      style={styles.eyeButton}
                      onPress={() => setShowNewPassword(!showNewPassword)}
                      hitSlop={8}
                    >
                      <Feather name={showNewPassword ? 'eye-off' : 'eye'} size={20} color={colors.iconMuted} />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.fieldLabel}>Confirm</Text>
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={[styles.input, styles.inputWithEye]}
                      placeholder="Confirm new password"
                      placeholderTextColor={colors.placeholder}
                      value={confirmNewPassword}
                      onChangeText={setConfirmNewPassword}
                      secureTextEntry={!showConfirmNewPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <TouchableOpacity
                      style={styles.eyeButton}
                      onPress={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                      hitSlop={8}
                    >
                      <Feather name={showConfirmNewPassword ? 'eye-off' : 'eye'} size={20} color={colors.iconMuted} />
                    </TouchableOpacity>
                  </View>
                  <BoardStyleActionButton
                    layout="stack"
                    shadowColor={
                      newPassword && confirmNewPassword && !resetLoading ? colors.success : colors.shadowFill
                    }
                    onPress={() => void handleResetPassword()}
                    disabled={!newPassword || !confirmNewPassword || resetLoading}
                    label={resetLoading ? 'Saving…' : 'Save password'}
                    labelStyle={
                      newPassword && confirmNewPassword && !resetLoading
                        ? {}
                        : styles.labelPrimaryDisabled
                    }
                  />
                </>
              )}

              {resetStep === 'success' && (
                <>
                  <View style={styles.successIconWrap}>
                    <View style={styles.successIconCircle}>
                      <Feather name="check" size={32} color={colors.successEmphasis} />
                    </View>
                  </View>
                  <Text style={styles.helper}>
                    Your password was updated. Sign in with your new password.
                  </Text>
                  <BoardStyleActionButton
                    layout="stack"
                    shadowColor={colors.success}
                    onPress={exitResetFlow}
                    label="Back to sign in"
                  />
                </>
              )}
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      )}
    </View>
  );
}

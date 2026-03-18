import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
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
import { KeyboardSpacer } from '@/components/KeyboardSpacer';
import { ENV } from '../config/env';
import { isNetworkError } from '../utils/networkError';

const resetGradientColors = ['rgba(0, 6, 42, 0.5)', 'rgba(0, 0, 0, 0.3)', 'transparent'] as const;
const gradientStart = { x: 0, y: 0 } as const;
const gradientEnd = { x: 1, y: 1 } as const;

function isGoogleSignInConfigured(): boolean {
  return !!(ENV.GOOGLE_OAUTH_CLIENT_ID || ENV.GOOGLE_OAUTH_CLIENT_ID_DEV);
}

export default function LoginScreen() {
  const { setUserContext } = useAuth();
  const { isOnline } = useNetwork();

  const navigateToHome = () => {
    router.back();
  };
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<'Weak' | 'Medium' | 'Strong' | ''>('');

  // Forgot password flow
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

  // Cooldown countdown timer for resend
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

  return (
    <View style={[styles.container, { paddingTop: 0 }]}>
      <LinearGradient
        colors={['rgba(0, 6, 42, 0.5)', 'rgba(0, 0, 0, 0.3)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      >
        <View style={styles.content}>
          <View style={styles.logoContainer}>
            <Image
              source={require('../../assets/icon.png')}
              style={styles.logo}
            />
            <Text style={styles.logoText}>MyBreakPoint</Text>
            <Text style={styles.tagline}>
              The ultimate tennis & pickleball companion
            </Text>
          </View>

          <View style={styles.formContainer}>
            <Text style={styles.formTitle}>
              {isRegister ? 'Create Account' : 'Welcome Back'}
            </Text>

            {!isOnline ? (
              <View style={[styles.errorContainer, { backgroundColor: 'rgba(100, 116, 139, 0.3)', marginBottom: 12 }]}>
                <Text style={[styles.errorText, { color: '#94a3b8' }]}>
                  You're offline. Sign in when you're back online.
                </Text>
              </View>
            ) : null}

            {error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="#9ca3af"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#9ca3af"
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
              >
                <Feather
                  name={showPassword ? 'eye-off' : 'eye'}
                  size={20}
                  color="#9ca3af"
                />
              </TouchableOpacity>
            </View>

            {isRegister && (
              <>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="Confirm Password"
                    placeholderTextColor="#9ca3af"
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
                      color="#9ca3af"
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
                                  : '#9ca3af',
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
                <Text style={{ color: '#60a5fa', fontSize: 14, fontWeight: '500' }}>
                  Forgot Password?
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.submitButton, signInDisabled && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={signInDisabled}
            >
              <LinearGradient
                colors={['#22c55e', '#10b981']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.submitGradient}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.submitText}>
                    {isRegister ? 'Create Account' : 'Sign In'}
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={[
                styles.socialButton,
                !isGoogleSignInConfigured() && styles.socialButtonDisabled,
                signInDisabled && { opacity: 0.6 },
              ]}
              onPress={handleGoogle}
              disabled={signInDisabled || !isGoogleSignInConfigured()}
            >
              <Image
                source={require('../../assets/google.png')}
                style={styles.socialIcon}
              />
              <Text style={[
                styles.socialButtonText,
                !isGoogleSignInConfigured() && styles.socialButtonTextDisabled
              ]}>
                Continue with Google
                {!isGoogleSignInConfigured() && ' (Not Configured)'}
              </Text>
            </TouchableOpacity>

            {showApple && (
              <TouchableOpacity
                style={[styles.socialButton, signInDisabled && { opacity: 0.6 }]}
                onPress={handleApple}
                disabled={signInDisabled}
              >
                <Image
                  source={require('../../assets/apple.png')}
                  style={styles.socialIcon}
                />
                <Text style={styles.socialButtonText}>Continue with Apple</Text>
              </TouchableOpacity>
            )}

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
                  {isRegister ? 'Sign In' : 'Register'}
                </Text>
              </Text>
            </TouchableOpacity>

            <KeyboardSpacer extraOffset={48} />
          </View>
        </View>
      </ScrollView>

      {resetStep !== 'none' && (
        <View style={styles.resetOverlay}>
          <LinearGradient
            colors={resetGradientColors}
            start={gradientStart}
            end={gradientEnd}
            style={StyleSheet.absoluteFill}
          />
          <ScrollView
            contentContainerStyle={[styles.resetScrollContent, { paddingBottom: insets.bottom + 24 }]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          >
            <View style={[styles.formContainer, { maxWidth: 400, alignSelf: 'center', width: '100%' }]}>
              <TouchableOpacity
                onPress={() => {
                  if (resetStep === 'code') setResetStep('email');
                  else if (resetStep === 'newPassword') setResetStep('code');
                  else exitResetFlow();
                }}
                style={{ position: 'absolute', top: 16, left: 16, zIndex: 10, padding: 4 }}
              >
                <Feather
                  name={resetStep === 'email' || resetStep === 'success' ? 'x' : 'arrow-left'}
                  size={22}
                  color="#9ca3af"
                />
              </TouchableOpacity>

              {resetStep === 'email' && (
                <>
                  <Text style={styles.formTitle}>Reset Password</Text>
                  <Text style={{ color: '#9ca3af', fontSize: 14, textAlign: 'center', marginBottom: 20 }}>
                    Enter your email and we'll send you a 6-digit code.
                  </Text>
                  {resetError ? (
                    <View style={styles.errorContainer}>
                      <Text style={styles.errorText}>{resetError}</Text>
                    </View>
                  ) : null}
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={[styles.input, { letterSpacing: 0, textAlign: 'left', fontSize: 16, fontWeight: 'normal' }]}
                      placeholder="Email"
                      placeholderTextColor="#9ca3af"
                      value={resetEmail}
                      onChangeText={setResetEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoFocus
                    />
                  </View>
                  <TouchableOpacity
                    style={[styles.submitButton, (!resetEmail || resetLoading || resendCooldown > 0) && { opacity: 0.6 }]}
                    onPress={handleForgotSendCode}
                    disabled={!resetEmail || resetLoading || resendCooldown > 0}
                  >
                    <LinearGradient
                      colors={['#22c55e', '#10b981']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.submitGradient}
                    >
                      {resetLoading ? (
                        <ActivityIndicator color="#ffffff" />
                      ) : resendCooldown > 0 ? (
                        <Text style={styles.submitText}>Send Code ({resendCooldown}s)</Text>
                      ) : (
                        <Text style={styles.submitText}>Send Code</Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              )}

              {resetStep === 'code' && (
                <>
                  <Text style={styles.formTitle}>Enter Code</Text>
                  <Text style={{ color: '#9ca3af', fontSize: 14, textAlign: 'center', marginBottom: 20 }}>
                    We sent a 6-digit code to{'\n'}
                    <Text style={{ color: '#ffffff', fontWeight: '600' }}>{resetEmail}</Text>
                  </Text>
                  {resetError ? (
                    <View style={styles.errorContainer}>
                      <Text style={styles.errorText}>{resetError}</Text>
                    </View>
                  ) : null}
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={[styles.input, { textAlign: 'center', letterSpacing: 8, fontSize: 24, fontWeight: '700' }]}
                      placeholder="000000"
                      placeholderTextColor="#4b5563"
                      value={resetCode}
                      onChangeText={(t) => setResetCode(t.replace(/[^0-9]/g, '').slice(0, 6))}
                      keyboardType="number-pad"
                      maxLength={6}
                      autoFocus
                    />
                  </View>
                  <Text style={{ color: '#fbbf24', fontSize: 12, textAlign: 'center', marginBottom: 16 }}>
                    Code expires in 15 minutes
                  </Text>
                  <TouchableOpacity
                    style={[styles.submitButton, (resetCode.length !== 6 || resetLoading) && { opacity: 0.6 }]}
                    onPress={handleVerifyCode}
                    disabled={resetCode.length !== 6 || resetLoading}
                  >
                    <LinearGradient
                      colors={['#22c55e', '#10b981']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.submitGradient}
                    >
                      {resetLoading ? (
                        <ActivityIndicator color="#ffffff" />
                      ) : (
                        <Text style={styles.submitText}>Verify Code</Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleForgotSendCode}
                    disabled={resetLoading || resendCooldown > 0}
                    style={{ marginTop: 12, opacity: resendCooldown > 0 ? 0.5 : 1 }}
                  >
                    <Text style={{ color: '#60a5fa', fontSize: 14, textAlign: 'center', fontWeight: '500' }}>
                      {resendCooldown > 0 ? `Resend Code (${resendCooldown}s)` : 'Resend Code'}
                    </Text>
                  </TouchableOpacity>
                </>
              )}

              {resetStep === 'newPassword' && (
                <>
                  <Text style={styles.formTitle}>New Password</Text>
                  <Text style={{ color: '#9ca3af', fontSize: 14, textAlign: 'center', marginBottom: 20 }}>
                    Choose a new password for your account.
                  </Text>
                  {resetError ? (
                    <View style={styles.errorContainer}>
                      <Text style={styles.errorText}>{resetError}</Text>
                    </View>
                  ) : null}
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={[styles.input, { letterSpacing: 0, textAlign: 'left', fontSize: 16, fontWeight: 'normal', paddingRight: 48 }]}
                      placeholder="New Password"
                      placeholderTextColor="#9ca3af"
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
                      <Feather name={showNewPassword ? 'eye-off' : 'eye'} size={20} color="#9ca3af" />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={[styles.input, { letterSpacing: 0, textAlign: 'left', fontSize: 16, fontWeight: 'normal', paddingRight: 48 }]}
                      placeholder="Confirm New Password"
                      placeholderTextColor="#9ca3af"
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
                      <Feather name={showConfirmNewPassword ? 'eye-off' : 'eye'} size={20} color="#9ca3af" />
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    style={[styles.submitButton, (!newPassword || !confirmNewPassword || resetLoading) && { opacity: 0.6 }]}
                    onPress={handleResetPassword}
                    disabled={!newPassword || !confirmNewPassword || resetLoading}
                  >
                    <LinearGradient
                      colors={['#22c55e', '#10b981']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.submitGradient}
                    >
                      {resetLoading ? (
                        <ActivityIndicator color="#ffffff" />
                      ) : (
                        <Text style={styles.submitText}>Reset Password</Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              )}

              {resetStep === 'success' && (
                <>
                  <View style={{ alignItems: 'center', marginBottom: 16 }}>
                    <View style={{
                      width: 64, height: 64, borderRadius: 32,
                      backgroundColor: 'rgba(34, 197, 94, 0.2)',
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Feather name="check" size={32} color="#22c55e" />
                    </View>
                  </View>
                  <Text style={styles.formTitle}>Password Reset!</Text>
                  <Text style={{ color: '#9ca3af', fontSize: 14, textAlign: 'center', marginBottom: 24 }}>
                    Your password has been updated. Sign in with your new password.
                  </Text>
                  <TouchableOpacity
                    style={styles.submitButton}
                    onPress={exitResetFlow}
                  >
                    <LinearGradient
                      colors={['#22c55e', '#10b981']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.submitGradient}
                    >
                      <Text style={styles.submitText}>Back to Sign In</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  content: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 16,
    marginBottom: 16,
  },
  logoText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
  },
  formContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 24,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 24,
  },
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.3)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 14,
    fontWeight: '500',
  },
  inputContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#ffffff',
    fontSize: 16,
    minHeight: 48,
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
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
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
  submitButton: {
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  submitGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  submitText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  dividerText: {
    marginHorizontal: 16,
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '500',
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    paddingVertical: 14,
    marginBottom: 12,
    minHeight: 52,
  },
  socialButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  socialButtonDisabled: {
    opacity: 0.5,
  },
  socialButtonTextDisabled: {
    color: '#9ca3af',
  },
  socialIcon: {
    width: 20,
    height: 20,
  },
  switchButton: {
    marginTop: 8,
  },
  switchText: {
    color: '#9ca3af',
    fontSize: 14,
    textAlign: 'center',
  },
  switchLink: {
    color: '#4ade80',
    fontWeight: '600',
  },
  resetOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#020617',
    zIndex: 100,
  },
  resetScrollContent: {
    flexGrow: 1,
    justifyContent: 'center' as const,
    paddingHorizontal: 16,
  },
});

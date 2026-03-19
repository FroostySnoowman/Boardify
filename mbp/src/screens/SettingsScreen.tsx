import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, Platform, Linking } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { getUserProfile, updateUserPreferences, updateUserProfile } from '../api/user';
import { hapticLight, hapticMedium } from '../utils/haptics';
import { Skeleton } from '../components/Skeleton';
import { signOut } from '../api/auth';
import { submitBugReport, submitSuggestion } from '../api/feedback';
import { ENV } from '../config/env';
import { KeyboardSpacer } from '@/components/KeyboardSpacer';
import { useSubscription } from '../contexts/SubscriptionContext';
import { createPortalSession, getSubscriptionStatus, resetSandboxSubscription, verifyPurchase } from '../api/subscriptions';
import { isUserCancelledPurchaseError } from '../utils/iap';
import PaywallScreen from './PaywallScreen';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
      gestureEnabled: false,
    });
  }, [navigation]);
  const { logout: contextLogout, setUserContext } = useAuth();
  const { isPlus, platform: subPlatform, environment: subEnvironment, refresh: refreshSubscription } = useSubscription();
  const [showPaywall, setShowPaywall] = useState(false);
  const [restoringPurchases, setRestoringPurchases] = useState(false);
  const [checkingSandboxSubscription, setCheckingSandboxSubscription] = useState(false);
  const [resettingSandboxSubscription, setResettingSandboxSubscription] = useState(false);
  const [hasSandboxSubscription, setHasSandboxSubscription] = useState(false);
  const [mode, setMode] = useState<'tennis' | 'pickleball' | undefined>(undefined);
  const [statProfile, setStatProfile] = useState<'basic' | 'intermediate' | 'advanced' | undefined>(undefined);
  const [user, setUser] = useState<any | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [editingEmail, setEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [editingPassword, setEditingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [feedbackType, setFeedbackType] = useState<'bug' | 'suggestion'>('bug');
  const [feedbackText, setFeedbackText] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [feedbackCooldownUntil, setFeedbackCooldownUntil] = useState<number | null>(null);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackCooldownSeconds, setFeedbackCooldownSeconds] = useState<number>(0);
  const [isOAuthUser, setIsOAuthUser] = useState(false);

  useEffect(() => {
    if (feedbackCooldownUntil == null) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((feedbackCooldownUntil - Date.now()) / 1000));
      setFeedbackCooldownSeconds(left);
      if (left <= 0) {
        setFeedbackCooldownUntil(null);
        setSubmitted(false);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [feedbackCooldownUntil]);

  useEffect(() => {
    setLoadingUser(true);
    getUserProfile()
      .then(u => {
        setUser(u);
        setNewEmail(u.email);
        setMode(u.mode);
        setStatProfile(u.statProfile ?? 'intermediate');
      })
      .catch(() => { })
      .finally(() => setLoadingUser(false));
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const params = new URLSearchParams(window.location.search);
    const result = params.get('subscription');
    if (!result) return;

    if (result === 'success') {
      let attempts = 0;
      const maxAttempts = 10;
      const poll = async () => {
        attempts += 1;
        await refreshSubscription();
        const latest = await getSubscriptionStatus();
        if (latest.status === 'plus' || latest.status === 'plus_grace') {
          router.replace('/?plusWelcome=1');
          return;
        }
        if (attempts >= maxAttempts) {
          const cleanUrl = `${window.location.pathname}${window.location.hash || ''}`;
          window.history.replaceState({}, '', cleanUrl);
          return;
        }
        setTimeout(poll, 1500);
      };
      poll();
      return;
    }

    if (result === 'cancelled') {
      router.replace('/');
      return;
    }

    const cleanUrl = `${window.location.pathname}${window.location.hash || ''}`;
    window.history.replaceState({}, '', cleanUrl);
  }, [refreshSubscription]);

  const refreshSandboxSubscriptionState = useCallback(async () => {
    if (Platform.OS !== 'ios') {
      setHasSandboxSubscription(false);
      return;
    }
    setCheckingSandboxSubscription(true);
    try {
      const latest = await getSubscriptionStatus({ includeSandbox: true });
      const isSandboxPlus =
        (latest.status === 'plus' || latest.status === 'plus_grace') &&
        latest.platform === 'ios' &&
        latest.environment !== 'Production';
      setHasSandboxSubscription(isSandboxPlus);
    } catch {
      setHasSandboxSubscription(false);
    } finally {
      setCheckingSandboxSubscription(false);
    }
  }, []);

  useEffect(() => {
    refreshSandboxSubscriptionState();
  }, [refreshSandboxSubscriptionState, isPlus, subPlatform, subEnvironment]);

  async function handleModeChange(m: 'tennis' | 'pickleball') {
    hapticMedium();
    const newValue = mode === m ? undefined : m;
    setMode(newValue);
    await updateUserPreferences({ mode: newValue });
  }

  async function handleStatProfileChange(p: 'basic' | 'intermediate' | 'advanced') {
    hapticMedium();
    const newValue = statProfile === p ? undefined : p;
    setStatProfile(newValue);
    await updateUserPreferences({ statProfile: newValue });
  }

  function handleSaveEmail() {
    hapticLight();
    setUser((prev: any) => prev && { ...prev, email: newEmail });
    setEditingEmail(false);
  }

  function handleSavePassword() {
    hapticLight();
    setEditingPassword(false);
  }


  async function handleDeleteAccount() {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            hapticMedium();
            try {
              const API_BASE = ENV.API_BASE;
              await fetch(`${API_BASE}/auth/delete`, { method: 'DELETE' });
              await contextLogout();
            } catch {
              Alert.alert('Error', 'Could not delete account. Please try again.');
            }
          },
        },
      ]
    );
  }

  async function handleLogout() {
    hapticLight();
    try {
      await contextLogout();
    } catch { }
  }

  async function handleFeedbackSubmit() {
    const text = feedbackText.trim();
    if (!text) return;
    if (feedbackCooldownUntil != null && Date.now() < feedbackCooldownUntil) return;
    hapticMedium();
    setFeedbackSubmitting(true);
    try {
      if (feedbackType === 'bug') {
        await submitBugReport(text);
      } else {
        await submitSuggestion(text);
      }
      setFeedbackText('');
      setSubmitted(true);
      setFeedbackCooldownUntil(Date.now() + 60 * 1000);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to submit. Please try again.');
    } finally {
      setFeedbackSubmitting(false);
    }
  }

  return (
    <View className="pb-8 relative flex-1 bg-background" style={{ paddingBottom: 32 }}>
      <ScrollView
        contentContainerStyle={{
          paddingBottom: insets.bottom + 24,
          paddingTop: 0,
        }}
        showsVerticalScrollIndicator={false}
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      >
        <View style={{ maxWidth: 768, alignSelf: 'center', width: '100%', paddingHorizontal: 16 }}>
          <View style={{ gap: 24 }}>
            <View className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-6 shadow-lg">
              <View className="flex-row items-center">
                <Feather name="settings" size={24} color="#4ade80" className="mr-3" />
                <Text className="text-2xl font-bold text-white">General</Text>
              </View>
              {loadingUser ? (
                <View style={{ gap: 20 }}>
                  <View>
                    <Skeleton style={{ width: 50, height: 16, borderRadius: 4, marginBottom: 12 }} />
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <Skeleton style={{ width: 90, height: 44, borderRadius: 9999 }} />
                      <Skeleton style={{ width: 100, height: 44, borderRadius: 9999 }} />
                    </View>
                  </View>
                  <View>
                    <Skeleton style={{ width: 90, height: 16, borderRadius: 4, marginBottom: 12 }} />
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <Skeleton style={{ width: 80, height: 44, borderRadius: 9999 }} />
                      <Skeleton style={{ width: 110, height: 44, borderRadius: 9999 }} />
                      <Skeleton style={{ width: 100, height: 44, borderRadius: 9999 }} />
                    </View>
                  </View>
                </View>
              ) : (
                <>
                  <View className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <Text className="text-gray-300 font-medium text-lg">Mode</Text>
                    <View className="flex-row items-center" style={{ gap: 8 }}>
                      <TouchableOpacity
                        onPress={() => handleModeChange('tennis')}
                        activeOpacity={0.9}
                        style={{ overflow: 'hidden', borderRadius: 9999 }}
                      >
                        {mode === 'tennis' ? (
                          <LinearGradient
                            colors={['#22c55e', '#10b981']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={{
                              paddingHorizontal: 20,
                              paddingVertical: 10,
                              minHeight: 44,
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '500' }}>Tennis</Text>
                          </LinearGradient>
                        ) : (
                          <View
                            style={{
                              paddingHorizontal: 20,
                              paddingVertical: 10,
                              minHeight: 44,
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: 'rgba(255, 255, 255, 0.1)',
                            }}
                          >
                            <Text style={{ color: '#9ca3af', fontSize: 16, fontWeight: '500' }}>Tennis</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleModeChange('pickleball')}
                        activeOpacity={0.9}
                        style={{ overflow: 'hidden', borderRadius: 9999 }}
                      >
                        {mode === 'pickleball' ? (
                          <LinearGradient
                            colors={['#22c55e', '#10b981']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={{
                              paddingHorizontal: 20,
                              paddingVertical: 10,
                              minHeight: 44,
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '500' }}>Pickleball</Text>
                          </LinearGradient>
                        ) : (
                          <View
                            style={{
                              paddingHorizontal: 20,
                              paddingVertical: 10,
                              minHeight: 44,
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: 'rgba(255, 255, 255, 0.1)',
                            }}
                          >
                            <Text style={{ color: '#9ca3af', fontSize: 16, fontWeight: '500' }}>Pickleball</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <Text className="text-gray-300 font-medium text-lg">Stat Profile</Text>
                    <View className="flex-row items-center" style={{ gap: 8 }}>
                      <TouchableOpacity
                        onPress={() => handleStatProfileChange('basic')}
                        activeOpacity={0.9}
                        style={{ overflow: 'hidden', borderRadius: 9999 }}
                      >
                        {statProfile === 'basic' ? (
                          <LinearGradient
                            colors={['#22c55e', '#10b981']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={{
                              paddingHorizontal: 20,
                              paddingVertical: 10,
                              minHeight: 44,
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '500' }}>Basic</Text>
                          </LinearGradient>
                        ) : (
                          <View
                            style={{
                              paddingHorizontal: 20,
                              paddingVertical: 10,
                              minHeight: 44,
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: 'rgba(255, 255, 255, 0.1)',
                            }}
                          >
                            <Text style={{ color: '#9ca3af', fontSize: 16, fontWeight: '500' }}>Basic</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleStatProfileChange('intermediate')}
                        activeOpacity={0.9}
                        style={{ overflow: 'hidden', borderRadius: 9999 }}
                      >
                        {statProfile === 'intermediate' ? (
                          <LinearGradient
                            colors={['#22c55e', '#10b981']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={{
                              paddingHorizontal: 20,
                              paddingVertical: 10,
                              minHeight: 44,
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '500' }}>Intermediate</Text>
                          </LinearGradient>
                        ) : (
                          <View
                            style={{
                              paddingHorizontal: 20,
                              paddingVertical: 10,
                              minHeight: 44,
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: 'rgba(255, 255, 255, 0.1)',
                            }}
                          >
                            <Text style={{ color: '#9ca3af', fontSize: 16, fontWeight: '500' }}>Intermediate</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleStatProfileChange('advanced')}
                        activeOpacity={0.9}
                        style={{ overflow: 'hidden', borderRadius: 9999 }}
                      >
                        {statProfile === 'advanced' ? (
                          <LinearGradient
                            colors={['#22c55e', '#10b981']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={{
                              paddingHorizontal: 20,
                              paddingVertical: 10,
                              minHeight: 44,
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '500' }}>Advanced</Text>
                          </LinearGradient>
                        ) : (
                          <View
                            style={{
                              paddingHorizontal: 20,
                              paddingVertical: 10,
                              minHeight: 44,
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: 'rgba(255, 255, 255, 0.1)',
                            }}
                          >
                            <Text style={{ color: '#9ca3af', fontSize: 16, fontWeight: '500' }}>Advanced</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              )}
            </View>

            <View className="p-6 rounded-2xl bg-white/5 border border-white/10 shadow-lg">
              <View className="flex-row items-center mb-6">
                <Feather name="mail" size={24} color="#60a5fa" className="mr-3" />
                <Text className="text-2xl font-bold text-white">Account</Text>
              </View>
              {loadingUser ? (
                <View style={{ gap: 24 }}>
                  <View style={{ paddingBottom: 24, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' }}>
                    <Skeleton style={{ width: 50, height: 14, borderRadius: 4, marginBottom: 8 }} />
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Skeleton style={{ width: 180, height: 16, borderRadius: 4 }} />
                      <Skeleton style={{ width: 32, height: 16, borderRadius: 4 }} />
                    </View>
                  </View>
                  <View style={{ paddingBottom: 24, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' }}>
                    <Skeleton style={{ width: 70, height: 14, borderRadius: 4, marginBottom: 8 }} />
                    <Skeleton style={{ width: 60, height: 16, borderRadius: 4 }} />
                  </View>
                  <View style={{ flexDirection: 'row', gap: 12, paddingTop: 8 }}>
                    <Skeleton style={{ flex: 1, height: 48, borderRadius: 8 }} />
                    <Skeleton style={{ flex: 1, height: 48, borderRadius: 8 }} />
                  </View>
                </View>
              ) : (
                <View className="space-y-6">
                  <View className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-6 border-b border-white/10">
                    <Text className="text-gray-300 font-medium">Email</Text>
                    {isOAuthUser ? (
                      <View className="flex-row items-center justify-between sm:justify-end gap-4">
                        <Text className="text-white">{user?.email}</Text>
                        <Text className="text-xs text-gray-500">OAuth Login</Text>
                      </View>
                    ) : editingEmail ? (
                      <View style={{ flexDirection: 'column', gap: 8 }}>
                        <TextInput
                          value={newEmail}
                          onChangeText={setNewEmail}
                          placeholder="Email"
                          placeholderTextColor="#9ca3af"
                          keyboardType="email-address"
                          autoCapitalize="none"
                          style={{
                            paddingHorizontal: 16,
                            paddingVertical: 10,
                            backgroundColor: 'rgba(255, 255, 255, 0.1)',
                            color: '#ffffff',
                            borderWidth: 1,
                            borderColor: 'rgba(255, 255, 255, 0.2)',
                            borderRadius: 8,
                            minHeight: 44,
                          }}
                        />
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <TouchableOpacity
                            onPress={handleSaveEmail}
                            activeOpacity={0.9}
                            style={{ flex: 1, overflow: 'hidden', borderRadius: 8 }}
                          >
                            <LinearGradient
                              colors={['#22c55e', '#10b981']}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 0 }}
                              style={{
                                paddingHorizontal: 20,
                                paddingVertical: 10,
                                minHeight: 44,
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '500' }}>Save</Text>
                            </LinearGradient>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => {
                              setEditingEmail(false);
                              setNewEmail(user?.email || '');
                            }}
                            activeOpacity={0.8}
                            style={{
                              flex: 1,
                              paddingHorizontal: 20,
                              paddingVertical: 10,
                              minHeight: 44,
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: 'rgba(255, 255, 255, 0.1)',
                              borderRadius: 8,
                            }}
                          >
                            <Text style={{ color: '#9ca3af', fontSize: 16, fontWeight: '500' }}>Cancel</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <View className="flex-row items-center justify-between sm:justify-end gap-4">
                        <Text className="text-white">{user?.email}</Text>
                        <TouchableOpacity
                          onPress={() => setEditingEmail(true)}
                          activeOpacity={0.8}
                        >
                          <Text className="text-blue-400 font-medium">Edit</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>

                  <View className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-6 border-b border-white/10">
                    <Text className="text-gray-300 font-medium">Password</Text>
                    {isOAuthUser ? (
                      <Text className="text-gray-500 text-sm">Managed by OAuth provider</Text>
                    ) : editingPassword ? (
                      <View style={{ flexDirection: 'column', gap: 8 }}>
                        <TextInput
                          value={newPassword}
                          onChangeText={setNewPassword}
                          placeholder="New password"
                          placeholderTextColor="#9ca3af"
                          secureTextEntry
                          style={{
                            paddingHorizontal: 16,
                            paddingVertical: 10,
                            backgroundColor: 'rgba(255, 255, 255, 0.1)',
                            color: '#ffffff',
                            borderWidth: 1,
                            borderColor: 'rgba(255, 255, 255, 0.2)',
                            borderRadius: 8,
                            minHeight: 44,
                          }}
                        />
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <TouchableOpacity
                            onPress={handleSavePassword}
                            activeOpacity={0.9}
                            style={{ flex: 1, overflow: 'hidden', borderRadius: 8 }}
                          >
                            <LinearGradient
                              colors={['#22c55e', '#10b981']}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 0 }}
                              style={{
                                paddingHorizontal: 20,
                                paddingVertical: 10,
                                minHeight: 44,
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '500' }}>Save</Text>
                            </LinearGradient>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => {
                              setEditingPassword(false);
                              setNewPassword('');
                            }}
                            activeOpacity={0.8}
                            style={{
                              flex: 1,
                              paddingHorizontal: 20,
                              paddingVertical: 10,
                              minHeight: 44,
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: 'rgba(255, 255, 255, 0.1)',
                              borderRadius: 8,
                            }}
                          >
                            <Text style={{ color: '#9ca3af', fontSize: 16, fontWeight: '500' }}>Cancel</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <TouchableOpacity
                        onPress={() => setEditingPassword(true)}
                        activeOpacity={0.8}
                      >
                        <Text className="text-blue-400 font-medium">Change</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <View className="flex flex-col sm:flex-row gap-3 pt-2">
                    <TouchableOpacity
                      onPress={handleLogout}
                      activeOpacity={0.9}
                      className="flex-1 px-6 py-3 bg-white/10 rounded-lg min-h-[48px] items-center justify-center"
                    >
                      <Text className="text-white font-medium">Log out</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleDeleteAccount}
                      activeOpacity={0.9}
                      className="flex-1 px-6 py-3 bg-blue-600/90 rounded-lg min-h-[48px] items-center justify-center"
                    >
                      <Text className="text-white font-medium">Delete Account</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>

            <View className="p-6 rounded-2xl bg-white/5 border border-white/10 shadow-lg">
              <View className="flex-row items-center mb-5">
                <Feather name="zap" size={24} color={isPlus ? '#22c55e' : '#3b82f6'} style={{ marginRight: 12 }} />
                <Text className="text-2xl font-bold text-white">Subscription</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#e2e8f0', fontWeight: '600', fontSize: 16 }}>
                    {isPlus ? 'Plus' : 'Free'}
                  </Text>
                  <Text style={{ color: '#94a3b8', fontSize: 13, marginTop: 2 }}>
                    {isPlus ? '$5.99/month' : 'Upgrade for premium features'}
                  </Text>
                </View>
                <TouchableOpacity
                  activeOpacity={0.9}
                  style={{ overflow: 'hidden', borderRadius: 12 }}
                  onPress={async () => {
                    hapticLight();
                    if (!isPlus) {
                      setShowPaywall(true);
                      return;
                    }
                    if (subPlatform === 'stripe') {
                      try {
                        const { url } = await createPortalSession();
                        if (url) {
                          if (Platform.OS === 'web') {
                            window.open(url, '_blank');
                          } else {
                            Linking.openURL(url);
                          }
                        }
                      } catch {
                        Alert.alert('Error', 'Could not open subscription management.');
                      }
                    } else if (subPlatform === 'ios') {
                      Linking.openURL('https://apps.apple.com/account/subscriptions');
                    } else if (subPlatform === 'android') {
                      Linking.openURL('https://play.google.com/store/account/subscriptions');
                    }
                  }}
                >
                  <LinearGradient
                    colors={isPlus ? ['#22c55e', '#16a34a'] : ['#3b82f6', '#06b6d4']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{
                      paddingHorizontal: 24,
                      paddingVertical: 12,
                      minHeight: 48,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 12,
                    }}
                  >
                    <Text style={{ color: '#ffffff', fontSize: 15, fontWeight: '600' }}>
                      {isPlus ? 'Manage' : 'Upgrade'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
              {!isPlus && Platform.OS !== 'web' && (
                <TouchableOpacity
                  onPress={async () => {
                    if (restoringPurchases) return;
                    hapticLight();
                    setRestoringPurchases(true);
                    try {
                      const RNIap = await import('react-native-iap');
                      await RNIap.initConnection();
                      const purchases = await RNIap.getAvailablePurchases();
                      const list = Array.isArray(purchases) ? purchases : [];
                      const match = list.find((p: any) => p.productId === 'app.mybreakpoint.plus.monthly');
                      if (!match) {
                        Alert.alert('No Subscription Found', 'We couldn\'t find an active MyBreakPoint Plus subscription on this account.');
                        return;
                      }
                      const receipt = match.purchaseToken;
                      if (!receipt) {
                        Alert.alert('Restore Failed', 'Could not read the purchase receipt. Please try again.');
                        return;
                      }
                      await verifyPurchase({
                        platform: Platform.OS as 'ios' | 'android',
                        ...(Platform.OS === 'ios' ? { receipt } : { purchaseToken: receipt }),
                        productId: 'app.mybreakpoint.plus.monthly',
                      });
                      await refreshSubscription();
                    } catch (err: any) {
                      if (err?.status === 409) {
                        Alert.alert(
                          'Restore Not Available',
                          'This subscription is linked to a different MyBreakPoint account and cannot be restored here.'
                        );
                        return;
                      }
                      if (isUserCancelledPurchaseError(err)) return;
                      Alert.alert('Restore Failed', 'Something went wrong while restoring your purchase. Please try again.');
                    } finally {
                      setRestoringPurchases(false);
                    }
                  }}
                  disabled={restoringPurchases}
                  activeOpacity={0.7}
                  style={{ alignItems: 'center', paddingVertical: 12, marginTop: 12 }}
                >
                  {restoringPurchases ? (
                    <ActivityIndicator color="#64748b" size="small" />
                  ) : (
                    <Text style={{ color: '#64748b', fontSize: 14, fontWeight: '500' }}>
                      Restore Purchases
                    </Text>
                  )}
                </TouchableOpacity>
              )}
              {Platform.OS === 'ios' && hasSandboxSubscription && (
                <TouchableOpacity
                  onPress={() => {
                    if (resettingSandboxSubscription) return;
                    Alert.alert(
                      'Remove TestFlight Subscription?',
                      'This removes only your Sandbox/TestFlight subscription state in MyBreakPoint. It will not cancel a real App Store subscription.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Remove',
                          style: 'destructive',
                          onPress: async () => {
                            setResettingSandboxSubscription(true);
                            try {
                              await resetSandboxSubscription();
                              await refreshSubscription();
                              await refreshSandboxSubscriptionState();
                              Alert.alert('Removed', 'Your TestFlight subscription state has been cleared.');
                            } catch {
                              Alert.alert('Error', 'Could not remove TestFlight subscription state. Please try again.');
                            } finally {
                              setResettingSandboxSubscription(false);
                            }
                          },
                        },
                      ]
                    );
                  }}
                  disabled={resettingSandboxSubscription || checkingSandboxSubscription}
                  activeOpacity={0.7}
                  style={{ alignItems: 'center', paddingVertical: 8, marginTop: 4 }}
                >
                  {resettingSandboxSubscription || checkingSandboxSubscription ? (
                    <ActivityIndicator color="#ef4444" size="small" />
                  ) : (
                    <Text style={{ color: '#ef4444', fontSize: 13, fontWeight: '600' }}>
                      Remove TestFlight Subscription
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </View>

            <View className="p-6 rounded-2xl bg-white/5 border border-white/10 shadow-lg">
              <View className="flex-row items-center mb-5">
                <Feather name="help-circle" size={24} color="#60a5fa" className="mr-3" />
                <Text className="text-2xl font-bold text-white">Support & Legal</Text>
              </View>
              <View style={{ gap: 10 }}>
                <TouchableOpacity
                  onPress={() => {
                    hapticLight();
                    (navigation as any).navigate('support');
                  }}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 16,
                    borderRadius: 14,
                    backgroundColor: 'rgba(255, 255, 255, 0.04)',
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.08)',
                    gap: 14,
                  }}
                >
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      backgroundColor: 'rgba(96, 165, 250, 0.12)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Feather name="headphones" size={20} color="#60a5fa" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>Support</Text>
                    <Text style={{ color: '#94a3b8', fontSize: 13, marginTop: 2 }}>FAQ, contact us, and get help</Text>
                  </View>
                  <Feather name="chevron-right" size={20} color="#475569" />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    hapticLight();
                    (navigation as any).navigate('legal');
                  }}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 16,
                    borderRadius: 14,
                    backgroundColor: 'rgba(255, 255, 255, 0.04)',
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.08)',
                    gap: 14,
                  }}
                >
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      backgroundColor: 'rgba(52, 211, 153, 0.12)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Feather name="shield" size={20} color="#34d399" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>Legal</Text>
                    <Text style={{ color: '#94a3b8', fontSize: 13, marginTop: 2 }}>Terms of Service & Privacy Policy</Text>
                  </View>
                  <Feather name="chevron-right" size={20} color="#475569" />
                </TouchableOpacity>
              </View>
            </View>

            <View className="p-6 rounded-2xl bg-white/5 border border-white/10 shadow-lg">
              <View className="flex-row items-center mb-5">
                {feedbackType === 'bug' ? (
                  <Feather name="alert-triangle" size={24} color="#f87171" className="mr-3" />
                ) : (
                  <Feather name="zap" size={24} color="#facc15" className="mr-3" />
                )}
                <Text className="text-2xl font-bold text-white">
                  {feedbackType === 'bug' ? 'Report a Bug' : 'Suggest a Feature'}
                </Text>
              </View>
              <View className="mb-5 flex-row" style={{ gap: 8 }}>
                <TouchableOpacity
                  onPress={() => setFeedbackType('bug')}
                  activeOpacity={0.9}
                  style={{ overflow: 'hidden', borderRadius: 9999 }}
                >
                  {feedbackType === 'bug' ? (
                    <View
                      style={{
                        paddingHorizontal: 20,
                        paddingVertical: 10,
                        minHeight: 44,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: '#3b82f6',
                      }}
                    >
                      <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '500' }}>Bug Report</Text>
                    </View>
                  ) : (
                    <View
                      style={{
                        paddingHorizontal: 20,
                        paddingVertical: 10,
                        minHeight: 44,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      }}
                    >
                      <Text style={{ color: '#9ca3af', fontSize: 16, fontWeight: '500' }}>Bug Report</Text>
                    </View>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setFeedbackType('suggestion')}
                  activeOpacity={0.9}
                  style={{ overflow: 'hidden', borderRadius: 9999 }}
                >
                  {feedbackType === 'suggestion' ? (
                    <View
                      style={{
                        paddingHorizontal: 20,
                        paddingVertical: 10,
                        minHeight: 44,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: '#60a5fa',
                      }}
                    >
                      <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '500' }}>Feature Suggestion</Text>
                    </View>
                  ) : (
                    <View
                      style={{
                        paddingHorizontal: 20,
                        paddingVertical: 10,
                        minHeight: 44,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      }}
                    >
                      <Text style={{ color: '#9ca3af', fontSize: 16, fontWeight: '500' }}>Feature Suggestion</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
              <TextInput
                multiline
                value={feedbackText}
                onChangeText={setFeedbackText}
                placeholder="Describe your issue or suggestion..."
                placeholderTextColor="#9ca3af"
                className="w-full px-4 py-3 bg-white/10 text-white placeholder:text-gray-400 border border-white/20 rounded-lg h-32"
                style={{ textAlignVertical: 'top' }}
              />
              <View className="mt-5 flex-row justify-end">
                <TouchableOpacity
                  onPress={handleFeedbackSubmit}
                  activeOpacity={0.9}
                  disabled={
                    !feedbackText.trim() ||
                    feedbackSubmitting ||
                    (feedbackCooldownUntil != null && Date.now() < feedbackCooldownUntil)
                  }
                  style={{
                    overflow: 'hidden',
                    borderRadius: 8,
                    opacity:
                      !feedbackText.trim() || feedbackSubmitting || feedbackCooldownSeconds > 0 ? 0.5 : 1,
                  }}
                >
                  <LinearGradient
                    colors={['#22c55e', '#10b981']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{
                      paddingHorizontal: 32,
                      paddingVertical: 12,
                      minHeight: 48,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {feedbackSubmitting ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : feedbackCooldownSeconds > 0 ? (
                      <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>
                        Submit again in {feedbackCooldownSeconds}s
                      </Text>
                    ) : (
                      <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>Submit Feedback</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
              {submitted && (
                <View className="mt-3 p-3 rounded-lg bg-green-500/20 border border-green-500/30">
                  <Text className="text-green-400 text-sm font-medium">
                    ✓ Feedback submitted successfully!
                  </Text>
                </View>
              )}
            </View>
          </View>
          <KeyboardSpacer extraOffset={40} />
        </View>
      </ScrollView>
      <PaywallScreen visible={showPaywall} onClose={() => { setShowPaywall(false); refreshSubscription(); }} />
    </View>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { Stack, router } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { BirthdatePicker } from '../src/components/BirthdatePicker';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../src/contexts/AuthContext';
import { getUserProfile, updateUserPreferences, updateUserProfile } from '../src/api/user';
import { submitBugReport, submitSuggestion } from '../src/api/feedback';
import { requestDeleteAccount } from '../src/api/auth';
import { hapticLight, hapticMedium } from '../src/utils/haptics';
import { formatBirthdateForApi, parseBirthdateFromApi } from '../src/utils/birthdate';
import { Skeleton } from '../src/components/Skeleton';
import { KeyboardSpacer } from '@/components/KeyboardSpacer';
import { useSubscription } from '../src/contexts/SubscriptionContext';
import { createPortalSession, getSubscriptionStatus, verifyPurchase } from '../src/api/subscriptions';
import PaywallScreen from '../src/screens/PaywallScreen';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { user: authUser, loading: authLoading, logout: contextLogout, setUserContext } = useAuth();
  const { isPlus, subscriptionStatus, platform: subPlatform, refresh: refreshSubscription } = useSubscription();
  const [showPaywall, setShowPaywall] = useState(false);
  const [restoringPurchases, setRestoringPurchases] = useState(false);
  const [mode, setMode] = useState<'tennis' | 'pickleball' | undefined>(undefined);
  const [statProfile, setStatProfile] = useState<'basic' | 'advanced' | undefined>(undefined);
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
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteCooldown, setDeleteCooldown] = useState(0);
  const deleteTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [parentalPinModal, setParentalPinModal] = useState<'disable' | 'enable' | null>(null);
  const [parentalPin, setParentalPin] = useState('');
  const [parentalSubmitting, setParentalSubmitting] = useState(false);
  const [birthdate, setBirthdate] = useState<Date | null>(null);
  const [editingBirthdate, setEditingBirthdate] = useState(false);
  const [birthdateSaving, setBirthdateSaving] = useState(false);

  useEffect(() => {
    if (deleteCooldown <= 0) {
      if (deleteTimerRef.current) {
        clearInterval(deleteTimerRef.current);
        deleteTimerRef.current = null;
      }
      return;
    }
    deleteTimerRef.current = setInterval(() => {
      setDeleteCooldown(prev => {
        if (prev <= 1) {
          if (deleteTimerRef.current) clearInterval(deleteTimerRef.current);
          deleteTimerRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (deleteTimerRef.current) clearInterval(deleteTimerRef.current);
    };
  }, [deleteCooldown > 0]);

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
    if (!authLoading && !authUser) {
      router.replace('/(tabs)/calendar');
    }
  }, [authUser, authLoading]);

  useEffect(() => {
    if (!authUser) return;
    setLoadingUser(true);
    getUserProfile()
      .then(u => {
        setUser(u);
        setNewEmail(u.email);
        setMode(u.mode);
        setStatProfile(u.statProfile);
        setIsOAuthUser(Boolean(u?.authProvider));
        setBirthdate(parseBirthdateFromApi(u?.birthdate) ?? null);
      })
      .catch(() => { })
      .finally(() => setLoadingUser(false));
  }, [authUser]);

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

  async function handleModeChange(m: 'tennis' | 'pickleball') {
    hapticMedium();
    const newValue = mode === m ? undefined : m;
    setMode(newValue);
    await updateUserPreferences({ mode: newValue });
    if (user) setUserContext({ ...user, mode: newValue });
  }

  async function handleStatProfileChange(p: 'basic' | 'advanced') {
    hapticMedium();
    const newValue = statProfile === p ? undefined : p;
    setStatProfile(newValue);
    await updateUserPreferences({ statProfile: newValue });
    if (user) setUserContext({ ...user, statProfile: newValue });
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
    if (deleteCooldown > 0) return;
    Alert.alert(
      'Delete Account',
      'We will send a confirmation email with a link to permanently delete your account and all associated data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Email',
          style: 'destructive',
          onPress: async () => {
            hapticMedium();
            setDeleteLoading(true);
            try {
              await requestDeleteAccount();
              setDeleteCooldown(30);
              Alert.alert('Check Your Email', 'We sent a confirmation link to your email. Click the link to permanently delete your account.');
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Could not send deletion email. Please try again.');
            } finally {
              setDeleteLoading(false);
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
      router.dismissAll();
    } catch { }
  }

  const chatDisabled = user?.chatDisabled === true;

  async function handleParentalPinSubmit() {
    const pin = parentalPin.trim();
    if (!pin || pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin)) {
      Alert.alert('Invalid PIN', 'Enter a 4–6 digit PIN.');
      return;
    }
    hapticLight();
    setParentalSubmitting(true);
    try {
      await updateUserProfile({
        chatDisabled: parentalPinModal === 'disable',
        parentalPin: pin,
      });
      const newDisabled = parentalPinModal === 'disable';
      setUserContext({ ...authUser!, chatDisabled: newDisabled });
      if (user) setUser({ ...user, chatDisabled: newDisabled });
      setParentalPinModal(null);
      setParentalPin('');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not update. Try again.');
    } finally {
      setParentalSubmitting(false);
    }
  }

  function openParentalDisable() {
    setParentalPin('');
    setParentalPinModal('disable');
  }

  function openParentalEnable() {
    setParentalPin('');
    setParentalPinModal('enable');
  }

  async function handleSaveBirthdate() {
    if (birthdate == null) return;
    hapticMedium();
    setBirthdateSaving(true);
    try {
      const formatted = formatBirthdateForApi(birthdate);
      await updateUserProfile({ birthdate: formatted });
      setUserContext({ ...authUser!, birthdate: formatted });
      if (user) setUser({ ...user, birthdate: formatted });
      setEditingBirthdate(false);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not save. Try again.');
    } finally {
      setBirthdateSaving(false);
    }
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
    <View style={styles.container}>
      <Stack.Screen>
        <Stack.Header
          style={(Platform.OS === 'android' || Platform.OS === 'web') ? { backgroundColor: '#020617' } : undefined}
         />
          <Stack.Screen.Title style={{ fontWeight: '800', color: '#ffffff' }}>
            Settings
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
        }}
        showsVerticalScrollIndicator={false}
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      >
        <View style={{ maxWidth: 768, alignSelf: 'center', width: '100%' }}>
          <View style={{ gap: 24 }}>
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

                  <View className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-6 border-b border-white/10">
                    <Text className="text-gray-300 font-medium">Date of birth</Text>
                    {editingBirthdate ? (
                      <View style={{ flexDirection: 'column', gap: 8 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
                          <BirthdatePicker
                            value={birthdate || new Date(new Date().setFullYear(new Date().getFullYear() - 20))}
                            onChange={(date) => setBirthdate(date)}
                            style={Platform.OS === 'android' ? {} : { height: 140 }}
                          />
                        </View>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <TouchableOpacity
                            onPress={handleSaveBirthdate}
                            disabled={birthdateSaving}
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
                              {birthdateSaving ? (
                                <ActivityIndicator size="small" color="#ffffff" />
                              ) : (
                                <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '500' }}>Save</Text>
                              )}
                            </LinearGradient>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => {
                              setEditingBirthdate(false);
                              setBirthdate(parseBirthdateFromApi(user?.birthdate) ?? null);
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
                        <Text className="text-white">
                          {birthdate ? birthdate.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'Not set'}
                        </Text>
                        <TouchableOpacity
                          onPress={() => { hapticLight(); setEditingBirthdate(true); setBirthdate(birthdate || new Date(new Date().setFullYear(new Date().getFullYear() - 20))); }}
                          activeOpacity={0.8}
                        >
                          <Text className="text-blue-400 font-medium">Edit</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>

                  <View className="flex flex-col sm:flex-row gap-3 pt-2">
                    <TouchableOpacity
                      onPress={handleLogout}
                      activeOpacity={0.9}
                      style={{
                        flex: 1,
                        paddingHorizontal: 24,
                        paddingVertical: 12,
                        minHeight: 48,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'rgba(239, 68, 68, 0.2)',
                        borderWidth: 1,
                        borderColor: 'rgba(239, 68, 68, 0.3)',
                        borderRadius: 8,
                      }}
                    >
                      <Text className="text-white font-medium">Log out</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleDeleteAccount}
                      activeOpacity={0.9}
                      disabled={deleteLoading || deleteCooldown > 0}
                      style={{
                        flex: 1,
                        paddingHorizontal: 24,
                        paddingVertical: 12,
                        minHeight: 48,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'rgba(239, 68, 68, 0.2)',
                        borderWidth: 1,
                        borderColor: 'rgba(239, 68, 68, 0.3)',
                        borderRadius: 8,
                        opacity: deleteLoading || deleteCooldown > 0 ? 0.5 : 1,
                      }}
                    >
                      {deleteLoading ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : deleteCooldown > 0 ? (
                        <Text className="text-white font-medium">Resend ({deleteCooldown}s)</Text>
                      ) : (
                        <Text className="text-white font-medium">Delete Account</Text>
                      )}
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
                      Alert.alert('Restored', 'Your subscription has been restored on this account.');
                    } catch (err: any) {
                      if (err?.status === 409) {
                        Alert.alert(
                          'Restore Not Available',
                          'This subscription is linked to a different MyBreakPoint account and cannot be restored here.'
                        );
                        return;
                      }
                      const text = `${err?.message || ''} ${err?.code || ''}`.toLowerCase();
                      if (text.includes('user cancelled') || text.includes('request canceled') || text.includes('request cancelled')) return;
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
            </View>

            <View className="p-6 rounded-2xl bg-white/5 border border-white/10 shadow-lg">
              <View className="flex-row items-center mb-5">
                <Feather name="lock" size={24} color="#f59e0b" className="mr-3" />
                <Text className="text-2xl font-bold text-white">Parental controls</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>Disable chat</Text>
                  <Text style={{ color: '#94a3b8', fontSize: 13, marginTop: 4 }}>
                    Turn off team and group chat for this account. A parent must set a PIN to disable and enter it again to re-enable.
                  </Text>
                </View>
                <Switch
                  value={chatDisabled}
                  onValueChange={(v) => {
                    hapticLight();
                    if (v) openParentalDisable();
                    else openParentalEnable();
                  }}
                  trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#3b82f6' }}
                  thumbColor="#ffffff"
                />
              </View>
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
                    router.push('/support');
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
                    router.push('/legal');
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
                  style={{ overflow: 'hidden', borderRadius: 12 }}
                >
                  {feedbackType === 'bug' ? (
                    <View
                      style={{
                        paddingHorizontal: 20,
                        paddingVertical: 12,
                        minHeight: 48,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'rgba(59, 130, 246, 0.2)',
                        borderWidth: 1,
                        borderColor: 'rgba(59, 130, 246, 0.3)',
                        borderRadius: 12,
                      }}
                    >
                      <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '500' }}>Bug Report</Text>
                    </View>
                  ) : (
                    <View
                      style={{
                        paddingHorizontal: 20,
                        paddingVertical: 12,
                        minHeight: 48,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.08)',
                      }}
                    >
                      <Text style={{ color: '#9ca3af', fontSize: 16, fontWeight: '500' }}>Bug Report</Text>
                    </View>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setFeedbackType('suggestion')}
                  activeOpacity={0.9}
                  style={{ overflow: 'hidden', borderRadius: 12 }}
                >
                  {feedbackType === 'suggestion' ? (
                    <View
                      style={{
                        paddingHorizontal: 20,
                        paddingVertical: 12,
                        minHeight: 48,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: '#60a5fa',
                        borderRadius: 12,
                      }}
                    >
                      <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '500' }}>Feature Suggestion</Text>
                    </View>
                  ) : (
                    <View
                      style={{
                        paddingHorizontal: 20,
                        paddingVertical: 12,
                        minHeight: 48,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.08)',
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

      <Modal visible={parentalPinModal !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {parentalPinModal === 'disable' ? 'Disable chat' : 'Re-enable chat'}
            </Text>
            <Text style={styles.modalDesc}>
              {parentalPinModal === 'disable'
                ? 'Set a 4–6 digit parental PIN. You will need this PIN to turn chat back on.'
                : 'Enter the parental PIN to turn chat back on.'}
            </Text>
            <TextInput
              value={parentalPin}
              onChangeText={setParentalPin}
              placeholder="PIN (4–6 digits)"
              placeholderTextColor="#64748b"
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
              style={styles.pinInput}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                onPress={() => { hapticLight(); setParentalPinModal(null); setParentalPin(''); }}
                style={styles.modalButtonCancel}
              >
                <Text style={styles.modalButtonCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleParentalPinSubmit}
                disabled={parentalSubmitting || parentalPin.length < 4}
                style={[styles.modalButtonSubmit, (parentalSubmitting || parentalPin.length < 4) && styles.modalButtonDisabled]}
              >
                {parentalSubmitting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.modalButtonSubmitText}>
                    {parentalPinModal === 'disable' ? 'Disable chat' : 'Re-enable chat'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <PaywallScreen visible={showPaywall} onClose={() => { setShowPaywall(false); refreshSubscription(); }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#0f172a',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 10,
  },
  modalDesc: {
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 20,
    marginBottom: 20,
  },
  pinInput: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    color: '#ffffff',
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
  },
  modalButtonCancel: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  modalButtonCancelText: {
    fontSize: 16,
    color: '#94a3b8',
    fontWeight: '500',
  },
  modalButtonSubmit: {
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    minWidth: 140,
    alignItems: 'center',
  },
  modalButtonDisabled: {
    opacity: 0.5,
  },
  modalButtonSubmitText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '600',
  },
});

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Platform, Alert, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useSubscription } from '../contexts/SubscriptionContext';
import { verifyPurchase, createCheckoutSession } from '../api/subscriptions';
import { hapticLight } from '../utils/haptics';
import { getIapErrorDetails, isAlreadyOwnedPurchaseError, isUserCancelledPurchaseError } from '../utils/iap';

const PLUS_PRODUCT_ID = 'app.mybreakpoint.plus.monthly';
const PLUS_WELCOME_ARMED_KEY = 'plus_welcome_armed';
const PAYWALL_PURCHASE_CANCELLED_KEY = 'paywall_purchase_cancelled';

const FEATURES = [
  { icon: 'video' as const, label: 'Ad-free broadcasting' },
  { icon: 'eye' as const, label: '2,000 minutes of stream viewing' },
  { icon: 'radio' as const, label: 'Live radio commentary' },
  { icon: 'bar-chart-2' as const, label: 'Historic stats without ads' },
  //{ icon: 'film' as const, label: 'Video replay & highlights' },
];

interface PaywallScreenProps {
  visible: boolean;
  onClose: () => void;
}

export default function PaywallScreen({ visible, onClose }: PaywallScreenProps) {
  const router = useRouter();
  const { refresh, isPlus } = useSubscription();
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [product, setProduct] = useState<any>(null);
  const iapModuleRef = useRef<any>(null);
  const purchaseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const successNavTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const purchaseInitiatedRef = useRef(false);
  const successHandledRef = useRef(false);

  const completePurchaseFlow = useCallback(() => {
    if (successHandledRef.current) return;
    successHandledRef.current = true;
    if (purchaseTimeoutRef.current) clearTimeout(purchaseTimeoutRef.current);
    purchaseTimeoutRef.current = null;
    if (successNavTimeoutRef.current) clearTimeout(successNavTimeoutRef.current);
    AsyncStorage.removeItem(PAYWALL_PURCHASE_CANCELLED_KEY).catch(() => {});
    AsyncStorage.removeItem(PLUS_WELCOME_ARMED_KEY).catch(() => {});
    setPurchasing(false);
    setRestoring(false);
    onClose();
    successNavTimeoutRef.current = setTimeout(() => {
      try {
        const maybeRouter = router as any;
        if (typeof maybeRouter.dismissAll === 'function') {
          maybeRouter.dismissAll();
        }
      } catch {
        // no-op: dismissAll is optional depending on navigator context
      }
      router.replace('/?plusWelcome=1');
    }, 40);
  }, [onClose, router]);

  const recoverOwnedSubscription = useCallback(async (): Promise<boolean> => {
    try {
      const RNIap = iapModuleRef.current ?? await import('react-native-iap');
      iapModuleRef.current = RNIap;
      await RNIap.initConnection();

      const purchases = await RNIap.getAvailablePurchases();
      const list = Array.isArray(purchases) ? purchases : [];
      const match = list.find((p: any) => p.productId === PLUS_PRODUCT_ID);
      const receipt = match?.purchaseToken;
      if (!receipt) {
        await refresh();
        return false;
      }

      await verifyPurchase({
        platform: Platform.OS as 'ios' | 'android',
        ...(Platform.OS === 'ios' ? { receipt } : { purchaseToken: receipt }),
        productId: PLUS_PRODUCT_ID,
      });
      await refresh();
      setPurchasing(false);
      setRestoring(false);
      onClose();
      return true;
    } catch (error) {
      const err = error as any;
      if (err?.status === 409) {
        Alert.alert(
          'Subscription Linked to Another Account',
          'This store subscription is already linked to a different MyBreakPoint account.'
        );
      }
      console.warn('[Paywall] already-owned recovery failed:', getIapErrorDetails(error));
      return false;
    }
  }, [refresh, onClose]);

  useEffect(() => {
    if (visible && isPlus) {
      if (purchaseInitiatedRef.current) {
        completePurchaseFlow();
      } else {
        if (purchaseTimeoutRef.current) clearTimeout(purchaseTimeoutRef.current);
        setPurchasing(false);
        onClose();
      }
    }
  }, [visible, isPlus, onClose, completePurchaseFlow]);

  useEffect(() => {
    if (!visible) {
      if (purchaseTimeoutRef.current) {
        clearTimeout(purchaseTimeoutRef.current);
        purchaseTimeoutRef.current = null;
      }
      setPurchasing(false);
      purchaseInitiatedRef.current = false;
      successHandledRef.current = false;
      AsyncStorage.removeItem(PAYWALL_PURCHASE_CANCELLED_KEY).catch(() => {});
      AsyncStorage.removeItem(PLUS_WELCOME_ARMED_KEY).catch(() => {});
    }
  }, [visible]);

  useEffect(() => {
    return () => {
      if (successNavTimeoutRef.current) clearTimeout(successNavTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!visible || !purchaseInitiatedRef.current || successHandledRef.current) return;
    let active = true;
    const checkPendingPurchase = async () => {
      const pending = await AsyncStorage.getItem('plus_welcome_pending');
      if (!active || pending !== '1') return;
      completePurchaseFlow();
    };
    void checkPendingPurchase();
    const intervalId = setInterval(() => {
      void checkPendingPurchase();
    }, 1000);
    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [visible, completePurchaseFlow]);

  useEffect(() => {
    if (!visible || !purchasing) return;
    let active = true;
    const checkCancelledPurchase = async () => {
      const cancelled = await AsyncStorage.getItem(PAYWALL_PURCHASE_CANCELLED_KEY);
      if (!active || cancelled !== '1') return;
      await AsyncStorage.removeItem(PAYWALL_PURCHASE_CANCELLED_KEY);
      if (purchaseTimeoutRef.current) {
        clearTimeout(purchaseTimeoutRef.current);
        purchaseTimeoutRef.current = null;
      }
      purchaseInitiatedRef.current = false;
      setPurchasing(false);
      await AsyncStorage.removeItem(PLUS_WELCOME_ARMED_KEY).catch(() => {});
    };
    void checkCancelledPurchase();
    const intervalId = setInterval(() => {
      void checkCancelledPurchase();
    }, 400);
    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [visible, purchasing]);

  useEffect(() => {
    if (!visible || Platform.OS === 'web') return;
    let cancelled = false;

    (async () => {
      try {
        const RNIap = await import('react-native-iap');
        iapModuleRef.current = RNIap;
        await RNIap.initConnection();
        const products = await RNIap.fetchProducts({ skus: [PLUS_PRODUCT_ID], type: 'subs' });
        const list = Array.isArray(products) ? products : [];
        if (!cancelled && list.length) {
          setProduct(list[0]);
        }
      } catch (e) {
        console.log('[Paywall] Product pre-fetch failed:', e);
      }
    })();

    return () => { cancelled = true; };
  }, [visible]);

  const handleRestore = useCallback(async () => {
    if (restoring || Platform.OS === 'web') return;
    purchaseInitiatedRef.current = false;
    hapticLight();
    setRestoring(true);

    try {
      const RNIap = iapModuleRef.current ?? await import('react-native-iap');
      iapModuleRef.current = RNIap;
      await RNIap.initConnection();

      const purchases = await RNIap.getAvailablePurchases();
      const list = Array.isArray(purchases) ? purchases : [];
      const match = list.find((p: any) => p.productId === PLUS_PRODUCT_ID);

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
        productId: PLUS_PRODUCT_ID,
      });

      await refresh();
      onClose();
    } catch (err: any) {
      if (err?.status === 409) {
        Alert.alert(
          'Restore Not Available',
          'This subscription is linked to a different MyBreakPoint account and cannot be restored here.'
        );
        return;
      }
      if (isUserCancelledPurchaseError(err)) return;
      console.warn('[Paywall] Restore error:', getIapErrorDetails(err));
      Alert.alert('Restore Failed', 'Something went wrong while restoring your purchase. Please try again.');
    } finally {
      setRestoring(false);
    }
  }, [restoring, refresh, onClose]);

  const handlePurchase = useCallback(async () => {
    if (purchasing || isPlus) {
      if (isPlus) onClose();
      return;
    }
    purchaseInitiatedRef.current = true;
    hapticLight();
    await AsyncStorage.removeItem(PAYWALL_PURCHASE_CANCELLED_KEY).catch(() => {});
    setPurchasing(true);

    try {
      if (Platform.OS === 'web') {
        const { url } = await createCheckoutSession();
        if (!url) throw new Error('Unable to start checkout. Missing checkout URL.');
        window.location.assign(url);
        onClose();
        return;
      }

      const RNIap = iapModuleRef.current ?? await import('react-native-iap');
      iapModuleRef.current = RNIap;
      await RNIap.initConnection();

      if (!product) {
        const products = await RNIap.fetchProducts({ skus: [PLUS_PRODUCT_ID], type: 'subs' });
        const list = Array.isArray(products) ? products : [];
        if (!list.length) {
          Alert.alert('Error', 'Subscription product not found. Please try again later.');
          return;
        }
        setProduct(list[0]);
      }

      await AsyncStorage.setItem(PLUS_WELCOME_ARMED_KEY, '1');

      if (Platform.OS === 'ios') {
        await RNIap.requestPurchase({
          request: { apple: { sku: PLUS_PRODUCT_ID } },
          type: 'subs',
        });
      } else {
        const sub = (product || {}) as any;
        const offerToken = sub.subscriptionOfferDetailsAndroid?.[0]?.offerToken;
        await RNIap.requestPurchase({
          request: {
            google: {
              skus: [PLUS_PRODUCT_ID],
              ...(offerToken ? { subscriptionOffers: [{ sku: PLUS_PRODUCT_ID, offerToken }] } : {}),
            },
          },
          type: 'subs',
        });
      }
      // requestPurchase is event-driven in react-native-iap v14.
      // Global purchase listeners handle verify/finish/refresh.
      purchaseTimeoutRef.current = setTimeout(() => {
        setPurchasing(false);
        purchaseTimeoutRef.current = null;
        AsyncStorage.removeItem(PLUS_WELCOME_ARMED_KEY).catch(() => {});
        refresh();
      }, 15_000);
    } catch (err: any) {
      if (isUserCancelledPurchaseError(err)) {
        purchaseInitiatedRef.current = false;
        if (purchaseTimeoutRef.current) {
          clearTimeout(purchaseTimeoutRef.current);
          purchaseTimeoutRef.current = null;
        }
        setPurchasing(false);
        await AsyncStorage.removeItem(PLUS_WELCOME_ARMED_KEY).catch(() => {});
        return;
      }
      if (isAlreadyOwnedPurchaseError(err)) {
        purchaseInitiatedRef.current = false;
        if (purchaseTimeoutRef.current) {
          clearTimeout(purchaseTimeoutRef.current);
          purchaseTimeoutRef.current = null;
        }
        await AsyncStorage.removeItem(PLUS_WELCOME_ARMED_KEY).catch(() => {});
        const recovered = await recoverOwnedSubscription();
        if (!recovered) {
          setPurchasing(false);
          Alert.alert(
            'Already Subscribed',
            'This Apple account already has an active MyBreakPoint Plus subscription. Tap Restore Purchases if needed.'
          );
        }
        return;
      }

      const text = `${err?.message || ''} ${err?.code || ''}`.toLowerCase();
      console.warn('[Paywall] Purchase error:', getIapErrorDetails(err));
      if (purchaseTimeoutRef.current) {
        clearTimeout(purchaseTimeoutRef.current);
        purchaseTimeoutRef.current = null;
      }
      setPurchasing(false);
      await AsyncStorage.removeItem(PLUS_WELCOME_ARMED_KEY).catch(() => {});

      if (text.includes('no active account')) {
        Alert.alert(
          'Apple Account Required',
          'Please sign in to your Apple ID in Settings \u2192 App Store, then try again.'
        );
        return;
      }
      if (Platform.OS === 'web' && /stripe not configured/i.test(text)) {
        Alert.alert(
          'Payments Not Configured',
          'Web checkout is not available yet. Please try subscribing from the iOS app.'
        );
        return;
      }
      Alert.alert('Purchase Failed', String(err?.message || 'Something went wrong. Please try again.'));
    }
  }, [purchasing, isPlus, product, refresh, onClose, recoverOwnedSubscription]);

  if (!visible) return null;

  const billedPrice =
    product?.localizedPrice ||
    product?.displayPrice ||
    product?.priceString ||
    (typeof product?.price === 'number' ? `$${product.price.toFixed(2)}` : null) ||
    (typeof product?.price === 'string' && product.price.trim().length > 0 ? product.price : null) ||
    null;

  return (
    <View style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.85)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 9999,
      padding: 24,
    }}>
      <View style={{
        width: '100%',
        maxWidth: 400,
        borderRadius: 24,
        overflow: 'hidden',
        backgroundColor: '#0f172a',
        borderWidth: 1,
        borderColor: 'rgba(59, 130, 246, 0.3)',
      }}>
        <LinearGradient
          colors={['rgba(59, 130, 246, 0.15)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={{ padding: 28 }}
        >
          <TouchableOpacity
            onPress={onClose}
            hitSlop={12}
            style={{ position: 'absolute', top: 16, right: 16, zIndex: 1 }}
          >
            <Feather name="x" size={22} color="#94a3b8" />
          </TouchableOpacity>

          <View style={{ alignItems: 'center', marginBottom: 24 }}>
            <LinearGradient
              colors={['#3b82f6', '#06b6d4']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
              }}
            >
              <Feather name="zap" size={28} color="#ffffff" />
            </LinearGradient>
            <Text style={{ color: '#ffffff', fontSize: 26, fontWeight: '800', marginBottom: 4 }}>
              MyBreakPoint Plus
            </Text>
            <Text style={{ color: '#94a3b8', fontSize: 15 }}>
              Unlock the full experience
            </Text>
          </View>

          <View style={{ gap: 14, marginBottom: 28 }}>
            {FEATURES.map((f) => (
              <View key={f.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <View style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: 'rgba(59, 130, 246, 0.12)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Feather name={f.icon} size={18} color="#60a5fa" />
                </View>
                <Text style={{ color: '#e2e8f0', fontSize: 15, fontWeight: '500', flex: 1 }}>
                  {f.label}
                </Text>
                <Feather name="check" size={16} color="#22c55e" />
              </View>
            ))}
          </View>

          <View style={{ alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ color: '#94a3b8', fontSize: 14, fontWeight: '600', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>
              Monthly Subscription
            </Text>
            {billedPrice ? (
              <Text style={{ color: '#ffffff', fontSize: 36, fontWeight: '800' }}>
                {billedPrice}
                <Text style={{ fontSize: 18, fontWeight: '600', color: '#cbd5e1' }}>/month</Text>
              </Text>
            ) : (
              <ActivityIndicator color="#60a5fa" style={{ marginVertical: 8 }} />
            )}
          </View>

          <TouchableOpacity
            onPress={handlePurchase}
            disabled={purchasing || !billedPrice}
            activeOpacity={0.9}
            style={{ borderRadius: 14, overflow: 'hidden', marginBottom: 12, opacity: billedPrice ? 1 : 0.5 }}
          >
            <LinearGradient
              colors={['#3b82f6', '#06b6d4']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                paddingVertical: 16,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: 8,
              }}
            >
              {purchasing ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={{ color: '#ffffff', fontSize: 17, fontWeight: '700' }}>
                  Subscribe
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {Platform.OS !== 'web' && (
            <TouchableOpacity
              onPress={handleRestore}
              disabled={restoring}
              activeOpacity={0.7}
              style={{ alignItems: 'center', paddingVertical: 10, marginBottom: 4 }}
            >
              {restoring ? (
                <ActivityIndicator color="#64748b" size="small" />
              ) : (
                <Text style={{ color: '#64748b', fontSize: 14, fontWeight: '500' }}>
                  Restore Purchases
                </Text>
              )}
            </TouchableOpacity>
          )}

          <Text style={{ color: '#64748b', fontSize: 12, textAlign: 'center', lineHeight: 18 }}>
            {Platform.OS === 'web'
              ? 'Powered by Stripe. Cancel anytime from Settings.'
              : 'Payment will be charged to your Apple ID account. Subscription automatically renews unless cancelled at least 24 hours before the end of the current period.'
            }
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 10, gap: 12 }}>
            <TouchableOpacity
              onPress={() => router.push('/legal?tab=tos')}
              activeOpacity={0.7}
            >
              <Text style={{ color: '#7dd3fc', fontSize: 13, fontWeight: '600' }}>
                Terms of Use (EULA)
              </Text>
            </TouchableOpacity>
            <Text style={{ color: '#475569', fontSize: 13 }}>|</Text>
            <TouchableOpacity
              onPress={() => router.push('/legal?tab=privacy')}
              activeOpacity={0.7}
            >
              <Text style={{ color: '#7dd3fc', fontSize: 13, fontWeight: '600' }}>
                Privacy Policy
              </Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    </View>
  );
}

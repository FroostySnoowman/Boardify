import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { GlassView, isLiquidGlassAvailable, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { useSubscription } from '../contexts/SubscriptionContext';
import { createCheckoutSession, verifyPurchase } from '../api/subscriptions';
import { PREMIUM_MONTHLY_PAYWALL_PRICE_DISPLAY, PREMIUM_MONTHLY_PRODUCT_ID } from '../constants/premiumIap';
import { getIapModuleAfterInit } from '../utils/iapConnection';
import { getIapErrorDetails, isUserCancelledPurchaseError } from '../utils/iap';
import { BoardStyleActionButton } from '../components/BoardStyleActionButton';
import { MOBILE_NAV_HEIGHT } from '../components/ActivitiesHeader';
import { hapticLight } from '../utils/haptics';

const SHIFT = 5;
const GLASS_CLOSE_SIZE = 45;
const GLASS_CLOSE_RADIUS = 22.5;

const FEATURES: { icon: keyof typeof Feather.glyphMap; label: string }[] = [
  { icon: 'layers', label: 'Prioritize tasks intelligently' },
  { icon: 'target', label: 'AI next-task recommendations' },
  { icon: 'activity', label: 'List-level wins, risks, and suggestions' },
];

function getPurchaseProductId(p: any): string | undefined {
  if (typeof p?.productId === 'string' && p.productId.length > 0) return p.productId;
  if (typeof p?.productID === 'string' && p.productID.length > 0) return p.productID;
  if (typeof p?.sku === 'string' && p.sku.length > 0) return p.sku;
  if (Array.isArray(p?.productIds) && typeof p.productIds[0] === 'string') return p.productIds[0];
  return undefined;
}

function getIosReceipt(p: any): string | undefined {
  const v =
    p?.transactionReceipt ??
    p?.originalTransactionReceiptIOS ??
    p?.purchaseToken;
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function getAndroidPurchaseToken(p: any): string | undefined {
  const v = p?.purchaseToken ?? p?.purchaseTokenAndroid ?? p?.token;
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function hasTargetProduct(p: any): boolean {
  return getPurchaseProductId(p) === PREMIUM_MONTHLY_PRODUCT_ID;
}

function summarizePurchaseShape(p: any): Record<string, unknown> {
  return {
    productId: getPurchaseProductId(p) ?? null,
    hasReceipt: !!getIosReceipt(p),
    hasAndroidToken: !!getAndroidPurchaseToken(p),
    transactionId: p?.transactionId ?? p?.transactionIdentifierIOS ?? null,
    originalTransactionId: p?.originalTransactionIdentifierIOS ?? null,
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function NeubrutalFrame({
  children,
  backgroundColor,
  shadowColor,
  borderWidth = 2,
}: {
  children: React.ReactNode;
  backgroundColor: string;
  shadowColor: string;
  borderWidth?: number;
}) {
  const { colors } = useTheme();
  return (
    <View style={frameStyles.wrap}>
      <View
        style={[
          frameStyles.shadow,
          {
            backgroundColor: shadowColor,
            borderColor: colors.border,
          },
        ]}
        pointerEvents="none"
      />
      <View
        style={[
          frameStyles.face,
          {
            backgroundColor,
            borderColor: colors.border,
            borderWidth,
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const frameStyles = StyleSheet.create({
  wrap: {
    position: 'relative',
    alignSelf: 'stretch',
    marginRight: SHIFT,
    marginBottom: SHIFT,
  },
  shadow: {
    position: 'absolute',
    left: SHIFT,
    top: SHIFT,
    right: -SHIFT,
    bottom: -SHIFT,
    borderRadius: 16,
    borderWidth: 1,
    zIndex: 0,
  },
  face: {
    position: 'relative',
    zIndex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
});

export default function AiPaywallScreen({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { colors, resolvedScheme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isPremium, refresh } = useSubscription();
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          flex: 1,
          backgroundColor: colors.canvas,
        },
        scroll: { flex: 1 },
        scrollContent: {
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 28,
          maxWidth: 520,
          width: '100%',
          alignSelf: 'center',
          gap: 20,
        },
        closeBar: {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 30,
          elevation: 28,
        },
        closeRow: {
          flexDirection: 'row',
          justifyContent: 'flex-end',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingTop: insets.top,
          minHeight: MOBILE_NAV_HEIGHT + insets.top,
        },
        glassClose: {
          width: GLASS_CLOSE_SIZE,
          height: GLASS_CLOSE_SIZE,
          borderRadius: GLASS_CLOSE_RADIUS,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'visible',
        },
        glassCloseFallback: {
          borderWidth: 1,
          borderColor: colors.glassFallbackBorder,
          backgroundColor: colors.glassFallbackBg,
        },
        eyebrow: {
          fontSize: 11,
          fontWeight: '900',
          letterSpacing: 1.2,
          color: colors.sectionLabel,
          textTransform: 'uppercase',
          marginBottom: 6,
        },
        title: {
          fontSize: 28,
          fontWeight: '900',
          color: colors.textPrimary,
          letterSpacing: -0.5,
          marginBottom: 4,
        },
        priceLine: {
          fontSize: 22,
          fontWeight: '900',
          color: colors.successEmphasis,
          marginBottom: 10,
        },
        subtitle: {
          fontSize: 15,
          fontWeight: '600',
          color: colors.textSecondary,
          lineHeight: 22,
        },
        planBadge: {
          alignSelf: 'flex-start',
          marginBottom: 10,
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderRadius: 8,
          borderWidth: 2,
          borderColor: colors.border,
          backgroundColor: colors.surfaceMuted,
        },
        planBadgeText: {
          fontSize: 10,
          fontWeight: '900',
          letterSpacing: 0.8,
          color: colors.textPrimary,
        },
        planRow: {
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 12,
          marginTop: 4,
        },
        planLabel: {
          fontSize: 18,
          fontWeight: '800',
          color: colors.textPrimary,
          flex: 1,
        },
        planPrice: {
          fontSize: 18,
          fontWeight: '900',
          color: colors.textPrimary,
        },
        planHint: {
          marginTop: 8,
          fontSize: 13,
          fontWeight: '600',
          color: colors.textTertiary,
        },
        featureRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: colors.divider,
        },
        featureRowLast: {
          borderBottomWidth: 0,
        },
        featureIcon: {
          width: 40,
          height: 40,
          borderRadius: 10,
          borderWidth: 2,
          borderColor: colors.border,
          backgroundColor: colors.surfaceMuted,
          alignItems: 'center',
          justifyContent: 'center',
        },
        featureText: {
          flex: 1,
          fontSize: 14,
          fontWeight: '700',
          color: colors.textPrimary,
          lineHeight: 20,
        },
        check: {
          opacity: 0.9,
        },
        restoreWrap: {
          alignSelf: 'center',
          paddingVertical: 8,
          marginTop: 4,
        },
        restoreText: {
          fontSize: 14,
          fontWeight: '700',
          color: colors.textSecondary,
          textDecorationLine: 'underline',
        },
        footnote: {
          fontSize: 11,
          fontWeight: '600',
          color: colors.textTertiary,
          lineHeight: 16,
          textAlign: 'center',
          marginTop: 8,
        },
        footBold: {
          fontWeight: '800',
          color: colors.textSecondary,
        },
        legalRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'center',
          columnGap: 10,
          rowGap: 4,
          marginTop: 10,
        },
        legalLink: {
          fontSize: 12,
          fontWeight: '700',
          color: colors.textSecondary,
          textDecorationLine: 'underline',
        },
        legalDot: {
          fontSize: 12,
          color: colors.textTertiary,
        },
      }),
    [colors, insets.bottom, insets.top]
  );

  useEffect(() => {
    if (visible && isPremium) onClose();
  }, [visible, isPremium, onClose]);

  const handlePurchase = useCallback(async () => {
    if (purchasing) return;
    setPurchasing(true);
    try {
      if (Platform.OS === 'web') {
        const { url } = await createCheckoutSession();
        window.location.assign(url);
        return;
      }
      const RNIap = await getIapModuleAfterInit();
      const products = await RNIap.fetchProducts({
        skus: [PREMIUM_MONTHLY_PRODUCT_ID],
        type: 'subs',
      });
      const first = Array.isArray(products) ? products[0] : null;
      if (!first) throw new Error('Subscription product unavailable.');
      let purchaseResult: any = null;
      if (Platform.OS === 'ios') {
        purchaseResult = await RNIap.requestPurchase({
          request: { apple: { sku: PREMIUM_MONTHLY_PRODUCT_ID } },
          type: 'subs',
        });
      } else {
        const androidProduct = first as any;
        const offerToken =
          androidProduct?.subscriptionOfferDetailsAndroid?.[0]?.offerToken ??
          androidProduct?.subscriptionOffers?.[0]?.offerTokenAndroid;
        purchaseResult = await RNIap.requestPurchase({
          request: {
            google: {
              skus: [PREMIUM_MONTHLY_PRODUCT_ID],
              ...(offerToken ? { subscriptionOffers: [{ sku: PREMIUM_MONTHLY_PRODUCT_ID, offerToken }] } : {}),
            },
          },
          type: 'subs',
        });
      }
      // Sandbox can lag a bit before purchases appear in getAvailablePurchases.
      const available: any[] = [];
      for (let i = 0; i < 4; i++) {
        const purchases = await RNIap.getAvailablePurchases();
        const list = Array.isArray(purchases) ? purchases : [];
        available.splice(0, available.length, ...list);
        if (available.some(hasTargetProduct)) break;
        if (i < 3) await sleep(1200);
      }
      const requested = Array.isArray(purchaseResult)
        ? purchaseResult
        : purchaseResult
          ? [purchaseResult]
          : [];
      const combined = [...requested, ...available];
      const match =
        combined.find((p: any) => hasTargetProduct(p)) ??
        combined.find((p: any) => (Platform.OS === 'ios' ? !!getIosReceipt(p) : !!getAndroidPurchaseToken(p)));
      if (!match) {
        console.warn('[AiPaywall] no premium purchase candidates', {
          requested: requested.map(summarizePurchaseShape),
          available: available.map(summarizePurchaseShape),
        });
        throw new Error('No premium purchase found after checkout.');
      }

      if (Platform.OS === 'ios') {
        const receipt = getIosReceipt(match);
        if (!receipt) {
          throw new Error('No iOS receipt found after checkout.');
        }
        await verifyPurchase({
          platform: 'ios',
          receipt,
          productId: PREMIUM_MONTHLY_PRODUCT_ID,
        });
      } else {
        const purchaseToken = getAndroidPurchaseToken(match);
        if (!purchaseToken) {
          throw new Error('No Android purchase token found after checkout.');
        }
        await verifyPurchase({
          platform: 'android',
          purchaseToken,
          productId: PREMIUM_MONTHLY_PRODUCT_ID,
        });
      }
      await refresh();
      onClose();
    } catch (err: any) {
      if (isUserCancelledPurchaseError(err)) return;
      console.warn('[AiPaywall] purchase failed', getIapErrorDetails(err));
      Alert.alert('Purchase failed', String(err?.message || 'Unable to complete purchase.'));
    } finally {
      setPurchasing(false);
    }
  }, [onClose, purchasing, refresh]);

  const handleRestore = useCallback(async () => {
    if (restoring || Platform.OS === 'web') return;
    setRestoring(true);
    try {
      const RNIap = await getIapModuleAfterInit();
      const purchases = await RNIap.getAvailablePurchases();
      const list = Array.isArray(purchases) ? purchases : [];
      const match =
        list.find((p: any) => hasTargetProduct(p)) ??
        list.find((p: any) => (Platform.OS === 'ios' ? !!getIosReceipt(p) : !!getAndroidPurchaseToken(p)));
      if (!match) {
        Alert.alert('No subscription found', 'No active AI subscription was found for this store account.');
        return;
      }
      if (Platform.OS === 'ios') {
        const receipt = getIosReceipt(match);
        if (!receipt) {
          Alert.alert('Restore failed', 'No iOS receipt found for this subscription.');
          return;
        }
        await verifyPurchase({
          platform: 'ios',
          receipt,
          productId: PREMIUM_MONTHLY_PRODUCT_ID,
        });
      } else {
        const purchaseToken = getAndroidPurchaseToken(match);
        if (!purchaseToken) {
          Alert.alert('Restore failed', 'No Android purchase token found for this subscription.');
          return;
        }
        await verifyPurchase({
          platform: 'android',
          purchaseToken,
          productId: PREMIUM_MONTHLY_PRODUCT_ID,
        });
      }
      await refresh();
      onClose();
    } catch (err: any) {
      Alert.alert('Restore failed', String(err?.message || 'Unable to restore purchase.'));
    } finally {
      setRestoring(false);
    }
  }, [onClose, refresh, restoring]);

  if (!visible) return null;

  const close = () => {
    hapticLight();
    onClose();
  };

  const headerBarHeight = MOBILE_NAV_HEIGHT + insets.top;
  const isGlassClose =
    isLiquidGlassAvailable() && isGlassEffectAPIAvailable() && Platform.OS !== 'web';
  const glassScheme = resolvedScheme === 'dark' ? ('dark' as const) : ('light' as const);
  const glassTint =
    resolvedScheme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.42)';

  const renderGlassClose = () => {
    const icon = <Feather name="x" size={22} color={colors.iconPrimary} />;
    if (isGlassClose) {
      return (
        <GlassView isInteractive colorScheme={glassScheme} tintColor={glassTint} style={styles.glassClose}>
          {icon}
        </GlassView>
      );
    }
    return <View style={[styles.glassClose, styles.glassCloseFallback]}>{icon}</View>;
  };

  const storeCancelPhrase =
    Platform.OS === 'ios'
      ? 'Cancel any time in the App Store at no additional cost; your subscription will cease at the end of the current term.'
      : 'Cancel any time in Google Play at no additional cost; your subscription will cease at the end of the current term.';

  return (
    <Modal visible animationType="slide" presentationStyle={Platform.OS === 'ios' ? 'fullScreen' : undefined}>
      <View style={styles.root}>
        <View style={styles.closeBar} pointerEvents="box-none">
          <View style={styles.closeRow}>
            <Pressable
              onPress={close}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={({ pressed }) => ({
                opacity: pressed ? 0.85 : 1,
                transform: [{ scale: pressed ? 0.97 : 1 }],
              })}
            >
              {renderGlassClose()}
            </Pressable>
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingTop: headerBarHeight + 12 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <NeubrutalFrame backgroundColor={colors.surfaceElevated} shadowColor={colors.shadowFill}>
            <View style={{ padding: 20 }}>
              <Text style={styles.eyebrow}>Boardify</Text>
              <Text style={styles.title}>AI Pro</Text>
              <Text style={styles.priceLine}>{PREMIUM_MONTHLY_PAYWALL_PRICE_DISPLAY} / month</Text>
              <Text style={styles.subtitle}>
                Smart prioritization, next-task guidance, and list-level insights for your boards.
              </Text>
            </View>
          </NeubrutalFrame>

          <NeubrutalFrame backgroundColor={colors.surface} shadowColor={colors.shadowFillColumn}>
            <View style={{ padding: 18 }}>
              <View style={styles.planBadge}>
                <Text style={styles.planBadgeText}>MONTHLY</Text>
              </View>
              <View style={styles.planRow}>
                <Text style={styles.planLabel}>Boardify AI Pro</Text>
                <Text style={styles.planPrice}>{PREMIUM_MONTHLY_PAYWALL_PRICE_DISPLAY}/mo</Text>
              </View>
              <Text style={styles.planHint}>Cancel anytime from the store or billing portal.</Text>
            </View>
          </NeubrutalFrame>

          <NeubrutalFrame backgroundColor={colors.surfaceElevated} shadowColor={colors.shadowFill}>
            <View style={{ paddingVertical: 4, paddingHorizontal: 16 }}>
              {FEATURES.map((f, i) => (
                <View
                  key={f.label}
                  style={[styles.featureRow, i === FEATURES.length - 1 && styles.featureRowLast]}
                >
                  <View style={styles.featureIcon}>
                    <Feather name={f.icon} size={18} color={colors.iconPrimary} />
                  </View>
                  <Text style={styles.featureText}>{f.label}</Text>
                  <Feather name="check" size={18} color={colors.successEmphasis} style={styles.check} />
                </View>
              ))}
            </View>
          </NeubrutalFrame>

          <BoardStyleActionButton
            shadowColor={colors.shadowFill}
            onPress={() => void handlePurchase()}
            disabled={purchasing}
            label={purchasing ? 'Working…' : 'Continue'}
            layout="stack"
            leading={purchasing ? <ActivityIndicator color={colors.textPrimary} size="small" /> : undefined}
          />

          {Platform.OS !== 'web' ? (
            <Pressable
              onPress={() => void handleRestore()}
              style={styles.restoreWrap}
              disabled={restoring}
              accessibilityRole="button"
              accessibilityLabel="Restore purchases"
            >
              {restoring ? (
                <ActivityIndicator color={colors.textSecondary} size="small" />
              ) : (
                <Text style={styles.restoreText}>Restore purchases</Text>
              )}
            </Pressable>
          ) : null}

          <View style={styles.legalRow}>
            <Pressable
              onPress={() => {
                hapticLight();
                router.push('/terms');
              }}
            >
              <Text style={styles.legalLink}>Terms of Use (EULA)</Text>
            </Pressable>
            <Text style={styles.legalDot}>{'\u2022'}</Text>
            <Pressable
              onPress={() => {
                hapticLight();
                router.push('/privacy');
              }}
            >
              <Text style={styles.legalLink}>Privacy Policy</Text>
            </Pressable>
          </View>

          {Platform.OS === 'web' ? (
            <Text style={styles.footnote}>
              Powered by Stripe. Cancel anytime from your billing portal. After subscribing, return here and open AI
              again.
            </Text>
          ) : (
            <Text style={styles.footnote}>
              Your subscription <Text style={styles.footBold}>automatically renews</Text>
              {
                ' for the same term unless cancelled at least 24 hours prior to the end of the current term. '
              }
              {storeCancelPhrase}
            </Text>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

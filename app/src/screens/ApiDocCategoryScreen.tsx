import React, { useCallback, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, Platform, Keyboard } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { getApiDocCategory } from '../data/apiDocsCatalog';
import { getApiDocsPublicBaseUrl } from '../config/env';
import { DocBlockList } from '../components/apiDocs/DocPrimitives';
import { hapticLight } from '../utils/haptics';

const BELOW_HEADER_GAP = 12;
const IOS_SCROLL_TOP_GAP = 10;

export default function ApiDocCategoryScreen() {
  const { category: categoryParam } = useLocalSearchParams<{ category: string }>();
  const categoryId = typeof categoryParam === 'string' ? categoryParam : categoryParam?.[0] ?? '';
  const doc = useMemo(() => getApiDocCategory(categoryId), [categoryId]);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const scrollContentPadTop =
    Platform.OS === 'ios' ? IOS_SCROLL_TOP_GAP : headerHeight + BELOW_HEADER_GAP;
  const apiBase = getApiDocsPublicBaseUrl();

  const close = useCallback(() => {
    hapticLight();
    Keyboard.dismiss();
    router.back();
  }, []);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.modalCreamCanvas,
        },
        scrollView: {
          flex: 1,
          backgroundColor: colors.modalCreamCanvas,
        },
        scrollContent: {
          paddingHorizontal: 18,
          paddingBottom: 40,
          maxWidth: Platform.OS === 'web' ? 640 : 560,
          width: '100%',
          alignSelf: 'center',
          alignItems: 'stretch',
        },
        missing: {
          paddingTop: 24,
        },
        missingTitle: {
          fontSize: 20,
          fontWeight: '800',
          color: colors.textPrimary,
          marginBottom: 8,
        },
        missingBody: {
          fontSize: 15,
          lineHeight: 22,
          color: colors.textSecondary,
        },
        docDescription: {
          fontSize: 15,
          lineHeight: 22,
          color: colors.textSecondary,
          marginBottom: 8,
        },
      }),
    [colors]
  );

  return (
    <View style={styles.container}>
      <Stack.Screen>
        <Stack.Header style={{ backgroundColor: colors.modalCreamCanvas }} />
        <Stack.Screen.Title style={{ fontWeight: '800', color: colors.modalCreamHeaderTint }}>
          {doc?.title ?? 'Documentation'}
        </Stack.Screen.Title>
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button icon="xmark" onPress={close} tintColor={colors.modalCreamHeaderTint} />
        </Stack.Toolbar>
      </Stack.Screen>

      <ScrollView
        style={styles.scrollView}
        contentInsetAdjustmentBehavior={Platform.OS === 'ios' ? 'automatic' : 'never'}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: scrollContentPadTop,
            paddingBottom: insets.bottom + 28,
          },
        ]}
      >
        {!doc ? (
          <View style={styles.missing}>
            <Text style={styles.missingTitle}>Topic not found</Text>
            <Text style={styles.missingBody}>
              Nothing is registered for “{categoryId}”. Go back and pick another topic from the list.
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.docDescription}>{doc.description}</Text>
            <DocBlockList blocks={doc.blocks} apiBase={apiBase} colors={colors} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

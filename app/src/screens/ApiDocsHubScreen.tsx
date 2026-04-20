import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  Platform,
  Pressable,
  Keyboard,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { hapticLight } from '../utils/haptics';
import { useTheme } from '../theme';
import type { ThemeColors } from '../theme/colors';
import { API_DOC_CATEGORIES, filterApiDocCategories } from '../data/apiDocsCatalog';
import { getApiDocsPublicBaseUrl } from '../config/env';
import { copyTextToClipboard } from '../utils/copyText';
import { NeuListRowPressable, getNeuListRowCardBase } from '../components/NeuListRowPressable';

/** Non-iOS: pad below the stack header. iOS uses `contentInsetAdjustmentBehavior="automatic"` instead of `headerHeight`. */
const BELOW_HEADER_GAP = 12;
const IOS_SCROLL_TOP_GAP = 10;

function createStyles(colors: ThemeColors, maxReadableWidth: number) {
  return StyleSheet.create({
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
      maxWidth: maxReadableWidth,
      width: '100%',
      alignSelf: 'center',
      alignItems: 'stretch',
    },
    heroLead: {
      fontSize: 15,
      lineHeight: 22,
      color: colors.textSecondary,
      marginBottom: 20,
    },
    baseUrlCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceElevated,
      marginBottom: 22,
    },
    baseUrlMeta: {
      flex: 1,
      minWidth: 0,
    },
    baseUrlLabel: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.sectionLabel,
      letterSpacing: 1,
      marginBottom: 4,
    },
    baseUrlValue: {
      fontSize: 12,
      fontWeight: '500',
      letterSpacing: -0.15,
      color: colors.textPrimary,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    searchWrap: {
      position: 'relative',
      marginBottom: 16,
    },
    searchIcon: {
      position: 'absolute',
      left: 14,
      top: 13,
      zIndex: 1,
    },
    searchInput: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingLeft: 42,
      paddingRight: 44,
      paddingVertical: Platform.OS === 'ios' ? 12 : 10,
      fontSize: 16,
      color: colors.textPrimary,
    },
    clearSearch: {
      position: 'absolute',
      right: 8,
      top: 8,
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sectionLabel: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.sectionLabel,
      letterSpacing: 0.8,
      marginBottom: 10,
    },
    topicList: {
      alignSelf: 'stretch',
      gap: 12,
    },
    neuTopicWrap: {
      alignSelf: 'stretch',
      width: '100%',
      marginBottom: 0,
    },
    topicTextCol: {
      flex: 1,
      minWidth: 0,
      paddingRight: 8,
    },
    topicTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 4,
    },
    topicDesc: {
      fontSize: 13,
      lineHeight: 18,
      color: colors.textSecondary,
    },
    empty: {
      paddingVertical: 28,
      alignItems: 'center',
    },
    emptyTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 6,
    },
    emptyBody: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      maxWidth: 280,
    },
    countPill: {
      alignSelf: 'flex-start',
      marginBottom: 14,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    countPillText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
    },
  });
}

export default function ApiDocsHubScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const scrollContentPadTop =
    Platform.OS === 'ios' ? IOS_SCROLL_TOP_GAP : headerHeight + BELOW_HEADER_GAP;
  const maxReadable = Platform.OS === 'web' ? 640 : 560;
  const styles = useMemo(() => createStyles(colors, maxReadable), [colors, maxReadable]);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => filterApiDocCategories(query), [query]);

  const close = useCallback(() => {
    hapticLight();
    Keyboard.dismiss();
    router.back();
  }, []);

  const copyBase = useCallback(() => {
    hapticLight();
    void copyTextToClipboard(getApiDocsPublicBaseUrl());
  }, []);

  const openCategory = useCallback((id: string) => {
    hapticLight();
    Keyboard.dismiss();
    router.push(`/api-reference/${id}`);
  }, []);

  return (
    <View style={styles.container}>
      <Stack.Screen>
        <Stack.Header style={{ backgroundColor: colors.modalCreamCanvas }} />
        <Stack.Screen.Title style={{ fontWeight: '800', color: colors.modalCreamHeaderTint }}>
          API Reference
        </Stack.Screen.Title>
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button icon="xmark" onPress={close} tintColor={colors.modalCreamHeaderTint} />
        </Stack.Toolbar>
      </Stack.Screen>

      <ScrollView
        style={styles.scrollView}
        contentInsetAdjustmentBehavior={Platform.OS === 'ios' ? 'automatic' : 'never'}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: scrollContentPadTop,
            paddingBottom: insets.bottom + 24,
          },
        ]}
      >
        <Text style={styles.heroLead}>
          The Boardify REST API matches what the apps use: boards, lists, cards, AI helpers, uploads, and live sync.
          Open a topic for endpoint cards, parameters, and copy-ready examples.
        </Text>

        <View style={styles.baseUrlCard}>
          <Feather name="globe" size={20} color={colors.iconMuted} />
          <View style={styles.baseUrlMeta}>
            <Text style={styles.baseUrlLabel}>BASE URL</Text>
            <Text
              style={styles.baseUrlValue}
              numberOfLines={1}
              selectable
              adjustsFontSizeToFit={Platform.OS === 'ios'}
              minimumFontScale={Platform.OS === 'ios' ? 0.82 : undefined}
            >
              {getApiDocsPublicBaseUrl()}
            </Text>
          </View>
          <Pressable onPress={copyBase} hitSlop={8} accessibilityLabel="Copy base URL">
            <Feather name="copy" size={18} color={colors.iconMuted} />
          </Pressable>
        </View>

        <View style={styles.searchWrap}>
          <Feather name="search" size={18} color={colors.iconChevron} style={styles.searchIcon} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search topics, routes, headers…"
            placeholderTextColor={colors.placeholder}
            style={styles.searchInput}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="never"
            accessibilityLabel="Search API documentation"
          />
          {query.length > 0 ? (
            <Pressable
              onPress={() => {
                hapticLight();
                setQuery('');
              }}
              style={styles.clearSearch}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <Feather name="x-circle" size={20} color={colors.iconChevron} />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.countPill}>
          <Text style={styles.countPillText}>
            {query.trim()
              ? `${filtered.length} matching ${filtered.length === 1 ? 'topic' : 'topics'}`
              : `${API_DOC_CATEGORIES.length} topics`}
          </Text>
        </View>

        <Text style={styles.sectionLabel}>TOPICS</Text>

        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No matches</Text>
            <Text style={styles.emptyBody}>Try different words, or clear the search to see every topic.</Text>
          </View>
        ) : (
          <View style={styles.topicList}>
            {filtered.map((c) => (
              <NeuListRowPressable
                key={c.id}
                wrapStyle={styles.neuTopicWrap}
                shadowStyle={{ backgroundColor: colors.shadowFill }}
                topStyle={getNeuListRowCardBase(colors)}
                onPress={() => openCategory(c.id)}
              >
                <View style={styles.topicTextCol}>
                  <Text style={styles.topicTitle}>{c.title}</Text>
                  <Text style={styles.topicDesc}>{c.description}</Text>
                </View>
                <Feather name="chevron-right" size={18} color={colors.iconChevron} />
              </NeuListRowPressable>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, Platform } from 'react-native';
import { Stack, router } from 'expo-router';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LEGAL_POLICY_EFFECTIVE } from '../legal/metadata';
import { getPrivacySections, PRIVACY_DOCUMENT_TITLE } from '../legal/privacyPolicy';
import { getTermsSections, TERMS_DOCUMENT_TITLE } from '../legal/termsOfService';
import { hapticLight } from '../utils/haptics';
import { useTheme } from '../theme';
import type { ThemeColors } from '../theme/colors';
import type { LegalSection } from '../legal/types';

const BELOW_HEADER_GAP = 12;
const SHIFT = 5;
const CARD_RADIUS = 14;

function neuCardStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrap: {
      position: 'relative',
      marginRight: SHIFT,
      marginBottom: SHIFT + 8,
    },
    shadow: {
      position: 'absolute',
      left: SHIFT,
      top: SHIFT,
      right: -SHIFT,
      bottom: -SHIFT,
      backgroundColor: colors.shadowFill,
      borderRadius: CARD_RADIUS,
      borderWidth: 1,
      borderColor: colors.border,
    },
    face: {
      position: 'relative',
      backgroundColor: colors.surfaceElevated,
      borderRadius: CARD_RADIUS,
      borderWidth: 1,
      borderColor: colors.border,
    },
  });
}

function createStyles(colors: ThemeColors, maxReadableWidth: number) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.modalCreamCanvas,
    },
    scrollContent: {
      paddingHorizontal: 16,
      paddingBottom: 36,
      maxWidth: maxReadableWidth,
      width: '100%',
      alignSelf: 'center',
    },
    hero: {
      marginBottom: 20,
      alignItems: Platform.OS === 'web' ? 'center' : 'flex-start',
    },
    heroIconWrap: {
      width: 48,
      height: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
    },
    heroTitle: {
      fontSize: 26,
      fontWeight: '800',
      color: colors.textPrimary,
      letterSpacing: -0.3,
      textAlign: Platform.OS === 'web' ? 'center' : 'left',
      alignSelf: 'stretch',
    },
    heroSubtitle: {
      marginTop: 8,
      fontSize: 15,
      fontWeight: '500',
      color: colors.subtitle,
      lineHeight: 22,
      maxWidth: 520,
      textAlign: Platform.OS === 'web' ? 'center' : 'left',
    },
    metaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 14,
      justifyContent: Platform.OS === 'web' ? 'center' : 'flex-start',
    },
    metaPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
    },
    metaPillText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
      letterSpacing: 0.2,
    },
    noticeFace: {
      padding: 16,
    },
    noticeHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 10,
    },
    noticeTitle: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.sectionLabel,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    noticeBody: {
      fontSize: 14,
      lineHeight: 21,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    documentFace: {
      paddingHorizontal: 18,
      paddingTop: 22,
      paddingBottom: 8,
    },
    sectionBlock: {
      paddingBottom: 4,
    },
    sectionDivider: {
      height: 1,
      backgroundColor: colors.divider,
      marginVertical: 20,
    },
    headingRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      marginBottom: 12,
    },
    headingAccent: {
      width: 3,
      marginTop: 5,
      height: 22,
      borderRadius: 2,
      backgroundColor: colors.boardLink,
    },
    heading: {
      flex: 1,
      fontSize: 17,
      fontWeight: '800',
      color: colors.textPrimary,
      lineHeight: 24,
      letterSpacing: -0.2,
    },
    paragraph: {
      fontSize: 15,
      lineHeight: 23,
      color: colors.textSecondary,
      fontWeight: '500',
      marginBottom: 12,
    },
    bulletRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 11,
      paddingLeft: 2,
    },
    bulletGlyph: {
      width: 22,
      alignItems: 'center',
      paddingTop: 3,
    },
    bulletDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.textTertiary,
    },
    bulletText: {
      flex: 1,
      fontSize: 15,
      lineHeight: 23,
      color: colors.textSecondary,
      fontWeight: '500',
    },
  });
}

function renderSection(
  section: LegalSection,
  index: number,
  total: number,
  styles: ReturnType<typeof createStyles>
) {
  const showDivider = index > 0;
  return (
    <View key={section.heading} style={styles.sectionBlock}>
      {showDivider ? <View style={styles.sectionDivider} /> : null}
      <View style={styles.headingRow}>
        <View style={styles.headingAccent} />
        <Text style={styles.heading}>{section.heading}</Text>
      </View>
      {section.paragraphs?.map((p, i) => (
        <Text key={i} style={styles.paragraph}>
          {p}
        </Text>
      ))}
      {section.bullets?.map((b, i) => (
        <View key={i} style={styles.bulletRow}>
          <View style={styles.bulletGlyph}>
            <View style={styles.bulletDot} />
          </View>
          <Text style={styles.bulletText}>{b}</Text>
        </View>
      ))}
      {index === total - 1 ? <View style={{ height: 16 }} /> : null}
    </View>
  );
}

export type LegalDocumentVariant = 'privacy' | 'terms';

export default function LegalDocumentScreen({ variant }: { variant: LegalDocumentVariant }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const isWeb = Platform.OS === 'web';
  const maxReadableWidth = isWeb ? 720 : 560;

  const neu = useMemo(() => neuCardStyles(colors), [colors]);
  const styles = useMemo(() => createStyles(colors, maxReadableWidth), [colors, maxReadableWidth]);

  const title = variant === 'privacy' ? PRIVACY_DOCUMENT_TITLE : TERMS_DOCUMENT_TITLE;
  const sections: LegalSection[] =
    variant === 'privacy' ? getPrivacySections() : getTermsSections();

  const heroIcon = variant === 'privacy' ? ('shield' as const) : ('file-text' as const);
  const heroBlurb =
    variant === 'privacy'
      ? 'How we collect, use, and protect your information — including when you use intelligent features in the product.'
      : 'Rules for using Boardify, our services, and features that may process your content with automated systems.';

  const close = () => {
    hapticLight();
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
        <Stack.Screen.Title style={{ fontWeight: '800', color: colors.modalCreamHeaderTint }}>
          {title}
        </Stack.Screen.Title>
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button icon="xmark" onPress={close} tintColor={colors.modalCreamHeaderTint} />
        </Stack.Toolbar>
      </Stack.Screen>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: headerHeight + BELOW_HEADER_GAP,
            paddingBottom: insets.bottom + 32,
          },
        ]}
        showsVerticalScrollIndicator
      >
        <View style={styles.hero}>
          <View style={styles.heroIconWrap}>
            <Feather name={heroIcon} size={22} color={colors.boardLink} />
          </View>
          <Text style={styles.heroTitle}>{title}</Text>
          <Text style={styles.heroSubtitle}>{heroBlurb}</Text>
          <View style={styles.metaRow}>
            <View style={styles.metaPill}>
              <Feather name="calendar" size={14} color={colors.textTertiary} />
              <Text style={styles.metaPillText}>Effective {LEGAL_POLICY_EFFECTIVE}</Text>
            </View>
            <View style={styles.metaPill}>
              <Feather name="layers" size={14} color={colors.textTertiary} />
              <Text style={styles.metaPillText}>
                {sections.length} section{sections.length === 1 ? '' : 's'}
              </Text>
            </View>
          </View>
        </View>

        <View style={neu.wrap}>
          <View style={neu.shadow} />
          <View style={[neu.face, styles.noticeFace]}>
            <View style={styles.noticeHeader}>
              <Feather name="info" size={18} color={colors.iconMuted} />
              <Text style={styles.noticeTitle}>Notice</Text>
            </View>
            <Text style={styles.noticeBody}>
              This document is for transparency. It is not legal advice. Have qualified counsel review it
              for your jurisdiction and business.
            </Text>
          </View>
        </View>

        <View style={neu.wrap}>
          <View style={neu.shadow} />
          <View style={[neu.face, styles.documentFace]}>
            {sections.map((s, i) => renderSection(s, i, sections.length, styles))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

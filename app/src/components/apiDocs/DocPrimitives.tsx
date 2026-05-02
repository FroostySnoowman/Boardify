import React, { useMemo, useState, useRef, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Platform, Animated } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { copyTextToClipboard } from '../../utils/copyText';
import type { ThemeColors } from '../../theme/colors';
import type { DocBlock, DocParamRow, HttpMethod } from '../../data/apiDocsCatalog';
import { interpolateApiDocs } from '../../data/apiDocsCatalog';

const METHOD_BADGE_LABEL = '#0f172a';

function methodColor(m: HttpMethod): string {
  switch (m) {
    case 'GET':
      return '#22c55e';
    case 'POST':
      return '#3b82f6';
    case 'PATCH':
      return '#f59e0b';
    case 'PUT':
      return '#a78bfa';
    case 'DELETE':
      return '#ef4444';
    default:
      return '#64748b';
  }
}

export function createDocStyles(colors: ThemeColors) {
  return StyleSheet.create({
    lead: {
      fontSize: 16,
      lineHeight: 24,
      color: colors.textPrimary,
      fontWeight: '500',
      marginBottom: 20,
    },
    h2: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.sectionLabel,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginTop: 22,
      marginBottom: 10,
    },
    p: {
      fontSize: 15,
      lineHeight: 22,
      color: colors.textSecondary,
      marginBottom: 12,
    },
    bulletRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 8,
      paddingRight: 8,
    },
    bulletDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.boardLink,
      marginTop: 8,
      marginRight: 10,
    },
    bulletText: {
      flex: 1,
      fontSize: 15,
      lineHeight: 22,
      color: colors.textSecondary,
    },
    callout: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceElevated,
      marginVertical: 10,
    },
    calloutText: {
      flex: 1,
      fontSize: 14,
      lineHeight: 20,
      color: colors.textSecondary,
    },
    codeWrap: {
      marginVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.cardFace,
      overflow: 'hidden',
    },
    codeHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.divider,
    },
    codeHeaderLabel: {
      flex: 1,
      minWidth: 0,
    },
    codeLabel: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.sectionLabel,
      letterSpacing: 0.8,
    },
    codeBody: {
      padding: 12,
      fontSize: 13,
      lineHeight: 19,
      color: colors.textPrimary,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    endpointCard: {
      marginVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceElevated,
      overflow: 'hidden',
    },
    endpointTop: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 10,
      padding: 14,
    },
    methodBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 6,
    },
    methodBadgeText: {
      fontSize: 12,
      fontWeight: '900',
      color: METHOD_BADGE_LABEL,
    },
    pathText: {
      flex: 1,
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      minWidth: 120,
    },
    endpointDesc: {
      paddingHorizontal: 14,
      paddingBottom: 14,
      fontSize: 14,
      lineHeight: 20,
      color: colors.textSecondary,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.divider,
      paddingTop: 12,
    },
    tableTitle: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.sectionLabel,
      letterSpacing: 0.6,
      marginTop: 16,
      marginBottom: 8,
    },
    tableHeader: {
      flexDirection: 'row',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    th: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.sectionLabel,
      textTransform: 'uppercase',
    },
    tr: {
      flexDirection: 'row',
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.divider,
      flexWrap: 'wrap',
    },
    tdName: {
      width: '28%',
      minWidth: 90,
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    tdType: {
      width: '18%',
      minWidth: 56,
      fontSize: 12,
      color: colors.textSecondary,
    },
    tdReq: {
      width: '18%',
      minWidth: 64,
      fontSize: 12,
      color: colors.textSecondary,
    },
    tdDesc: {
      flex: 1,
      minWidth: 200,
      fontSize: 13,
      lineHeight: 18,
      color: colors.textSecondary,
      marginTop: 4,
    },
  });
}

const COPY_ICON_POP_MS = 1800;

function DocCodeBlock({
  label,
  code,
  apiBase,
  styles,
  iconColor,
  colors,
}: {
  label: string;
  code: string;
  apiBase: string;
  styles: ReturnType<typeof createDocStyles>;
  iconColor: string;
  colors: ThemeColors;
}) {
  const full = interpolateApiDocs(code, apiBase);
  const [copied, setCopied] = useState(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pop = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!copied) return;
    pop.setValue(1);
    Animated.sequence([
      Animated.spring(pop, { toValue: 1.2, useNativeDriver: true, friction: 5 }),
      Animated.spring(pop, { toValue: 1, useNativeDriver: true, friction: 6 }),
    ]).start();
  }, [copied, pop]);

  const onCopy = async () => {
    const ok = await copyTextToClipboard(full);
    if (!ok) return;
    setCopied(true);
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => setCopied(false), COPY_ICON_POP_MS);
  };

  return (
    <View style={styles.codeWrap}>
      <View style={styles.codeHeader}>
        <Text style={[styles.codeLabel, styles.codeHeaderLabel]} numberOfLines={2}>
          {label.toUpperCase()}
        </Text>
        <Pressable onPress={onCopy} hitSlop={8} accessibilityLabel="Copy to clipboard">
          <Animated.View style={{ transform: [{ scale: pop }] }}>
            <Feather
              name={copied ? 'check' : 'copy'}
              size={18}
              color={copied ? colors.successEmphasis : iconColor}
            />
          </Animated.View>
        </Pressable>
      </View>
      <Text selectable style={styles.codeBody}>
        {full}
      </Text>
    </View>
  );
}

function DocEndpoint({
  method,
  path,
  description,
  apiBase,
  styles,
}: {
  method: HttpMethod;
  path: string;
  description: string;
  apiBase: string;
  styles: ReturnType<typeof createDocStyles>;
}) {
  const bg = methodColor(method);
  const pathLine = interpolateApiDocs(path, apiBase);
  return (
    <View style={styles.endpointCard}>
      <View style={styles.endpointTop}>
        <View style={[styles.methodBadge, { backgroundColor: bg }]}>
          <Text style={styles.methodBadgeText}>{method}</Text>
        </View>
        <Text style={styles.pathText}>{pathLine}</Text>
      </View>
      <Text style={styles.endpointDesc}>{interpolateApiDocs(description, apiBase)}</Text>
    </View>
  );
}

function DocParamTable({
  title,
  rows,
  styles,
}: {
  title?: string;
  rows: DocParamRow[];
  styles: ReturnType<typeof createDocStyles>;
}) {
  return (
    <View style={{ marginVertical: 8 }}>
      {title ? <Text style={styles.tableTitle}>{title.toUpperCase()}</Text> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ minWidth: 340 }}>
          <View style={[styles.tableHeader, { paddingRight: 8 }]}>
            <Text style={[styles.th, { width: 100 }]}>Name</Text>
            <Text style={[styles.th, { width: 72 }]}>Type</Text>
            <Text style={[styles.th, { width: 88 }]}>Required</Text>
            <Text style={[styles.th, { flex: 1, minWidth: 140 }]}>Description</Text>
          </View>
          {rows.map((r) => (
            <View key={r.name} style={styles.tr}>
              <Text style={styles.tdName}>{r.name}</Text>
              <Text style={styles.tdType}>{r.type}</Text>
              <Text style={styles.tdReq}>{r.required}</Text>
              <Text style={[styles.tdDesc, { marginTop: 0, flex: 1, minWidth: 160 }]}>{r.description}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

export function DocBlockList({
  blocks,
  apiBase,
  colors,
}: {
  blocks: DocBlock[];
  apiBase: string;
  colors: ThemeColors;
}) {
  const styles = useMemo(() => createDocStyles(colors), [colors]);
  const iconMuted = colors.iconMuted;
  return (
    <>
      {blocks.map((b, i) => {
        const key = `${b.type}-${i}`;
        switch (b.type) {
          case 'lead':
            return (
              <Text key={key} style={styles.lead}>
                {interpolateApiDocs(b.text, apiBase)}
              </Text>
            );
          case 'h2':
            return (
              <Text key={key} style={styles.h2}>
                {b.text}
              </Text>
            );
          case 'p':
            return (
              <Text key={key} style={styles.p}>
                {interpolateApiDocs(b.text, apiBase)}
              </Text>
            );
          case 'bullets':
            return (
              <View key={key} style={{ marginBottom: 8 }}>
                {b.items.map((item, j) => (
                  <View key={j} style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.bulletText}>{interpolateApiDocs(item, apiBase)}</Text>
                  </View>
                ))}
              </View>
            );
          case 'callout': {
            const icon = b.variant === 'warn' ? 'alert-circle' : 'info';
            const tint = b.variant === 'warn' ? colors.danger : colors.boardLink;
            return (
              <View key={key} style={styles.callout}>
                <Feather name={icon} size={18} color={tint} style={{ marginTop: 1 }} />
                <Text style={styles.calloutText}>{interpolateApiDocs(b.text, apiBase)}</Text>
              </View>
            );
          }
          case 'code':
            return (
              <DocCodeBlock
                key={key}
                label={b.label}
                code={b.code}
                apiBase={apiBase}
                styles={styles}
                iconColor={iconMuted}
                colors={colors}
              />
            );
          case 'endpoint':
            return (
              <DocEndpoint
                key={key}
                method={b.method}
                path={b.path}
                description={b.description}
                apiBase={apiBase}
                styles={styles}
              />
            );
          case 'paramTable':
            return <DocParamTable key={key} title={b.title} rows={b.rows} styles={styles} />;
          default:
            return null;
        }
      })}
    </>
  );
}

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
  Animated,
  Pressable,
  DeviceEventEmitter,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../src/theme';
import type { ThemeColors } from '../src/theme/colors';
import { BoardStyleActionButton } from '../src/components/BoardStyleActionButton';
import { hapticLight } from '../src/utils/haptics';
import {
  getBoardFull,
  runBoardAiListInsights,
  runBoardAiNextTask,
  runBoardAiPrioritization,
} from '../src/api/boards';
import { useRequirePremium } from '../src/hooks/useRequirePremium';
import {
  BOARD_AI_APPLY_ORDER_EVENT,
  BOARD_AI_OPEN_CARD_EVENT,
} from '../src/board/boardAiEvents';

const BELOW_HEADER_GAP = 10;

type CardMeta = { id: string; title: string };

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.modalCreamCanvas },
    fill: { flex: 1, backgroundColor: colors.modalCreamCanvas },
    scrollContent: {
      flexGrow: 1,
      justifyContent: 'flex-start',
      paddingHorizontal: 20,
      maxWidth: 520,
      width: '100%',
      alignSelf: 'center',
      gap: 12,
    },
    card: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: colors.border,
      padding: 16,
    },
    title: { fontSize: 24, fontWeight: '800', color: colors.textPrimary, marginBottom: 2 },
    subtitle: { fontSize: 15, color: colors.textSecondary, fontWeight: '500', lineHeight: 21 },
    sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, marginBottom: 8 },
    sectionBody: { fontSize: 14, color: colors.textSecondary, fontWeight: '600', lineHeight: 20 },
    actionRow: { marginTop: 12, paddingBottom: 10 },
    skeletonLine: {
      height: 10,
      borderRadius: 6,
      backgroundColor: colors.surfaceMuted,
      marginBottom: 8,
    },
    resultItem: {
      fontSize: 14,
      color: colors.textPrimary,
      fontWeight: '600',
      lineHeight: 20,
      marginBottom: 6,
    },
    hint: { marginTop: 8, fontSize: 12, color: colors.textTertiary, fontWeight: '600' },
    headingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
    loadingText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
    tinyCaps: {
      marginTop: 6,
      marginBottom: 4,
      fontSize: 11,
      fontWeight: '800',
      color: colors.textTertiary,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    openButton: {
      marginTop: 10,
      alignSelf: 'flex-start',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingVertical: 8,
      paddingHorizontal: 12,
      backgroundColor: colors.surfaceMuted,
    },
    openButtonText: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  });
}

function LoadingSkeleton({ active, colors }: { active: boolean; colors: ThemeColors }) {
  const opacity = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    if (!active) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.85, duration: 650, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.35, duration: 650, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active, opacity]);
  if (!active) return null;
  return (
    <Animated.View style={{ opacity }}>
      <View style={[{ width: '88%' }, skeletonStyles(colors).line]} />
      <View style={[{ width: '74%' }, skeletonStyles(colors).line]} />
      <View style={[{ width: '62%' }, skeletonStyles(colors).line]} />
    </Animated.View>
  );
}

function skeletonStyles(colors: ThemeColors) {
  return StyleSheet.create({
    line: {
      height: 10,
      borderRadius: 6,
      backgroundColor: colors.surfaceMuted,
      marginBottom: 8,
    },
  });
}

export default function BoardAiScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const params = useLocalSearchParams<{ boardId?: string; listId?: string; listTitle?: string }>();
  const boardId = typeof params.boardId === 'string' ? params.boardId : '';
  const listId = typeof params.listId === 'string' ? params.listId : '';
  const listTitle = typeof params.listTitle === 'string' ? params.listTitle : 'this list';

  const [cards, setCards] = useState<CardMeta[]>([]);
  const [loadingCards, setLoadingCards] = useState(false);
  const [busy, setBusy] = useState<null | 'prioritize' | 'next' | 'insights'>(null);
  const [prioritizedOrder, setPrioritizedOrder] = useState<string[]>([]);
  const [prioritizeNotes, setPrioritizeNotes] = useState<Record<string, string>>({});
  const [nextTask, setNextTask] = useState<{ cardId: string | null; reason: string; subtasks: string[] } | null>(
    null
  );
  const [insights, setInsights] = useState<{
    summary: string;
    wins: string[];
    risks: string[];
    suggestions: string[];
  } | null>(null);
  const { requirePremium, paywallElement } = useRequirePremium();

  useEffect(() => {
    if (!boardId) return;
    let cancelled = false;
    setLoadingCards(true);
    getBoardFull(boardId)
      .then(({ columns }) => {
        if (cancelled) return;
        const source = columns ?? [];
        const cardRows = source
          .filter((c) => (!listId ? true : String((c as { id?: string }).id) === listId))
          .flatMap((c) => {
            const cardsRaw = (c as { cards?: Array<{ id?: string; title?: string }> }).cards ?? [];
            return cardsRaw.map((card) => ({
              id: String(card.id ?? ''),
              title: String(card.title ?? 'Untitled task'),
            }));
          })
          .filter((c) => c.id);
        setCards(cardRows);
      })
      .finally(() => {
        if (!cancelled) setLoadingCards(false);
      });
    return () => {
      cancelled = true;
    };
  }, [boardId, listId]);

  const close = useCallback(() => {
    hapticLight();
    router.back();
  }, []);

  const mappedPrioritizedTitles = useMemo(() => {
    if (!prioritizedOrder.length) return [];
    const lookup = new Map(cards.map((c) => [c.id, c.title]));
    return prioritizedOrder.map((id) => ({ id, title: lookup.get(id) ?? 'Task' }));
  }, [cards, prioritizedOrder]);

  const runPrioritize = useCallback(async () => {
    if (!boardId || busy) return;
    let allowed = false;
    requirePremium(() => {
      allowed = true;
    });
    if (!allowed) return;
    setBusy('prioritize');
    try {
      const out = await runBoardAiPrioritization(boardId, {
        listIds: listId ? [listId] : undefined,
        maxCards: 45,
      });
      setPrioritizedOrder(out.order ?? []);
      setPrioritizeNotes(out.notes ?? {});
    } catch {
      // keep UI calm; board APIs already normalize error text elsewhere
    } finally {
      setBusy(null);
    }
  }, [boardId, listId, busy, requirePremium]);

  const applyPrioritize = useCallback(() => {
    if (!boardId || prioritizedOrder.length === 0) return;
    DeviceEventEmitter.emit(BOARD_AI_APPLY_ORDER_EVENT, {
      boardId,
      listId: listId || undefined,
      order: prioritizedOrder,
      notes: prioritizeNotes,
    });
    close();
  }, [boardId, close, listId, prioritizeNotes, prioritizedOrder]);

  const runNextTask = useCallback(async () => {
    if (!boardId || busy) return;
    let allowed = false;
    requirePremium(() => {
      allowed = true;
    });
    if (!allowed) return;
    setBusy('next');
    try {
      const out = await runBoardAiNextTask(boardId, {
        listIds: listId ? [listId] : undefined,
        maxCards: 45,
      });
      setNextTask({
        cardId: out.cardId ?? null,
        reason: out.reason ?? '',
        subtasks: Array.isArray(out.subtasks) ? out.subtasks : [],
      });
    } catch {
      // noop
    } finally {
      setBusy(null);
    }
  }, [boardId, listId, busy, requirePremium]);

  const openRecommended = useCallback(() => {
    if (!boardId || !nextTask?.cardId) return;
    const cardId = nextTask.cardId;
    close();
    // Wait until the sheet dismissal finishes so the board modal can open safely.
    setTimeout(() => {
      DeviceEventEmitter.emit(BOARD_AI_OPEN_CARD_EVENT, {
        boardId,
        cardId,
      });
    }, Platform.OS === 'ios' ? 360 : 220);
  }, [boardId, close, nextTask?.cardId]);

  const runInsights = useCallback(async () => {
    if (!boardId || busy) return;
    let allowed = false;
    requirePremium(() => {
      allowed = true;
    });
    if (!allowed) return;
    setBusy('insights');
    try {
      const out = await runBoardAiListInsights(boardId, {
        listIds: listId ? [listId] : undefined,
        maxCards: 45,
      });
      setInsights(out);
    } catch {
      // noop
    } finally {
      setBusy(null);
    }
  }, [boardId, listId, busy, requirePremium]);

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
          AI assistant
        </Stack.Screen.Title>
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button icon="xmark" onPress={close} tintColor={colors.modalCreamHeaderTint} />
        </Stack.Toolbar>
      </Stack.Screen>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
      >
        <ScrollView
          style={styles.fill}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: headerHeight + BELOW_HEADER_GAP, paddingBottom: insets.bottom + 28 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <Text style={styles.title}>AI for "{listTitle}"</Text>
            <Text style={styles.subtitle}>Each action uses 1 daily AI request.</Text>
            {loadingCards ? (
              <View style={styles.loadingRow}>
                <Feather name="loader" size={14} color={colors.iconMuted} />
                <Text style={styles.loadingText}>Loading list context…</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Task prioritization</Text>
            <Text style={styles.sectionBody}>Reorder tasks by urgency, due dates, and complexity cues.</Text>
            <View style={styles.actionRow}>
              <BoardStyleActionButton
                shadowColor={colors.shadowFill}
                onPress={() => void runPrioritize()}
                disabled={busy != null}
                label={busy === 'prioritize' ? 'Analyzing…' : 'Generate prioritization'}
              />
            </View>
            <LoadingSkeleton active={busy === 'prioritize'} colors={colors} />
            {mappedPrioritizedTitles.length > 0 ? (
              <>
                <Text style={styles.tinyCaps}>Suggested order</Text>
                {mappedPrioritizedTitles.slice(0, 6).map((item, idx) => (
                  <Text key={`${item.id}-${idx}`} style={styles.resultItem}>
                    {idx + 1}. {item.title}
                  </Text>
                ))}
                <View style={styles.actionRow}>
                  <BoardStyleActionButton
                    shadowColor={colors.success}
                    onPress={applyPrioritize}
                    label="Apply to board"
                  />
                </View>
                <Text style={styles.hint}>After apply, use Keep/Revert on the board to confirm.</Text>
              </>
            ) : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Next task recommendation</Text>
            <Text style={styles.sectionBody}>Get a recommended next task and breakdown steps.</Text>
            <View style={styles.actionRow}>
              <BoardStyleActionButton
                shadowColor={colors.shadowFill}
                onPress={() => void runNextTask()}
                disabled={busy != null}
                label={busy === 'next' ? 'Thinking…' : 'Recommend next task'}
              />
            </View>
            <LoadingSkeleton active={busy === 'next'} colors={colors} />
            {nextTask ? (
              <>
                {nextTask.reason ? <Text style={styles.resultItem}>{nextTask.reason}</Text> : null}
                {nextTask.subtasks.map((s, i) => (
                  <Text key={`${s}-${i}`} style={styles.resultItem}>
                    • {s}
                  </Text>
                ))}
                {nextTask.cardId ? (
                  <Pressable style={styles.openButton} onPress={openRecommended}>
                    <Text style={styles.openButtonText}>Open recommended task</Text>
                  </Pressable>
                ) : null}
              </>
            ) : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>List health insights</Text>
            <Text style={styles.sectionBody}>Surface wins, risks, and practical improvements.</Text>
            <View style={styles.actionRow}>
              <BoardStyleActionButton
                shadowColor={colors.shadowFill}
                onPress={() => void runInsights()}
                disabled={busy != null}
                label={busy === 'insights' ? 'Reviewing…' : 'Generate insights'}
              />
            </View>
            <LoadingSkeleton active={busy === 'insights'} colors={colors} />
            {insights ? (
              <>
                <Text style={styles.resultItem}>{insights.summary}</Text>
                {insights.wins.length ? <Text style={styles.tinyCaps}>Wins</Text> : null}
                {insights.wins.map((x, i) => (
                  <Text key={`w-${i}-${x}`} style={styles.resultItem}>
                    • {x}
                  </Text>
                ))}
                {insights.risks.length ? <Text style={styles.tinyCaps}>Risks</Text> : null}
                {insights.risks.map((x, i) => (
                  <Text key={`r-${i}-${x}`} style={styles.resultItem}>
                    • {x}
                  </Text>
                ))}
                {insights.suggestions.length ? <Text style={styles.tinyCaps}>Suggestions</Text> : null}
                {insights.suggestions.map((x, i) => (
                  <Text key={`s-${i}-${x}`} style={styles.resultItem}>
                    • {x}
                  </Text>
                ))}
              </>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      {paywallElement}
    </View>
  );
}

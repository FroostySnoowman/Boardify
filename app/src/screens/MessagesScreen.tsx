import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import type { CardLayout } from '../components/BoardCardExpandOverlay';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Platform,
  StyleSheet,
  Pressable,
  type View as RNView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { IPAD_TAB_CONTENT_TOP_PADDING } from '../config/layout';
import { TabScreenChrome } from '../components/TabScreenChrome';
import { ActivitiesHeader, MOBILE_NAV_HEIGHT } from '../components/ActivitiesHeader';
import { NeuListRowPressable, getNeuListRowCardBase } from '../components/NeuListRowPressable';
import {
  NotificationExpandOverlay,
  type ExpandedNotificationData,
  type NotificationKind,
} from '../components/NotificationExpandOverlay';
import { hapticLight } from '../utils/haptics';
import {
  MESSAGE_FILTER_LABELS,
  notificationMatchesFilter,
  useMessageFilter,
} from '../contexts/MessageFilterContext';
import { useAuth } from '../contexts/AuthContext';
import { getUserMessages, type ApiInboxMessage } from '../api/user';
import { formatRelativeTimeShort } from '../utils/formatRelativeTime';
import { loadReadMessageIds, markMessageRead } from '../storage/messageReadIds';
import { MessagesScreenSkeleton } from '../components/skeletons';
import { useTheme } from '../theme';

type InboxListItem = {
  id: string;
  kind: NotificationKind;
  actor: string;
  headline: string;
  detail?: string;
  atIso: string;
  unread?: boolean;
  accentColor?: string;
  boardId?: string;
  boardName?: string;
  cardId?: string;
};

function iconForKind(kind: NotificationKind): keyof typeof Feather.glyphMap {
  switch (kind) {
    case 'mention':
      return 'at-sign';
    case 'assign':
      return 'user-check';
    case 'comment':
      return 'message-circle';
    case 'invite':
      return 'users';
    case 'board':
    default:
      return 'layout';
  }
}

function mapApiToItems(messages: ApiInboxMessage[], readIds: Set<string>): InboxListItem[] {
  return messages.map((m) => ({
    id: m.id,
    kind: m.messageKind,
    actor: m.actorName,
    headline: m.headline,
    detail: m.detail,
    atIso: m.atIso,
    unread: !readIds.has(m.id),
    accentColor: m.accentColor ?? undefined,
    boardId: m.boardId,
    boardName: m.boardName,
    cardId: m.cardId ?? undefined,
  }));
}

function NotificationRow({
  item,
  expandedSourceId,
  onExpand,
  registerRowView,
}: {
  item: InboxListItem;
  expandedSourceId: string | null;
  onExpand: (data: ExpandedNotificationData) => void;
  registerRowView: (id: string, el: RNView | null) => void;
}) {
  const { colors } = useTheme();
  const rowStyles = useMemo(
    () =>
      StyleSheet.create({
        rowOuter: { opacity: 1 },
        rowHidden: { opacity: 0 },
        notificationCardFace: {
          alignItems: 'flex-start',
          paddingVertical: 14,
          paddingHorizontal: 14,
          overflow: 'hidden',
        },
        avatar: {
          width: 44,
          height: 44,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.avatarBg,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        },
        rowText: {
          flex: 1,
          minWidth: 0,
          paddingRight: 8,
        },
        rowHeadline: {
          fontSize: 15,
          fontWeight: '500',
          color: colors.textPrimary,
          lineHeight: 21,
        },
        actorName: {
          fontWeight: '700',
        },
        rowDetail: {
          fontSize: 13,
          color: colors.textSecondary,
          marginTop: 4,
          lineHeight: 18,
          fontWeight: '500',
        },
        rowRight: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          alignSelf: 'center',
        },
        timeStack: {
          alignItems: 'flex-end',
          gap: 4,
        },
        time: {
          fontSize: 12,
          fontWeight: '600',
          color: colors.textTertiary,
        },
        unreadDot: {
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: colors.textPrimary,
          borderWidth: 1,
          borderColor: colors.border,
        },
      }),
    [colors]
  );

  const rowRef = useRef<RNView | null>(null);
  const assignRowRef = useCallback(
    (el: RNView | null) => {
      rowRef.current = el;
      registerRowView(item.id, el);
    },
    [item.id, registerRowView]
  );
  const icon = iconForKind(item.kind);
  const leftBar = item.accentColor
    ? { borderLeftWidth: 4, borderLeftColor: item.accentColor }
    : undefined;

  const timeLabel = formatRelativeTimeShort(item.atIso);

  const handlePress = useCallback(() => {
    hapticLight();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        rowRef.current?.measureInWindow((x, y, w, h) => {
          onExpand({
            id: item.id,
            kind: item.kind,
            actor: item.actor,
            headline: item.headline,
            detail: item.detail,
            timeLabel,
            accentColor: item.accentColor,
            layout: {
              x,
              y,
              width: w > 0 ? w : 280,
              height: h > 0 ? h : 72,
            },
            boardId: item.boardId,
            boardName: item.boardName,
            cardId: item.cardId,
          });
        });
      });
    });
  }, [item, onExpand, timeLabel]);

  const hidden = expandedSourceId === item.id;

  return (
    <View style={[rowStyles.rowOuter, hidden && rowStyles.rowHidden]}>
      <NeuListRowPressable
        ref={assignRowRef}
        shadowStyle={{ backgroundColor: item.accentColor ?? colors.shadowFill }}
        topStyle={[getNeuListRowCardBase(colors), rowStyles.notificationCardFace, leftBar]}
        onPress={handlePress}
      >
        <View style={rowStyles.avatar}>
          <Feather name={icon} size={20} color={colors.iconPrimary} />
        </View>
        <View style={rowStyles.rowText}>
          <Text style={rowStyles.rowHeadline} numberOfLines={2}>
            <Text style={rowStyles.actorName}>{item.actor}</Text>
            {' '}
            {item.headline}
          </Text>
          {item.detail ? (
            <Text style={rowStyles.rowDetail} numberOfLines={2}>
              {item.detail}
            </Text>
          ) : null}
        </View>
        <View style={rowStyles.rowRight}>
          <View style={rowStyles.timeStack}>
            <Text style={rowStyles.time}>{timeLabel}</Text>
            {item.unread ? <View style={rowStyles.unreadDot} /> : null}
          </View>
          <Feather name="chevron-right" size={18} color={colors.iconChevron} />
        </View>
      </NeuListRowPressable>
    </View>
  );
}

export default function MessagesScreen() {
  const { colors } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          flex: 1,
          backgroundColor: colors.canvas,
        },
        title: {
          fontSize: 28,
          fontWeight: '800',
          color: colors.textPrimary,
        },
        subtitle: {
          fontSize: 15,
          color: colors.subtitle,
          marginTop: 8,
          fontWeight: '500',
          lineHeight: 22,
          maxWidth: 520,
        },
        sectionLabelWrap: {
          marginTop: 28,
          marginBottom: 12,
        },
        sectionLabel: {
          fontSize: 13,
          fontWeight: '700',
          color: colors.textPrimary,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
        },
        list: {
          gap: 12,
        },
        signedOutWrap: {
          alignItems: 'center',
          paddingVertical: 32,
          paddingHorizontal: 20,
          gap: 12,
        },
        signedOutTitle: {
          fontSize: 18,
          fontWeight: '700',
          color: colors.textPrimary,
          textAlign: 'center',
        },
        signedOutHint: {
          fontSize: 14,
          color: colors.textSecondary,
          textAlign: 'center',
          lineHeight: 20,
          maxWidth: 300,
          fontWeight: '500',
        },
        signedOutBtn: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          marginTop: 8,
          paddingVertical: 12,
          paddingHorizontal: 18,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
        },
        signedOutBtnText: {
          fontSize: 15,
          fontWeight: '700',
          color: colors.textPrimary,
        },
        errorWrap: {
          alignItems: 'center',
          paddingVertical: 28,
          gap: 12,
        },
        errorText: {
          fontSize: 14,
          color: colors.dangerText,
          textAlign: 'center',
          fontWeight: '600',
        },
        retryBtn: {
          paddingVertical: 10,
          paddingHorizontal: 16,
          borderRadius: 10,
          backgroundColor: colors.primaryButtonBg,
        },
        retryBtnText: {
          color: colors.primaryButtonText,
          fontWeight: '700',
          fontSize: 14,
        },
        emptyFilter: {
          alignItems: 'center',
          paddingVertical: 36,
          paddingHorizontal: 24,
          gap: 10,
        },
        emptyFilterTitle: {
          fontSize: 17,
          fontWeight: '700',
          color: colors.textPrimary,
        },
        emptyFilterHint: {
          fontSize: 14,
          color: colors.textSecondary,
          textAlign: 'center',
          lineHeight: 20,
          maxWidth: 300,
          fontWeight: '500',
        },
      }),
    [colors]
  );

  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const ipadPad = Platform.OS === 'ios' && Platform.isPad ? IPAD_TAB_CONTENT_TOP_PADDING : 0;
  const contentPaddingTop = (isWeb ? 24 : 12) + ipadPad;

  const { user } = useAuth();
  const [expanded, setExpanded] = useState<ExpandedNotificationData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { messageFilter } = useMessageFilter();
  const sourceRowViewsRef = useRef<Record<string, RNView | null>>({});

  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [readIdsReady, setReadIdsReady] = useState(false);
  const [rawMessages, setRawMessages] = useState<ApiInboxMessage[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    void loadReadMessageIds().then((s) => {
      setReadIds(s);
      setReadIdsReady(true);
    });
  }, []);

  const loadMessages = useCallback(async () => {
    if (!user) return;
    setLoadError(null);
    setFetching(true);
    try {
      const { messages } = await getUserMessages({ limit: 80 });
      setRawMessages(messages);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not load messages';
      setLoadError(msg);
    } finally {
      setFetching(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      if (!user || !readIdsReady) return;
      void loadMessages();
    }, [user, readIdsReady, loadMessages])
  );

  const items = useMemo(
    () => mapApiToItems(rawMessages, readIds),
    [rawMessages, readIds]
  );

  const visibleNotifications = useMemo(
    () => items.filter((n) => notificationMatchesFilter(messageFilter, n.kind, n.unread)),
    [items, messageFilter]
  );

  const registerRowView = useCallback((id: string, el: RNView | null) => {
    if (el) sourceRowViewsRef.current[id] = el;
    else delete sourceRowViewsRef.current[id];
  }, []);

  const onMeasureSource = useCallback(
    (callback: (layout: CardLayout) => void) => {
      const id = expanded?.id;
      const fallback = expanded?.layout;
      if (!id || !fallback) return;
      const node = sourceRowViewsRef.current[id];
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!node) {
            callback(fallback);
            return;
          }
          node.measureInWindow((x, y, w, h) => {
            callback({
              x,
              y,
              width: w > 0 ? w : fallback.width,
              height: h > 0 ? h : fallback.height,
            });
          });
        });
      });
    },
    [expanded]
  );

  const onExpand = useCallback((data: ExpandedNotificationData) => {
    void markMessageRead(data.id);
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(data.id);
      return next;
    });
    setExpanded(data);
  }, []);

  const onRefresh = useCallback(async () => {
    if (!user) return;
    setRefreshing(true);
    hapticLight();
    await loadMessages();
    setRefreshing(false);
  }, [user, loadMessages]);

  const onOpenBoard = useCallback((p: { boardId: string; boardName?: string }) => {
    setExpanded(null);
    router.push({
      pathname: '/board',
      params: { boardId: p.boardId, boardName: p.boardName ?? 'Board' },
    });
  }, []);

  const androidRefreshOffset = MOBILE_NAV_HEIGHT + insets.top;

  const listBody = !user ? (
    <View style={styles.signedOutWrap}>
      <Feather name="message-circle" size={40} color={colors.placeholder} />
      <Text style={styles.signedOutTitle}>Sign in to see messages</Text>
      <Text style={styles.signedOutHint}>
        Activity from boards you belong to shows up here — mentions, assignments, comments, and
        updates.
      </Text>
      <Pressable
        onPress={() => router.push('/account')}
        style={styles.signedOutBtn}
        accessibilityRole="button"
        accessibilityLabel="Open account tab"
      >
        <Text style={styles.signedOutBtnText}>Account</Text>
        <Feather name="chevron-right" size={18} color={colors.iconPrimary} />
      </Pressable>
    </View>
  ) : loadError ? (
    <View style={styles.errorWrap}>
      <Text style={styles.errorText}>{loadError}</Text>
      <Pressable onPress={() => void loadMessages()} style={styles.retryBtn}>
        <Text style={styles.retryBtnText}>Try again</Text>
      </Pressable>
    </View>
  ) : fetching && rawMessages.length === 0 ? (
    <MessagesScreenSkeleton />
  ) : visibleNotifications.length === 0 ? (
    <View style={styles.emptyFilter}>
      <Feather name={messageFilter === 'all' ? 'inbox' : 'filter'} size={28} color={colors.placeholder} />
      <Text style={styles.emptyFilterTitle}>
        {messageFilter === 'all' ? 'No activity yet' : 'Nothing to show'}
      </Text>
      <Text style={styles.emptyFilterHint}>
        {messageFilter === 'all'
          ? 'When teammates update boards you’re on, you’ll see it here.'
          : `No notifications match “${MESSAGE_FILTER_LABELS[messageFilter]}”. Try another filter from the top left.`}
      </Text>
    </View>
  ) : (
    visibleNotifications.map((n) => (
      <NotificationRow
        key={n.id}
        item={n}
        expandedSourceId={expanded?.id ?? null}
        onExpand={onExpand}
        registerRowView={registerRowView}
      />
    ))
  );

  const scroll = (
    <ScrollView
      contentContainerStyle={{
        paddingTop: contentPaddingTop,
        paddingBottom: insets.bottom + 24,
        paddingHorizontal: isWeb ? 24 : 16,
        flexGrow: 1,
        maxWidth: isWeb ? 800 : undefined,
        alignSelf: isWeb ? 'center' : undefined,
        width: '100%',
      }}
      showsVerticalScrollIndicator={false}
      bounces={Platform.OS === 'ios'}
      overScrollMode={Platform.OS === 'android' ? 'never' : undefined}
      refreshControl={
        user ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.iconPrimary}
            colors={[colors.iconPrimary]}
            progressViewOffset={Platform.OS === 'android' ? androidRefreshOffset : undefined}
          />
        ) : undefined
      }
    >
      <Text style={styles.title}>Messages</Text>
      <Text style={styles.subtitle}>
        Notifications when teammates mention you, move cards, comment, or invite you to boards and
        workspaces.
      </Text>

      <View style={styles.sectionLabelWrap}>
        <Text style={styles.sectionLabel}>Recent</Text>
      </View>

      <View style={styles.list}>{listBody}</View>
    </ScrollView>
  );

  const overlay =
    expanded != null ? (
      <NotificationExpandOverlay
        data={expanded}
        onClose={() => setExpanded(null)}
        onMeasureSource={onMeasureSource}
        onOpenBoard={onOpenBoard}
      />
    ) : null;

  if (isWeb) {
    return (
      <View style={styles.root}>
        <ActivitiesHeader />
        {scroll}
        {overlay}
      </View>
    );
  }

  return (
    <TabScreenChrome>
      <>
        {scroll}
        {overlay}
      </>
    </TabScreenChrome>
  );
}

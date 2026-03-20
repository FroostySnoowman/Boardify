import React, { useCallback, useRef, useState } from 'react';
import type { CardLayout } from '../components/BoardCardExpandOverlay';
import {
  View,
  Text,
  ScrollView,
  Platform,
  StyleSheet,
  type View as RNView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { IPAD_TAB_CONTENT_TOP_PADDING } from '../config/layout';
import { TabScreenChrome } from '../components/TabScreenChrome';
import { NeuListRowPressable, neuListRowCardBase } from '../components/NeuListRowPressable';
import {
  NotificationExpandOverlay,
  type ExpandedNotificationData,
  type NotificationKind,
} from '../components/NotificationExpandOverlay';
import { hapticLight } from '../utils/haptics';

type PlaceholderNotification = {
  id: string;
  kind: NotificationKind;
  actor: string;
  headline: string;
  detail?: string;
  timeLabel: string;
  unread?: boolean;
  accentColor?: string;
};

const PLACEHOLDER_NOTIFICATIONS: PlaceholderNotification[] = [
  {
    id: '1',
    kind: 'assign',
    actor: 'Alex Rivera',
    headline: 'assigned you to a card',
    detail: '“Ship Q2 roadmap” on Team backlog',
    timeLabel: '12m ago',
    unread: true,
    accentColor: '#a5d6a5',
  },
  {
    id: '2',
    kind: 'comment',
    actor: 'Jordan Lee',
    headline: 'commented on a card you’re on',
    detail: '“Can we bump the due date?”',
    timeLabel: '1h ago',
    unread: true,
    accentColor: '#F3D9B1',
  },
  {
    id: '3',
    kind: 'mention',
    actor: 'Sam Okonkwo',
    headline: 'mentioned you in a note',
    detail: 'Design review board',
    timeLabel: 'Yesterday',
    accentColor: '#b39ddb',
  },
  {
    id: '4',
    kind: 'board',
    actor: 'Morgan Chen',
    headline: 'added you to a board',
    detail: 'Client onboarding',
    timeLabel: '2d ago',
  },
  {
    id: '5',
    kind: 'invite',
    actor: 'Taylor Brooks',
    headline: 'invited you to a workspace',
    detail: 'Northwind Labs',
    timeLabel: 'Last week',
  },
];

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

function NotificationRow({
  item,
  expandedSourceId,
  onExpand,
  registerRowView,
}: {
  item: PlaceholderNotification;
  expandedSourceId: string | null;
  onExpand: (data: ExpandedNotificationData) => void;
  registerRowView: (id: string, el: RNView | null) => void;
}) {
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

  const handlePress = useCallback(() => {
    hapticLight();
    // Wait until press offset reset + native layout commit before measuring (same as close path).
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        rowRef.current?.measureInWindow((x, y, w, h) => {
          onExpand({
            id: item.id,
            kind: item.kind,
            actor: item.actor,
            headline: item.headline,
            detail: item.detail,
            timeLabel: item.timeLabel,
            accentColor: item.accentColor,
            layout: {
              x,
              y,
              width: w > 0 ? w : 280,
              height: h > 0 ? h : 72,
            },
          });
        });
      });
    });
  }, [item, onExpand]);

  const hidden = expandedSourceId === item.id;

  return (
    <View style={[styles.rowOuter, hidden && styles.rowHidden]}>
      <NeuListRowPressable
        ref={assignRowRef}
        shadowStyle={{ backgroundColor: item.accentColor ?? '#e0e0e0' }}
        topStyle={[neuListRowCardBase, styles.notificationCardFace, leftBar]}
        onPress={handlePress}
      >
        <View style={styles.avatar}>
          <Feather name={icon} size={20} color="#0a0a0a" />
        </View>
        <View style={styles.rowText}>
          <Text style={styles.rowHeadline} numberOfLines={2}>
            <Text style={styles.actorName}>{item.actor}</Text>
            {' '}
            {item.headline}
          </Text>
          {item.detail ? (
            <Text style={styles.rowDetail} numberOfLines={1}>
              {item.detail}
            </Text>
          ) : null}
        </View>
        <View style={styles.rowRight}>
          <View style={styles.timeStack}>
            <Text style={styles.time}>{item.timeLabel}</Text>
            {item.unread ? <View style={styles.unreadDot} /> : null}
          </View>
          <Feather name="chevron-right" size={18} color="#666" />
        </View>
      </NeuListRowPressable>
    </View>
  );
}

export default function MessagesScreen() {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const ipadPad = Platform.OS === 'ios' && Platform.isPad ? IPAD_TAB_CONTENT_TOP_PADDING : 0;
  const contentPaddingTop = (isWeb ? 24 : 12) + ipadPad;

  const [expanded, setExpanded] = useState<ExpandedNotificationData | null>(null);
  const sourceRowViewsRef = useRef<Record<string, RNView | null>>({});

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
    setExpanded(data);
  }, []);

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
    >
      <Text style={styles.title}>Messages</Text>
      <Text style={styles.subtitle}>
        Notifications when teammates mention you, move cards, comment, or invite you to boards and
        workspaces.
      </Text>

      <View style={styles.sectionLabelWrap}>
        <Text style={styles.sectionLabel}>Recent</Text>
      </View>

      <View style={styles.list}>
        {PLACEHOLDER_NOTIFICATIONS.map((n) => (
          <NotificationRow
            key={n.id}
            item={n}
            expandedSourceId={expanded?.id ?? null}
            onExpand={onExpand}
            registerRowView={registerRowView}
          />
        ))}
      </View>
    </ScrollView>
  );

  const overlay =
    expanded != null ? (
      <NotificationExpandOverlay
        data={expanded}
        onClose={() => setExpanded(null)}
        onMeasureSource={onMeasureSource}
      />
    ) : null;

  if (isWeb) {
    return (
      <View style={styles.root}>
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

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f5f0e8',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0a0a0a',
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
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
    color: '#0a0a0a',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  list: {
    gap: 12,
  },
  rowOuter: {
    opacity: 1,
  },
  rowHidden: {
    opacity: 0,
  },
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
    borderColor: '#000',
    backgroundColor: '#f0ebe3',
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
    color: '#0a0a0a',
    lineHeight: 21,
  },
  actorName: {
    fontWeight: '700',
  },
  rowDetail: {
    fontSize: 13,
    color: '#666',
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
    color: '#888',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: '#000',
  },
});

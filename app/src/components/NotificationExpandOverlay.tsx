import React, { useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  useWindowDimensions,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Extrapolation,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { hapticLight } from '../utils/haptics';
import type { CardLayout } from './BoardCardExpandOverlay';
import { useTheme } from '../theme';

const LIST_TITLE_SIZE = 15;
const LIST_TITLE_LH = 21;
const DETAIL_TITLE_SIZE = 22;
const DETAIL_TITLE_LH = 28;

const CARD_SHIFT = 4;
const LIST_CARD_PAD_V = 10;

const LIST_ROW_BORDER_RADIUS = 14;

const openConfig = {
  duration: 380,
  easing: Easing.out(Easing.cubic),
};

const closeConfig = {
  duration: 420,
  easing: Easing.out(Easing.cubic),
};

export type NotificationKind = 'mention' | 'assign' | 'comment' | 'invite' | 'board';

export type ExpandedNotificationData = {
  id: string;
  kind: NotificationKind;
  actor: string;
  headline: string;
  detail?: string;
  timeLabel: string;
  accentColor?: string;
  layout: CardLayout;
  boardId?: string;
  boardName?: string;
  cardId?: string;
};

type Props = {
  data: ExpandedNotificationData;
  onClose: () => void;
  onMeasureSource?: (callback: (layout: CardLayout) => void) => void;
  onOpenBoard?: (p: { boardId: string; boardName?: string; cardId?: string }) => void;
};

function kindBadgeLabel(kind: NotificationKind): string {
  switch (kind) {
    case 'assign':
      return 'Assignment';
    case 'mention':
      return 'Mention';
    case 'comment':
      return 'Comment';
    case 'invite':
      return 'Invite';
    case 'board':
    default:
      return 'Board';
  }
}

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

export function NotificationExpandOverlay({ data, onClose, onMeasureSource, onOpenBoard }: Props) {
  const { colors } = useTheme();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const progress = useSharedValue(0);
  const ox = useSharedValue(0);
  const oy = useSharedValue(0);
  const ow = useSharedValue(0);
  const oh = useSharedValue(0);
  const tw = useSharedValue(0);
  const th = useSharedValue(0);

  useEffect(() => {
    ox.value = data.layout.x;
    oy.value = data.layout.y;
    ow.value = data.layout.width;
    oh.value = data.layout.height;
    tw.value = screenW;
    th.value = screenH;
    progress.value = 0;
    progress.value = withTiming(1, openConfig);
  }, [
    data.layout.x,
    data.layout.y,
    data.layout.width,
    data.layout.height,
    data.id,
    screenW,
    screenH,
    ox,
    oy,
    ow,
    oh,
    tw,
    th,
    progress,
  ]);

  const shellOuterStyle = useAnimatedStyle(() => {
    const t = progress.value;
    const left = interpolate(t, [0, 1], [ox.value, 0], Extrapolation.CLAMP);
    const top = interpolate(t, [0, 1], [oy.value, 0], Extrapolation.CLAMP);
    const width = interpolate(t, [0, 1], [ow.value, tw.value], Extrapolation.CLAMP);
    const height = interpolate(t, [0, 1], [oh.value, th.value], Extrapolation.CLAMP);
    const borderRadius = interpolate(t, [0, 1], [LIST_ROW_BORDER_RADIUS, 0], Extrapolation.CLAMP);
    const neubAmount = interpolate(t, [0, 0.28, 0.62, 1], [1, 1, 0, 0], Extrapolation.CLAMP);
    const softAmt = 1 - neubAmount;
    const shadowOpacity =
      (Platform.OS === 'ios' ? 1 : 0) *
      softAmt *
      interpolate(t, [0, 0.75, 1], [0.05, 0.06, 0], Extrapolation.CLAMP);
    const elevation =
      (Platform.OS === 'android' ? 1 : 0) *
      softAmt *
      interpolate(t, [0, 0.75, 1], [10, 6, 0], Extrapolation.CLAMP);
    return {
      position: 'absolute',
      left,
      top,
      width,
      height,
      borderRadius,
      backgroundColor: '#fff',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity,
      shadowRadius: 16,
      elevation,
    };
  });

  const shellInnerClipStyle = useAnimatedStyle(() => {
    const t = progress.value;
    const borderRadius = interpolate(t, [0, 1], [LIST_ROW_BORDER_RADIUS, 0], Extrapolation.CLAMP);
    return {
      flex: 1,
      borderRadius,
      overflow: 'hidden',
    };
  });

  const shellNeubShadowStyle = useAnimatedStyle(() => {
    const t = progress.value;
    const borderRadius = interpolate(t, [0, 1], [LIST_ROW_BORDER_RADIUS, 0], Extrapolation.CLAMP);
    return {
      position: 'absolute',
      left: CARD_SHIFT,
      top: CARD_SHIFT,
      right: -CARD_SHIFT,
      bottom: -CARD_SHIFT,
      borderRadius,
      backgroundColor: '#000',
      borderWidth: 1,
      borderColor: '#000',
      opacity: interpolate(t, [0, 0.22, 0.55, 1], [1, 1, 0, 0], Extrapolation.CLAMP),
    };
  });

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0, 0.2, 0.55, 1],
      [0, 0.34, 0.44, 0.5],
      Extrapolation.CLAMP
    ),
  }));

  const headerPaddingStyle = useAnimatedStyle(() => {
    const t = progress.value;
    const topPad = Math.max(insets.top, 12);
    return {
      paddingTop: interpolate(t, [0, 1], [0, topPad], Extrapolation.CLAMP),
      paddingBottom: interpolate(t, [0, 0.18, 0.32, 1], [0, 0, 0, 10], Extrapolation.CLAMP),
      paddingHorizontal: interpolate(t, [0, 0.18, 0.32, 1], [0, 0, 0, 16], Extrapolation.CLAMP),
      maxHeight: interpolate(t, [0, 0.12, 0.28, 1], [0, 0, 88, 2000], Extrapolation.CLAMP),
      overflow: 'hidden',
      opacity: interpolate(t, [0, 0.12, 0.26, 1], [0, 0, 1, 1], Extrapolation.CLAMP),
      transform: [
        {
          translateY: interpolate(t, [0, 1], [6, 0], Extrapolation.CLAMP),
        },
      ],
      borderBottomWidth: interpolate(t, [0, 0.2, 0.34, 1], [0, 0, 1, 1], Extrapolation.CLAMP),
    };
  });

  const detailTitleStyle = useAnimatedStyle(() => {
    const t = progress.value;
    return {
      fontSize: interpolate(t, [0, 1], [LIST_TITLE_SIZE, DETAIL_TITLE_SIZE], Extrapolation.CLAMP),
      lineHeight: interpolate(t, [0, 1], [LIST_TITLE_LH, DETAIL_TITLE_LH], Extrapolation.CLAMP),
    };
  });

  const detailBodyStyle = useAnimatedStyle(() => {
    const t = progress.value;
    const bottomPad = Math.max(insets.bottom, 24);
    return {
      paddingHorizontal: interpolate(t, [0, 1], [12, 20], Extrapolation.CLAMP),
      paddingTop: interpolate(t, [0, 1], [10, 16], Extrapolation.CLAMP),
      paddingBottom: interpolate(t, [0, 1], [LIST_CARD_PAD_V, bottomPad], Extrapolation.CLAMP),
    };
  });

  const detailSubtitleMorphStyle = useAnimatedStyle(() => {
    const t = progress.value;
    return {
      fontSize: interpolate(t, [0, 1], [12, 15], Extrapolation.CLAMP),
      lineHeight: interpolate(t, [0, 1], [16, 20], Extrapolation.CLAMP),
      marginTop: 4,
    };
  });

  const detailPlaceholderWrapStyle = useAnimatedStyle(() => {
    const t = progress.value;
    return {
      opacity: interpolate(t, [0, 0.52, 0.68, 1], [0, 0, 1, 1], Extrapolation.CLAMP),
      maxHeight: interpolate(t, [0, 0.48, 0.62, 1], [0, 0, 320, 800], Extrapolation.CLAMP),
      marginTop: interpolate(t, [0, 0.55, 0.75, 1], [0, 0, 12, 20], Extrapolation.CLAMP),
      overflow: 'hidden',
      transform: [
        {
          translateY: interpolate(t, [0, 0.55, 1], [6, 2, 0], Extrapolation.CLAMP),
        },
      ],
    };
  });

  const cardOutlineStyle = useAnimatedStyle(() => ({
    borderWidth: interpolate(progress.value, [0, 0.45, 1], [1, 0, 0], Extrapolation.CLAMP),
    borderColor: '#000',
  }));

  const listMimicOpacityStyle = useAnimatedStyle(() => {
    const t = progress.value;
    return {
      opacity: interpolate(t, [0, 0.22, 0.42, 0.55, 1], [1, 1, 0.85, 0, 0], Extrapolation.CLAMP),
      zIndex: interpolate(t, [0, 0.46, 0.54, 1], [2, 2, 0, 0], Extrapolation.CLAMP),
      elevation: interpolate(t, [0, 0.46, 0.54, 1], [3, 3, 0, 0], Extrapolation.CLAMP),
    };
  });

  const expandedLayerOpacityStyle = useAnimatedStyle(() => {
    const t = progress.value;
    return {
      opacity: interpolate(t, [0, 0.2, 0.38, 0.52, 1], [0, 0, 0, 1, 1], Extrapolation.CLAMP),
      zIndex: interpolate(t, [0, 0.46, 0.54, 1], [1, 1, 2, 2], Extrapolation.CLAMP),
      elevation: interpolate(t, [0, 0.46, 0.54, 1], [0, 0, 4, 4], Extrapolation.CLAMP),
    };
  });

  const runCloseToRect = (layout: CardLayout) => {
    const L =
      layout.width > 0 && layout.height > 0 ? layout : data.layout;
    ox.value = L.x;
    oy.value = L.y;
    ow.value = L.width;
    oh.value = L.height;
    progress.value = withTiming(0, closeConfig, (finished) => {
      if (finished) {
        runOnJS(onClose)();
      }
    });
  };

  const handleClose = () => {
    hapticLight();
    if (onMeasureSource) {
      onMeasureSource((layout) => {
        runCloseToRect(layout);
      });
    } else {
      runCloseToRect(data.layout);
    }
  };

  const summaryLine = `${data.actor} ${data.headline}`;
  const listIcon = iconForKind(data.kind);

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent>
      <View style={styles.modalRoot} pointerEvents="box-none">
        <Animated.View style={[styles.backdrop, backdropStyle]} pointerEvents="auto">
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        </Animated.View>

        <Animated.View style={shellOuterStyle} pointerEvents="box-none">
          <Animated.View style={shellNeubShadowStyle} pointerEvents="none" />
          <Animated.View style={shellInnerClipStyle}>
            <Animated.View
              style={[
                styles.cardFace,
                cardOutlineStyle,
                data.accentColor
                  ? { borderLeftWidth: 4, borderLeftColor: data.accentColor }
                  : undefined,
              ]}
            >
              <Animated.View
                style={[styles.listMimicLayer, listMimicOpacityStyle]}
                pointerEvents="none"
              >
                <View style={styles.mimicAvatar}>
                  <Feather name={listIcon} size={20} color="#0a0a0a" />
                </View>
                <View style={styles.mimicTextCol}>
                  <Text style={styles.mimicHeadline} numberOfLines={2}>
                    <Text style={styles.mimicActor}>{data.actor}</Text>
                    {' '}
                    {data.headline}
                  </Text>
                  {data.detail ? (
                    <Text style={styles.mimicDetail} numberOfLines={1}>
                      {data.detail}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.mimicRight}>
                  <View style={styles.mimicTimeStack}>
                    <Text style={styles.mimicTime}>{data.timeLabel}</Text>
                  </View>
                  <Feather name="chevron-right" size={18} color="#666" />
                </View>
              </Animated.View>

              <Animated.View
                style={[styles.expandedLayer, expandedLayerOpacityStyle]}
                pointerEvents="box-none"
              >
                <Animated.View style={[styles.cardFaceHeader, headerPaddingStyle]}>
                  <Text style={styles.columnBadge} numberOfLines={1}>
                    {kindBadgeLabel(data.kind)}
                  </Text>
                  <Pressable
                    onPress={handleClose}
                    hitSlop={12}
                    style={styles.closeBtn}
                    accessibilityLabel="Close"
                  >
                    <Feather name="x" size={22} color="#0a0a0a" />
                  </Pressable>
                </Animated.View>
                <Animated.View style={[styles.detailBody, detailBodyStyle]}>
                  <Animated.Text style={[styles.detailTitleBase, detailTitleStyle]} numberOfLines={4}>
                    {summaryLine}
                  </Animated.Text>
                  {data.detail ? (
                    <Animated.Text
                      style={[styles.detailSubtitleBase, detailSubtitleMorphStyle]}
                      numberOfLines={3}
                    >
                      {data.detail}
                    </Animated.Text>
                  ) : null}
                  <Text style={styles.timeInBody}>{data.timeLabel}</Text>
                  <Animated.View style={detailPlaceholderWrapStyle}>
                    {data.boardId && onOpenBoard ? (
                      <Pressable
                        onPress={() => {
                          hapticLight();
                          onOpenBoard({
                            boardId: data.boardId!,
                            boardName: data.boardName,
                            cardId: data.cardId,
                          });
                        }}
                        style={[
                          styles.openBoardBtn,
                          { backgroundColor: colors.canvas, borderColor: colors.border },
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel="Open board"
                      >
                        <Text style={[styles.openBoardBtnText, { color: colors.textPrimary }]}>Open board</Text>
                        <Feather name="arrow-right" size={18} color="#0a0a0a" />
                      </Pressable>
                    ) : (
                      <Text style={styles.detailPlaceholder}>
                        Board shortcuts appear when this notification is linked to a board.
                      </Text>
                    )}
                  </Animated.View>
                </Animated.View>
              </Animated.View>
            </Animated.View>
          </Animated.View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0a0a0a',
  },
  cardFace: {
    flex: 1,
    backgroundColor: '#fff',
    position: 'relative',
  },
  listMimicLayer: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
    paddingHorizontal: 14,
    paddingLeft: 14,
    backgroundColor: '#fff',
  },
  mimicAvatar: {
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
  mimicTextCol: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  mimicHeadline: {
    fontSize: 15,
    fontWeight: '500',
    color: '#0a0a0a',
    lineHeight: 21,
  },
  mimicActor: {
    fontWeight: '700',
  },
  mimicDetail: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
    lineHeight: 18,
    fontWeight: '500',
  },
  mimicRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'center',
  },
  mimicTimeStack: {
    alignItems: 'flex-end',
    gap: 4,
  },
  mimicTime: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
  },
  expandedLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#fff',
  },
  cardFaceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  columnBadge: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginRight: 8,
  },
  closeBtn: {
    padding: 4,
  },
  detailBody: {
    flex: 1,
  },
  detailTitleBase: {
    fontWeight: '600',
    color: '#0a0a0a',
  },
  detailSubtitleBase: {
    color: '#666',
    fontWeight: '500',
  },
  timeInBody: {
    color: '#888',
    fontWeight: '600',
    fontSize: 13,
    marginTop: 10,
  },
  detailPlaceholder: {
    fontSize: 14,
    color: '#999',
    lineHeight: 20,
  },
  openBoardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1,
  },
  openBoardBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
});

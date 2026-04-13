import React, { useEffect, useMemo } from 'react';
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
  interpolateColor,
  Extrapolation,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { hapticLight } from '../utils/haptics';
import type { BoardCardData, TaskMember } from '../types/board';
import { TaskDetailContent } from './task/TaskDetailContent';
import { useTheme, type ThemeColors } from '../theme';

const CARD_SHIFT = 4;

const TEXT_FADE_IN: [number, number] = [0.1, 0.58];

const openConfig = {
  duration: 400,
  easing: Easing.out(Easing.cubic),
};

const closeConfig = {
  duration: 400,
  easing: Easing.out(Easing.cubic),
};

export type CardLayout = { x: number; y: number; width: number; height: number };

export type ExpandedCardLayout = {
  layout: CardLayout;
  columnIndex: number;
  cardIndex: number;
  columnTitle: string;
  cardId: string;
};

type Props = {
  layoutInfo: ExpandedCardLayout;
  card: BoardCardData;
  availableMembers?: TaskMember[];
  onUpdateCard: (next: BoardCardData) => void;
  onClose: () => void;
};

export function BoardCardExpandOverlay({
  layoutInfo,
  card,
  availableMembers = [],
  onUpdateCard,
  onClose,
}: Props) {
  const { colors, resolvedScheme } = useTheme();
  const styles = useMemo(() => createExpandOverlayStyles(colors), [colors]);
  const headerBorderTargets = useMemo(
    () =>
      resolvedScheme === 'dark'
        ? (['rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(255,255,255,0.1)'] as const)
        : (['rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.08)'] as const),
    [resolvedScheme]
  );

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
    ox.value = layoutInfo.layout.x;
    oy.value = layoutInfo.layout.y;
    ow.value = layoutInfo.layout.width;
    oh.value = layoutInfo.layout.height;
    tw.value = screenW;
    th.value = screenH;
    progress.value = 0;
    progress.value = withTiming(1, openConfig);
  }, [
    layoutInfo.layout.x,
    layoutInfo.layout.y,
    layoutInfo.layout.width,
    layoutInfo.layout.height,
    layoutInfo.columnIndex,
    layoutInfo.cardIndex,
    card.id,
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

  const headerChromeStyle = useMemo(
    () => ({
      paddingTop: Math.max(insets.top, 12),
      paddingBottom: 10,
      paddingHorizontal: 16,
    }),
    [insets.top]
  );

  const detailChromeStyle = useMemo(
    () => ({
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: Math.max(insets.bottom, 24),
    }),
    [insets.bottom]
  );

  const shellOuterStyle = useAnimatedStyle(() => {
    const t = progress.value;
    const left = interpolate(t, [0, 1], [ox.value, 0], Extrapolation.CLAMP);
    const top = interpolate(t, [0, 1], [oy.value, 0], Extrapolation.CLAMP);
    const width = interpolate(t, [0, 1], [ow.value, tw.value], Extrapolation.CLAMP);
    const height = interpolate(t, [0, 1], [oh.value, th.value], Extrapolation.CLAMP);
    const borderRadius = interpolate(t, [0, 1], [8, 0], Extrapolation.CLAMP);
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
      backgroundColor: colors.surfaceElevated,
      shadowColor: colors.border,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity,
      shadowRadius: 16,
      elevation,
    };
  });

  const shellInnerClipStyle = useAnimatedStyle(() => {
    const t = progress.value;
    const borderRadius = interpolate(t, [0, 1], [8, 0], Extrapolation.CLAMP);
    return {
      flex: 1,
      borderRadius,
      overflow: 'hidden',
    };
  });

  const shellNeubShadowStyle = useAnimatedStyle(() => {
    const t = progress.value;
    const borderRadius = interpolate(t, [0, 1], [8, 0], Extrapolation.CLAMP);
    return {
      position: 'absolute',
      left: CARD_SHIFT,
      top: CARD_SHIFT,
      right: -CARD_SHIFT,
      bottom: -CARD_SHIFT,
      borderRadius,
      backgroundColor: colors.shadowFillColumn,
      borderWidth: 1,
      borderColor: colors.border,
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

  const headerRevealStyle = useAnimatedStyle(() => {
    const t = progress.value;
    const [a, b] = TEXT_FADE_IN;
    return {
      opacity: interpolate(t, [a, b], [0, 1], Extrapolation.CLAMP),
      transform: [
        {
          translateY: interpolate(t, [a, b], [8, 0], Extrapolation.CLAMP),
        },
      ],
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: interpolateColor(t, [a * 0.5, a, b + 0.04], headerBorderTargets),
    };
  });

  const detailContentRevealStyle = useAnimatedStyle(() => {
    const t = progress.value;
    const [a, b] = TEXT_FADE_IN;
    return {
      flex: 1,
      minHeight: 0,
      opacity: interpolate(t, [a, b], [0, 1], Extrapolation.CLAMP),
      transform: [
        {
          translateY: interpolate(t, [a, b], [12, 0], Extrapolation.CLAMP),
        },
      ],
    };
  });

  const cardOutlineStyle = useAnimatedStyle(() => ({
    borderWidth: interpolate(progress.value, [0, 0.45, 1], [1, 0, 0], Extrapolation.CLAMP),
    borderColor: colors.border,
  }));

  const handleClose = () => {
    hapticLight();
    progress.value = withTiming(0, closeConfig, (finished) => {
      if (finished) {
        runOnJS(onClose)();
      }
    });
  };

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent>
      <View style={styles.modalRoot} pointerEvents="box-none">
        <Animated.View style={[styles.backdrop, backdropStyle]} pointerEvents="auto">
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        </Animated.View>

        <Animated.View style={shellOuterStyle} pointerEvents="box-none">
          <Animated.View style={shellNeubShadowStyle} pointerEvents="none" />
          <Animated.View style={shellInnerClipStyle}>
            <Animated.View style={[styles.cardFace, cardOutlineStyle]}>
              <Animated.View style={[styles.cardFaceHeader, headerChromeStyle, headerRevealStyle]}>
                <Text style={styles.columnBadge} numberOfLines={1}>
                  {layoutInfo.columnTitle}
                </Text>
                <Pressable
                  onPress={handleClose}
                  hitSlop={12}
                  style={styles.closeBtn}
                  accessibilityLabel="Close"
                >
                  <Feather name="x" size={22} color={colors.iconPrimary} />
                </Pressable>
              </Animated.View>
              <View style={[styles.detailBody, detailChromeStyle]}>
                <Animated.View style={[styles.detailScrollWrap, detailContentRevealStyle]}>
                  <TaskDetailContent
                    key={card.id}
                    task={card}
                    onChange={onUpdateCard}
                    availableMembers={availableMembers}
                  />
                </Animated.View>
              </View>
            </Animated.View>
          </Animated.View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function createExpandOverlayStyles(colors: ThemeColors) {
  return StyleSheet.create({
    modalRoot: {
      flex: 1,
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.canvas,
    },
    cardFace: {
      flex: 1,
      backgroundColor: colors.surfaceElevated,
    },
    cardFaceHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    columnBadge: {
      flex: 1,
      fontSize: 12,
      fontWeight: '700',
      color: colors.sectionLabel,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginRight: 8,
    },
    closeBtn: {
      padding: 4,
    },
    detailBody: {
      flex: 1,
      minHeight: 0,
    },
    detailScrollWrap: {
      flex: 1,
      minHeight: 0,
    },
  });
}

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

const LIST_TITLE_SIZE = 14;
const LIST_TITLE_LH = 18;
const DETAIL_TITLE_SIZE = 22;
const DETAIL_TITLE_LH = 28;

/** Must match BoardCard so the close transition lands on the same silhouette. */
const CARD_SHIFT = 4;
const LIST_CARD_PAD_V = 10;

const openConfig = {
  duration: 380,
  easing: Easing.out(Easing.cubic),
};

const closeConfig = {
  duration: 420,
  easing: Easing.out(Easing.cubic),
};

export type CardLayout = { x: number; y: number; width: number; height: number };

export type ExpandedCardData = {
  title: string;
  subtitle?: string;
  labelColor?: string;
  columnTitle: string;
  layout: CardLayout;
  columnIndex: number;
  cardIndex: number;
};

type Props = {
  data: ExpandedCardData;
  onClose: () => void;
};

export function BoardCardExpandOverlay({ data, onClose }: Props) {
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
    data.title,
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

  /** Outer: shadow + radius — never combine overflow:hidden here or iOS drops the shadow until late. */
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
      backgroundColor: '#fff',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity,
      shadowRadius: 16,
      elevation,
    };
  });

  /** Inner: clip content to the same radius as the shell. */
  const shellInnerClipStyle = useAnimatedStyle(() => {
    const t = progress.value;
    const borderRadius = interpolate(t, [0, 1], [8, 0], Extrapolation.CLAMP);
    return {
      flex: 1,
      borderRadius,
      overflow: 'hidden',
    };
  });

  /** Same offset “stamp” shadow as BoardCard; fades out while expanding so corners/shadow aren’t late on close. */
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
      // Collapse matches BoardCard paddingVertical (10); expand adds safe-area inset for scroll room.
      paddingBottom: interpolate(t, [0, 1], [LIST_CARD_PAD_V, bottomPad], Extrapolation.CLAMP),
    };
  });

  const detailMetaStyle = useAnimatedStyle(() => {
    const t = progress.value;
    return {
      opacity: interpolate(t, [0, 0.35, 0.52, 1], [0, 0, 1, 1], Extrapolation.CLAMP),
      maxHeight: interpolate(t, [0, 0.32, 0.48, 1], [0, 0, 800, 1200], Extrapolation.CLAMP),
      overflow: 'hidden',
      transform: [
        {
          translateY: interpolate(t, [0, 0.5, 1], [4, 2, 0], Extrapolation.CLAMP),
        },
      ],
    };
  });

  /** BoardCard uses a 1px black outline; fade it out while expanded so it isn’t missing until unmount. */
  const cardOutlineStyle = useAnimatedStyle(() => ({
    borderWidth: interpolate(progress.value, [0, 0.45, 1], [1, 0, 0], Extrapolation.CLAMP),
    borderColor: '#000',
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
            <Animated.View
              style={[
                styles.cardFace,
                cardOutlineStyle,
                data.labelColor
                  ? { borderLeftWidth: 4, borderLeftColor: data.labelColor }
                  : undefined,
              ]}
            >
            <Animated.View style={[styles.cardFaceHeader, headerPaddingStyle]}>
              <Text style={styles.columnBadge} numberOfLines={1}>
                {data.columnTitle}
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
                {data.title}
              </Animated.Text>
              <Animated.View style={detailMetaStyle}>
                {data.subtitle ? (
                  <Text style={styles.detailSubtitle}>{data.subtitle}</Text>
                ) : null}
                <Text style={styles.detailPlaceholder}>
                  Add description, checklist, and more — coming soon.
                </Text>
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
  detailSubtitle: {
    fontSize: 15,
    color: '#666',
    marginTop: 4,
    fontWeight: '500',
  },
  detailPlaceholder: {
    fontSize: 14,
    color: '#999',
    marginTop: 20,
    lineHeight: 20,
  },
});

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

/** Smooth open — decelerate into place (Trello-like). */
const openConfig = {
  duration: 380,
  easing: Easing.out(Easing.cubic),
};

/** Smooth close — symmetric ease in-out, no spring overshoot. */
const closeConfig = {
  duration: 340,
  easing: Easing.inOut(Easing.cubic),
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

  const shellStyle = useAnimatedStyle(() => {
    const t = progress.value;
    const left = interpolate(t, [0, 1], [ox.value, 0], Extrapolation.CLAMP);
    const top = interpolate(t, [0, 1], [oy.value, 0], Extrapolation.CLAMP);
    const width = interpolate(t, [0, 1], [ow.value, tw.value], Extrapolation.CLAMP);
    const height = interpolate(t, [0, 1], [oh.value, th.value], Extrapolation.CLAMP);
    const borderRadius = interpolate(t, [0, 1], [8, 0], Extrapolation.CLAMP);
    const shadowOpacity = interpolate(t, [0, 0.75, 1], [0.18, 0.06, 0], Extrapolation.CLAMP);
    const elevation = interpolate(t, [0, 0.75, 1], [14, 6, 0], Extrapolation.CLAMP);
    return {
      position: 'absolute',
      left,
      top,
      width,
      height,
      borderRadius,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: Platform.OS === 'ios' ? shadowOpacity : 0,
      shadowRadius: 16,
      elevation: Platform.OS === 'android' ? elevation : 0,
    };
  });

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.08, 1], [0, 0.4, 0.48], Extrapolation.CLAMP),
  }));

  const chromeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.22, 1], [0, 0.85, 1], Extrapolation.CLAMP),
    transform: [
      {
        translateY: interpolate(progress.value, [0, 1], [8, 0], Extrapolation.CLAMP),
      },
    ],
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

        <Animated.View style={[styles.cardShell, shellStyle]} pointerEvents="box-none">
          <View
            style={[
              styles.cardFace,
              data.labelColor
                ? { borderLeftWidth: 4, borderLeftColor: data.labelColor }
                : undefined,
            ]}
          >
            <Animated.View
              style={[
                styles.cardFaceHeader,
                { paddingTop: Math.max(insets.top, 12) },
                chromeStyle,
              ]}
            >
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
            <View style={[styles.detailBody, { paddingBottom: Math.max(insets.bottom, 24) }]}>
              <Text style={styles.detailTitle} numberOfLines={4}>
                {data.title}
              </Text>
              <Animated.View style={chromeStyle}>
                {data.subtitle ? (
                  <Text style={styles.detailSubtitle}>{data.subtitle}</Text>
                ) : null}
                <Text style={styles.detailPlaceholder}>
                  Add description, checklist, and more — coming soon.
                </Text>
              </Animated.View>
            </View>
          </View>
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
  cardShell: {
    backgroundColor: '#fff',
  },
  cardFace: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 0,
    overflow: 'hidden',
  },
  cardFaceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
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
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  detailTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0a0a0a',
    lineHeight: 28,
  },
  detailSubtitle: {
    fontSize: 15,
    color: '#666',
    marginTop: 8,
    fontWeight: '500',
  },
  detailPlaceholder: {
    fontSize: 14,
    color: '#999',
    marginTop: 20,
    lineHeight: 20,
  },
});

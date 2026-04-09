import React, { useEffect } from 'react';
import { type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

type Variant = 'warm' | 'dark' | 'onWhite';

const BG: Record<Variant, string> = {
  warm: '#dfd9cf',
  dark: 'rgba(255,255,255,0.14)',
  onWhite: '#e8e4dc',
};

export function SkeletonBlock({
  width,
  height,
  borderRadius = 8,
  variant = 'warm',
  style,
}: {
  width?: DimensionValue;
  height: number;
  borderRadius?: number;
  variant?: Variant;
  style?: StyleProp<ViewStyle>;
}) {
  const phase = useSharedValue(0);

  useEffect(() => {
    phase.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 750, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 750, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, [phase]);

  const animated = useAnimatedStyle(() => ({
    opacity: 0.5 + phase.value * 0.42,
  }));

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: BG[variant],
          overflow: 'hidden',
        },
        style,
        animated,
      ]}
    />
  );
}

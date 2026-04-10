import React, { forwardRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { View as RNView } from 'react-native';
import type { ThemeColors } from '../theme/colors';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';

const SHIFT = 5;
const PRESS_DURATION = 60;

export const NEU_LIST_ROW_SHIFT = SHIFT;

type Props = {
  shadowStyle: object;
  topStyle: object;
  onPress: () => void;
  children: React.ReactNode;
};

export const NeuListRowPressable = forwardRef<RNView, Props>(function NeuListRowPressable(
  { shadowStyle, topStyle, onPress, children },
  ref
) {
  const offset = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: offset.value },
      { translateY: offset.value },
    ],
  }));

  return (
    <Pressable onPress={onPress} style={styles.wrap} onPressIn={() => {
      offset.value = withTiming(SHIFT, { duration: PRESS_DURATION });
    }} onPressOut={() => {
      cancelAnimation(offset);
      offset.value = 0;
    }}>
      <View style={[styles.shadow, shadowStyle]} />
      <Animated.View ref={ref} collapsable={false} style={[topStyle, animatedStyle]}>
        {children}
      </Animated.View>
    </Pressable>
  );
});

export const neuListRowShadowBase = {
  position: 'absolute' as const,
  left: SHIFT,
  top: SHIFT,
  right: -SHIFT,
  bottom: -SHIFT,
  borderRadius: 14,
  borderWidth: 1,
  borderColor: '#000' as const,
};

export function getNeuListRowCardBase(colors: ThemeColors) {
  return {
    position: 'relative' as const,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: colors.cardFace,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 16,
    paddingHorizontal: 16,
    paddingLeft: 14,
  };
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    marginRight: SHIFT,
    marginBottom: SHIFT,
  },
  shadow: neuListRowShadowBase,
});

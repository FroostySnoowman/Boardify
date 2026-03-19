import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGradualAnimation } from '@/hooks/useGradualAnimation';

type KeyboardSpacerProps = {
  baseHeight?: number;
  extraOffset?: number;
  style?: StyleProp<ViewStyle>;
};

export const KeyboardSpacer = ({ baseHeight, extraOffset = 0, style }: KeyboardSpacerProps) => {
  const insets = useSafeAreaInsets();
  const resolvedBase = baseHeight != null ? baseHeight : Math.max(insets.bottom + extraOffset, 0);
  const { height } = useGradualAnimation(resolvedBase);

  const spacerStyle = useAnimatedStyle(() => ({ height: height.value }), [height]);

  return <Animated.View pointerEvents="none" style={[{ width: '100%' }, spacerStyle, style]} />;
};

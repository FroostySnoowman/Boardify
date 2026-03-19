import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGradualAnimation } from '@/hooks/useGradualAnimation';

type KeyboardSpacerProps = {
  /**
   * Optional fixed base height. Use when a screen already accounts for tab bars or custom chrome.
   */
  baseHeight?: number;
  /**
   * Additional padding to add on top of the safe area inset. Ignored when baseHeight is provided.
   */
  extraOffset?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Animated spacer that follows the keyboard height while keeping a minimum inset.
 * Based on ChatRoomScreen's gradual animation approach.
 */
export const KeyboardSpacer = ({ baseHeight, extraOffset = 0, style }: KeyboardSpacerProps) => {
  const insets = useSafeAreaInsets();
  const resolvedBase = baseHeight != null ? baseHeight : Math.max(insets.bottom + extraOffset, 0);
  const { height } = useGradualAnimation(resolvedBase);

  const spacerStyle = useAnimatedStyle(() => ({ height: height.value }), [height]);

  return <Animated.View pointerEvents="none" style={[{ width: '100%' }, spacerStyle, style]} />;
};


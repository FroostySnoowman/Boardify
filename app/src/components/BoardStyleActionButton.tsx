import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, type TextStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import { useTheme } from '../theme';

const SHIFT = 5;
const PRESS_IN = 60;
const PRESS_OUT = 100;

type Props = {
  shadowColor: string;
  onPress: () => void;
  disabled?: boolean;
  label: string;
  labelStyle?: TextStyle;
  layout?: 'row' | 'stack';
  leading?: React.ReactNode;
};

export function BoardStyleActionButton({
  shadowColor,
  onPress,
  disabled,
  label,
  labelStyle = {},
  layout = 'row',
  leading,
}: Props) {
  const { colors } = useTheme();
  const themed = useMemo(
    () =>
      StyleSheet.create({
        boardBtnShadow: {
          position: 'absolute',
          left: SHIFT,
          top: SHIFT,
          right: -SHIFT,
          bottom: -SHIFT,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.border,
          zIndex: 0,
        },
        boardBtnFace: {
          position: 'relative',
          zIndex: 1,
          elevation: 4,
          backgroundColor: colors.surfaceElevated,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.border,
          paddingVertical: 16,
          paddingHorizontal: 16,
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 52,
        },
        boardBtnFaceDisabled: {
          backgroundColor: colors.surfaceMuted,
        },
        boardBtnLabel: {
          fontSize: 17,
          fontWeight: '700',
          textAlign: 'center',
          width: '100%',
          color: colors.textPrimary,
        },
      }),
    [colors]
  );

  const offset = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }, { translateY: offset.value }],
  }));

  const labelStyles = [themed.boardBtnLabel, labelStyle];

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => {
        if (!disabled) {
          offset.value = withTiming(SHIFT, { duration: PRESS_IN });
        }
      }}
      onPressOut={() => {
        cancelAnimation(offset);
        offset.value = 0;
      }}
      style={[styles.boardBtnWrap, layout === 'stack' && styles.boardBtnWrapStack]}
    >
      <View
        style={[themed.boardBtnShadow, { backgroundColor: shadowColor }]}
        pointerEvents="none"
      />
      <Animated.View
        style={[
          themed.boardBtnFace,
          disabled && themed.boardBtnFaceDisabled,
          animatedStyle,
        ]}
      >
        {leading ? (
          <View style={styles.boardBtnRow}>
            {leading}
            <Text style={[...labelStyles, styles.boardBtnLabelWithLeading]}>{label}</Text>
          </View>
        ) : (
          <Text style={labelStyles}>{label}</Text>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  boardBtnWrap: {
    position: 'relative',
    flex: 1,
    minWidth: 0,
    marginRight: SHIFT,
    marginBottom: SHIFT,
    zIndex: 0,
  },
  boardBtnWrapStack: {
    flex: 0,
    width: '100%',
    alignSelf: 'stretch',
    marginRight: 0,
  },
  boardBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
  },
  boardBtnLabelWithLeading: {
    flexShrink: 1,
    textAlign: 'left',
  },
});

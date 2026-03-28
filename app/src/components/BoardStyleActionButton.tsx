import React from 'react';
import { View, Text, Pressable, StyleSheet, type TextStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';

const SHIFT = 5;
const PRESS_IN = 60;
const PRESS_OUT = 100;

type Props = {
  shadowColor: string;
  onPress: () => void;
  disabled?: boolean;
  label: string;
  labelStyle: TextStyle;
};

export function BoardStyleActionButton({
  shadowColor,
  onPress,
  disabled,
  label,
  labelStyle,
}: Props) {
  const offset = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }, { translateY: offset.value }],
  }));

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
      style={styles.boardBtnWrap}
    >
      <View
        style={[styles.boardBtnShadow, { backgroundColor: shadowColor }]}
        pointerEvents="none"
      />
      <Animated.View
        style={[
          styles.boardBtnFace,
          disabled && styles.boardBtnFaceDisabled,
          animatedStyle,
        ]}
      >
        <Text style={[styles.boardBtnLabel, labelStyle]}>{label}</Text>
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
  boardBtnShadow: {
    position: 'absolute',
    left: SHIFT,
    top: SHIFT,
    right: -SHIFT,
    bottom: -SHIFT,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#000',
    zIndex: 0,
  },
  boardBtnFace: {
    position: 'relative',
    zIndex: 1,
    elevation: 4,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#000',
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  boardBtnFaceDisabled: {
    backgroundColor: '#eee',
  },
  boardBtnLabel: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    width: '100%',
    color: '#0a0a0a',
  },
});

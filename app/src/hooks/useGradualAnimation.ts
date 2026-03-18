import { useKeyboardHandler } from 'react-native-keyboard-controller';
import {
  cancelAnimation,
  Easing,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

export const useGradualAnimation = (baseOffset: number = 0) => {
  const keyboardHeight = useSharedValue(0);
  const keyboardProgress = useSharedValue(0);
  const height = useDerivedValue(() => Math.max(baseOffset, keyboardHeight.value), [baseOffset]);

  const clampHeight = (value: number) => {
    'worklet';
    return Math.max(value, 0);
  };
  const clampProgress = (value: number) => {
    'worklet';
    return Math.min(1, Math.max(value, 0));
  };

  const setHeight = (value: number, duration?: number) => {
    'worklet';
    const next = clampHeight(value);
    if (duration && duration > 0) {
      keyboardHeight.value = withTiming(next, {
        duration,
        easing: Easing.out(Easing.cubic),
      });
    } else {
      keyboardHeight.value = next;
    }
  };
  const setProgress = (value: number, duration?: number) => {
    'worklet';
    const next = clampProgress(value);
    if (duration && duration > 0) {
      keyboardProgress.value = withTiming(next, {
        duration,
        easing: Easing.out(Easing.cubic),
      });
    } else {
      keyboardProgress.value = next;
    }
  };

  useKeyboardHandler(
    {
      onStart: (e) => {
        'worklet';
        cancelAnimation(keyboardHeight);
        cancelAnimation(keyboardProgress);
        setHeight(e.height, e.duration);
        setProgress(e.progress, e.duration);
      },
      onMove: (e) => {
        'worklet';
        cancelAnimation(keyboardHeight);
        cancelAnimation(keyboardProgress);
        keyboardHeight.value = clampHeight(e.height);
        keyboardProgress.value = clampProgress(e.progress);
      },
      onInteractive: (e) => {
        'worklet';
        cancelAnimation(keyboardHeight);
        cancelAnimation(keyboardProgress);
        keyboardHeight.value = clampHeight(e.height);
        keyboardProgress.value = clampProgress(e.progress);
      },
      onEnd: (e) => {
        'worklet';
        setHeight(e.height, e.duration);
        setProgress(e.progress, e.duration);
      },
    },
    [baseOffset],
  );

  return { height, keyboardHeight, progress: keyboardProgress };
};

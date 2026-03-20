import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import { Stack, router, useFocusEffect } from 'expo-router';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hapticLight } from '../src/utils/haptics';

const BELOW_HEADER_GAP = 10;

const BG = '#f5f0e8';
const SHIFT = 5;
const PRESS_IN = 60;
const PRESS_OUT = 100;

function BoardStyleButton({
  shadowColor,
  onPress,
  disabled,
  label,
  labelStyle,
}: {
  shadowColor: string;
  onPress: () => void;
  disabled?: boolean;
  label: string;
  labelStyle: object;
}) {
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

export default function CreateBoardScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const [name, setName] = useState('');
  const inputRef = useRef<TextInput>(null);

  useFocusEffect(
    useCallback(() => {
      const t = setTimeout(() => inputRef.current?.focus(), 400);
      return () => clearTimeout(t);
    }, [])
  );

  const trimmed = name.trim();
  const canSubmit = trimmed.length > 0;

  const submit = () => {
    if (!canSubmit) return;
    hapticLight();
    Keyboard.dismiss();
    router.replace({ pathname: '/board', params: { boardName: trimmed } });
  };

  const close = () => {
    hapticLight();
    Keyboard.dismiss();
    router.back();
  };

  return (
    <View style={styles.container}>
      <Stack.Screen>
        <Stack.Header
          style={
            Platform.OS === 'ios'
              ? { backgroundColor: 'transparent' }
              : { backgroundColor: BG }
          }
        />
        <Stack.Screen.Title style={{ fontWeight: '800', color: '#0a0a0a' }}>
          New board
        </Stack.Screen.Title>
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button icon="xmark" onPress={close} tintColor="#0a0a0a" />
        </Stack.Toolbar>
      </Stack.Screen>

      <KeyboardAvoidingView
        style={[styles.flex, styles.sheetFill]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
      >
        <ScrollView
          style={styles.sheetFill}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: headerHeight + BELOW_HEADER_GAP,
              paddingBottom: insets.bottom + 28,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <Text style={styles.helper}>
              Pick a name now — you can change it later from board settings.
            </Text>

            <Text style={styles.label}>Board name</Text>
            <TextInput
              ref={inputRef}
              value={name}
              onChangeText={setName}
              placeholder="My project board"
              placeholderTextColor="#888"
              style={styles.input}
              returnKeyType="done"
              onSubmitEditing={submit}
              maxLength={80}
              autoCorrect={false}
              autoCapitalize="sentences"
            />

            <View style={styles.actions}>
              <BoardStyleButton
                shadowColor="#e0e0e0"
                onPress={close}
                label="Cancel"
                labelStyle={styles.labelCancel}
              />
              <BoardStyleButton
                shadowColor={canSubmit ? '#a5d6a5' : '#d0d0d0'}
                onPress={submit}
                disabled={!canSubmit}
                label="Create"
                labelStyle={canSubmit ? styles.labelCreate : styles.labelCreateDisabled}
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const cardShadow =
  Platform.OS === 'ios'
    ? {
        shadowColor: '#000',
        shadowOffset: { width: 5, height: 5 },
        shadowOpacity: 0.2,
        shadowRadius: 0,
      }
    : { elevation: 5 };

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  flex: {
    flex: 1,
  },
  sheetFill: {
    flex: 1,
    backgroundColor: BG,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    paddingHorizontal: 20,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  card: {
    alignSelf: 'stretch',
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000',
    padding: 24,
    ...cardShadow,
  },
  helper: {
    fontSize: 15,
    lineHeight: 22,
    color: '#444',
    marginBottom: 22,
    fontWeight: '500',
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0a0a0a',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  input: {
    fontSize: 17,
    fontWeight: '600',
    color: '#0a0a0a',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: BG,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 28,
    gap: 12,
    width: '100%',
    overflow: 'hidden',
    paddingBottom: SHIFT + 6,
  },
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
  labelCancel: {
    color: '#0a0a0a',
  },
  labelCreate: {
    color: '#0a0a0a',
  },
  labelCreateDisabled: {
    color: '#888',
  },
});

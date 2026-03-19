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
import { Stack, router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hapticLight } from '../src/utils/haptics';

const BG = '#f5f0e8';

export default function CreateBoardScreen() {
  const insets = useSafeAreaInsets();
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
            { paddingBottom: insets.bottom + 28 },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <Text style={styles.helper}>
              Pick a name now — you can change it later in board settings.
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
              <Pressable
                onPress={close}
                style={({ pressed }) => [styles.btn, styles.btnCancel, pressed && styles.pressed]}
              >
                <Text style={styles.btnCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={submit}
                disabled={!canSubmit}
                style={({ pressed }) => [
                  styles.btn,
                  styles.btnCreate,
                  !canSubmit && styles.btnCreateDisabled,
                  pressed && canSubmit && styles.pressed,
                ]}
              >
                <Text
                  style={[styles.btnCreateText, !canSubmit && styles.btnCreateTextDisabled]}
                >
                  Create
                </Text>
              </Pressable>
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
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 48,
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
    alignItems: 'stretch',
    marginTop: 28,
    gap: 12,
  },
  btn: {
    flex: 1,
    minHeight: 50,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  btnCancel: {
    backgroundColor: '#e8e8e8',
  },
  btnCancelText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0a0a0a',
  },
  btnCreate: {
    backgroundColor: '#a5d6a5',
  },
  btnCreateDisabled: {
    backgroundColor: '#ddd',
    borderColor: '#999',
  },
  btnCreateText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0a0a0a',
  },
  btnCreateTextDisabled: {
    color: '#888',
  },
  pressed: {
    opacity: 0.88,
  },
});

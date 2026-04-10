import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
} from 'react-native';
import { Stack, router, useFocusEffect } from 'expo-router';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hapticLight } from '../src/utils/haptics';
import { BoardStyleActionButton } from '../src/components/BoardStyleActionButton';
import { createBoard } from '../src/api/boards';
import { useTheme } from '../src/theme';
import type { ThemeColors } from '../src/theme/colors';

const BELOW_HEADER_GAP = 10;

function createCreateBoardStyles(colors: ThemeColors) {
  const cardShadow =
    Platform.OS === 'ios'
      ? {
          shadowColor: '#000',
          shadowOffset: { width: 5, height: 5 },
          shadowOpacity: 0.2,
          shadowRadius: 0,
        }
      : { elevation: 5 };

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.modalCreamCanvas,
    },
    flex: {
      flex: 1,
    },
    sheetFill: {
      flex: 1,
      backgroundColor: colors.modalCreamCanvas,
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
      backgroundColor: colors.surfaceElevated,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: colors.border,
      padding: 24,
      ...cardShadow,
    },
    helper: {
      fontSize: 15,
      lineHeight: 22,
      color: colors.textSecondary,
      marginBottom: 22,
      fontWeight: '500',
    },
    label: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.textPrimary,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 10,
    },
    input: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.textPrimary,
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 14,
      backgroundColor: colors.modalCreamCanvas,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginTop: 28,
      gap: 12,
      width: '100%',
      overflow: 'hidden',
      paddingBottom: 11,
    },
    labelCancel: {
      color: colors.textPrimary,
    },
    labelCreate: {
      color: colors.textPrimary,
    },
    labelCreateDisabled: {
      color: colors.textTertiary,
    },
  });
}

export default function CreateBoardScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createCreateBoardStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useFocusEffect(
    useCallback(() => {
      const t = setTimeout(() => inputRef.current?.focus(), 400);
      return () => clearTimeout(t);
    }, [])
  );

  const trimmed = name.trim();
  const canSubmit = trimmed.length > 0;

  const submit = async () => {
    if (!canSubmit || submitting) return;
    hapticLight();
    Keyboard.dismiss();
    setSubmitting(true);
    try {
      const { board } = await createBoard({ name: trimmed });
      router.replace({
        pathname: '/board',
        params: { boardId: board.id, boardName: board.name },
      });
    } catch {
      setSubmitting(false);
    }
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
              : { backgroundColor: colors.modalCreamCanvas }
          }
        />
        <Stack.Screen.Title style={{ fontWeight: '800', color: colors.modalCreamHeaderTint }}>
          New board
        </Stack.Screen.Title>
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button icon="xmark" onPress={close} tintColor={colors.modalCreamHeaderTint} />
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
              placeholderTextColor={colors.placeholder}
              style={styles.input}
              returnKeyType="done"
              onSubmitEditing={submit}
              maxLength={80}
              autoCorrect={false}
              autoCapitalize="sentences"
            />

            <View style={styles.actions}>
              <BoardStyleActionButton
                shadowColor={colors.shadowFill}
                onPress={close}
                label="Cancel"
                labelStyle={styles.labelCancel}
              />
              <BoardStyleActionButton
                shadowColor={canSubmit && !submitting ? colors.success : colors.shadowFill}
                onPress={() => void submit()}
                disabled={!canSubmit || submitting}
                label={submitting ? 'Creating…' : 'Create'}
                labelStyle={canSubmit && !submitting ? styles.labelCreate : styles.labelCreateDisabled}
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

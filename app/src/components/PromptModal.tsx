import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hapticLight } from '../utils/haptics';
import { useTheme } from '../theme';

type Props = {
  visible: boolean;
  title: string;
  placeholder?: string;
  initialValue?: string;
  confirmLabel?: string;
  onCancel: () => void;
  onSubmit: (text: string) => void;
};

export function PromptModal({
  visible,
  title,
  placeholder = '',
  initialValue = '',
  confirmLabel = 'Add',
  onCancel,
  onSubmit,
}: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [text, setText] = useState(initialValue);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        backdrop: {
          flex: 1,
          backgroundColor: colors.overlayScrim,
          justifyContent: 'flex-end',
        },
        sheet: {
          backgroundColor: colors.surface,
          borderRadius: 14,
          borderWidth: 2,
          borderColor: colors.border,
          padding: 18,
          maxWidth: 400,
          alignSelf: 'center',
          width: '100%',
        },
        title: {
          fontSize: 17,
          fontWeight: '800',
          color: colors.textPrimary,
          marginBottom: 12,
        },
        input: {
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 12,
          fontSize: 16,
          color: colors.textPrimary,
          backgroundColor: colors.inputBackground,
          marginBottom: 16,
        },
        actions: {
          flexDirection: 'row',
          justifyContent: 'flex-end',
          gap: 12,
        },
        btnSecondary: {
          paddingVertical: 10,
          paddingHorizontal: 14,
        },
        btnSecondaryText: {
          fontSize: 16,
          fontWeight: '600',
          color: colors.textSecondary,
        },
        btnPrimary: {
          backgroundColor: colors.primaryButtonBg,
          paddingVertical: 10,
          paddingHorizontal: 18,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.border,
        },
        btnPrimaryText: {
          fontSize: 16,
          fontWeight: '700',
          color: colors.primaryButtonText,
        },
      }),
    [colors]
  );

  useEffect(() => {
    if (visible) setText(initialValue);
  }, [visible, initialValue]);

  const submit = () => {
    const t = text.trim();
    if (!t) {
      hapticLight();
      return;
    }
    hapticLight();
    onSubmit(t);
    onCancel();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View
          style={[
            styles.sheet,
            {
              marginBottom: Math.max(insets.bottom, 16),
              marginHorizontal: 20,
            },
          ]}
        >
          <Text style={styles.title}>{title}</Text>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={placeholder}
            placeholderTextColor={colors.placeholder}
            style={styles.input}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={submit}
          />
          <View style={styles.actions}>
            <Pressable onPress={onCancel} style={styles.btnSecondary}>
              <Text style={styles.btnSecondaryText}>Cancel</Text>
            </Pressable>
            <Pressable onPress={submit} style={styles.btnPrimary}>
              <Text style={styles.btnPrimaryText}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

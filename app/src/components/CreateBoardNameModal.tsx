import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Modal,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hapticLight } from '../utils/haptics';

const SHIFT = 4;

type Props = {
  visible: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
};

export function CreateBoardNameModal({ visible, onClose, onCreate }: Props) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setName('');
      const t = setTimeout(() => inputRef.current?.focus(), 300);
      return () => clearTimeout(t);
    }
  }, [visible]);

  const trimmed = name.trim();
  const canSubmit = trimmed.length > 0;

  const submit = () => {
    if (!canSubmit) return;
    hapticLight();
    Keyboard.dismiss();
    onCreate(trimmed);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.flex}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Dismiss" />

        <KeyboardAvoidingView
          style={styles.kav}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          pointerEvents="box-none"
        >
        <View style={styles.center} pointerEvents="box-none">
          <View style={styles.cardWrap}>
            <View style={styles.cardShadow} />
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>New board</Text>
                <Pressable
                  onPress={() => {
                    hapticLight();
                    Keyboard.dismiss();
                    onClose();
                  }}
                  hitSlop={12}
                  style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
                  accessibilityLabel="Close"
                >
                  <Feather name="x" size={22} color="#0a0a0a" />
                </Pressable>
              </View>

              <Text style={styles.label}>Name</Text>
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
                  onPress={() => {
                    hapticLight();
                    Keyboard.dismiss();
                    onClose();
                  }}
                  style={({ pressed }) => [styles.btnSecondary, pressed && styles.btnPressed]}
                >
                  <Text style={styles.btnSecondaryText}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={submit}
                  disabled={!canSubmit}
                  style={({ pressed }) => [
                    styles.btnPrimary,
                    !canSubmit && styles.btnPrimaryDisabled,
                    pressed && canSubmit && styles.btnPressed,
                  ]}
                >
                  <Text style={[styles.btnPrimaryText, !canSubmit && styles.btnPrimaryTextDisabled]}>Create</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>

        <View style={{ height: Math.max(insets.bottom, 16) }} />
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  kav: {
    flex: 1,
    justifyContent: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 10, 10, 0.45)',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
  },
  cardWrap: {
    position: 'relative',
  },
  cardShadow: {
    position: 'absolute',
    left: SHIFT,
    top: SHIFT,
    right: -SHIFT,
    bottom: -SHIFT,
    backgroundColor: '#000',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#000',
  },
  card: {
    position: 'relative',
    zIndex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#000',
    padding: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0a0a0a',
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#000',
    backgroundColor: '#f5f0e8',
  },
  closeBtnPressed: {
    opacity: 0.88,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  input: {
    fontSize: 17,
    fontWeight: '600',
    color: '#0a0a0a',
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#faf8f4',
    marginBottom: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
  },
  btnSecondary: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#000',
    backgroundColor: '#e8e8e8',
  },
  btnSecondaryText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0a0a0a',
  },
  btnPrimary: {
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#000',
    backgroundColor: '#a5d6a5',
    minWidth: 100,
    alignItems: 'center',
  },
  btnPrimaryDisabled: {
    backgroundColor: '#ddd',
    borderColor: '#999',
  },
  btnPrimaryText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0a0a0a',
  },
  btnPrimaryTextDisabled: {
    color: '#888',
  },
  btnPressed: {
    opacity: 0.9,
  },
});

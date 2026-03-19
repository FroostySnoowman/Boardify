import React, { useState } from 'react';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, Platform, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { updateConversation } from '../src/api/messages';
import { hapticLight } from '../src/utils/haptics';
import { KeyboardSpacer } from '@/components/KeyboardSpacer';

const BACKGROUND_COLOR = '#020617';

const TEAM_ROLES = ['Owner', 'Coach', 'Player', 'Spectator'];

export default function EditChatScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ conversationId: string; teamId: string; name?: string }>();
  const conversationId = params.conversationId;
  const teamId = params.teamId;
  const initialName = params.name ?? '';

  const [editName, setEditName] = useState(initialName);
  const [editAccessType, setEditAccessType] = useState<'everyone' | 'roles'>('everyone');
  const [editRoles, setEditRoles] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!editName.trim() || !conversationId) return;
    setSaving(true);
    hapticLight();
    try {
      const payload: { name?: string; accessType: string; roles?: string[] } = {
        accessType: editAccessType,
      };
      if (editName.trim()) payload.name = editName.trim();
      if (editAccessType === 'roles') payload.roles = editRoles;
      await updateConversation(conversationId, payload);
      router.back();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update chat');
    } finally {
      setSaving(false);
    }
  };

  const toggleRole = (role: string) => {
    hapticLight();
    setEditRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen>
        <Stack.Header
          style={(Platform.OS === 'android' || Platform.OS === 'web') ? { backgroundColor: BACKGROUND_COLOR } : undefined}
         />
          <Stack.Screen.Title style={{ fontWeight: '800', color: '#ffffff' }}>
            Edit Chat
          </Stack.Screen.Title>
          <Stack.Toolbar placement="left">
            <Stack.Toolbar.Button
              icon="xmark"
              onPress={() => router.back()}
              tintColor="#ffffff"
            />
          </Stack.Toolbar>
      </Stack.Screen>

      <LinearGradient
        colors={['rgba(96, 165, 250, 0.18)', 'rgba(34, 197, 94, 0.14)', 'rgba(2, 6, 23, 0.95)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 16,
        }}
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      >
        <View style={{ maxWidth: 768, alignSelf: 'center', width: '100%' }}>
          <View style={styles.card}>
            <Text style={styles.label}>CHAT NAME</Text>
            <TextInput
              style={styles.input}
              value={editName}
              onChangeText={setEditName}
              placeholder="Chat name"
              placeholderTextColor="#6b7280"
              autoCorrect={false}
            />

            <Text style={[styles.label, { marginTop: 8 }]}>WHO CAN ACCESS</Text>
            <View style={{ gap: 8, marginTop: 8 }}>
              {(
                [
                  { value: 'everyone' as const, label: 'Everyone', desc: 'All team members' },
                  { value: 'roles' as const, label: 'By Role', desc: 'Specific roles only' },
                ] as const
              ).map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => {
                    hapticLight();
                    setEditAccessType(opt.value);
                  }}
                  style={[
                    styles.radioRow,
                    editAccessType === opt.value && styles.radioRowSelected,
                  ]}
                  activeOpacity={0.7}
                >
                  <View style={[styles.radioOuter, editAccessType === opt.value && styles.radioOuterSelected]}>
                    {editAccessType === opt.value && <View style={styles.radioInner} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.radioLabel}>{opt.label}</Text>
                    <Text style={styles.radioDesc}>{opt.desc}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {editAccessType === 'roles' && (
              <View style={{ marginTop: 20 }}>
                <Text style={styles.label}>ALLOWED ROLES</Text>
                <View style={{ gap: 6, marginTop: 8 }}>
                  {TEAM_ROLES.map(role => {
                    const selected = editRoles.includes(role);
                    return (
                      <TouchableOpacity
                        key={role}
                        onPress={() => toggleRole(role)}
                        style={[styles.checkRow, selected && styles.checkRowSelected]}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                          {selected && <Feather name="check" size={14} color="#ffffff" />}
                        </View>
                        <Text style={styles.checkLabel}>{role}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
          </View>

          <View style={[styles.footer, { paddingBottom: insets.bottom + 8 }]}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.cancelButton}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving || !editName.trim()}
              style={[
                styles.saveButton,
                (saving || !editName.trim()) && styles.saveButtonDisabled,
              ]}
              activeOpacity={0.7}
            >
              {saving ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.saveButtonText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
      <KeyboardSpacer extraOffset={72} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
  },
  scroll: {
    flex: 1,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 24,
  },
  label: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#ffffff',
    fontSize: 16,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  radioRowSelected: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#6b7280',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: '#3b82f6',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#3b82f6',
  },
  radioLabel: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '500',
  },
  radioDesc: {
    color: '#6b7280',
    fontSize: 13,
    marginTop: 1,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  checkRowSelected: {
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#6b7280',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    borderColor: '#3b82f6',
    backgroundColor: '#3b82f6',
  },
  checkLabel: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 24,
    paddingHorizontal: 0,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#9ca3af',
    fontSize: 15,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: 'rgba(59, 130, 246, 0.3)',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
});

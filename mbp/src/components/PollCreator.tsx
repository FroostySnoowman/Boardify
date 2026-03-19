import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { hapticLight, hapticMedium } from '../utils/haptics';
import { createPoll } from '../api/messages';
import { PlatformBottomSheet } from './PlatformBottomSheet';

interface PollCreatedResult {
  id: string;
  pollId: string;
  sentAt: string;
  question: string;
  options: string[];
  allowMultiple: boolean;
  anonymous: boolean;
}

interface PollCreatorProps {
  isOpened: boolean;
  onClose: () => void;
  conversationId: string;
  onPollCreated?: (result: PollCreatedResult) => void;
}

export function PollCreator({ isOpened, onClose, conversationId, onPollCreated }: PollCreatorProps) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [anonymous, setAnonymous] = useState(false);
  const [creating, setCreating] = useState(false);

  const addOption = () => {
    if (options.length >= 10) return;
    hapticLight();
    setOptions([...options, '']);
  };

  const removeOption = (index: number) => {
    if (options.length <= 2) return;
    hapticLight();
    setOptions(options.filter((_, i) => i !== index));
  };

  const updateOption = (index: number, value: string) => {
    const updated = [...options];
    updated[index] = value;
    setOptions(updated);
  };

  const handleCreate = async () => {
    const trimmedQuestion = question.trim();
    const trimmedOptions = options.map(o => o.trim()).filter(o => o.length > 0);

    if (!trimmedQuestion) {
      Alert.alert('Error', 'Please enter a question');
      return;
    }
    if (trimmedOptions.length < 2) {
      Alert.alert('Error', 'Please add at least 2 options');
      return;
    }

    hapticMedium();
    setCreating(true);

    try {
      const result = await createPoll(conversationId, trimmedQuestion, trimmedOptions, allowMultiple, anonymous);
      const createdData: PollCreatedResult = {
        id: result.id,
        pollId: result.pollId,
        sentAt: result.sentAt,
        question: trimmedQuestion,
        options: trimmedOptions,
        allowMultiple,
        anonymous,
      };
      resetForm();
      onClose();
      onPollCreated?.(createdData);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to create poll');
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setQuestion('');
    setOptions(['', '']);
    setAllowMultiple(false);
    setAnonymous(false);
  };

  return (
    <PlatformBottomSheet
      isOpened={isOpened}
      onIsOpenedChange={(opened) => {
        if (!opened) {
          resetForm();
          onClose();
        }
      }}
      presentationDetents={[0.85]}
      presentationDragIndicator="visible"
    >
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => {
            hapticLight();
            resetForm();
            onClose();
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={s.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={s.title}>Create Poll</Text>
        <TouchableOpacity
          onPress={handleCreate}
          disabled={creating}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {creating ? (
            <ActivityIndicator size="small" color="#a855f7" />
          ) : (
            <Text style={s.createText}>Create</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={s.body}
        contentContainerStyle={s.bodyContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.sectionLabel}>Question</Text>
        <TextInput
          value={question}
          onChangeText={setQuestion}
          placeholder="Ask a question..."
          placeholderTextColor="#6b7280"
          style={s.questionInput}
          multiline
          maxLength={200}
        />

        <Text style={s.sectionLabel}>Options</Text>
        {options.map((opt, i) => (
          <View key={i} style={s.optionRow}>
            <View style={s.optionInputContainer}>
              <Text style={s.optionNumber}>{i + 1}.</Text>
              <TextInput
                value={opt}
                onChangeText={(v) => updateOption(i, v)}
                placeholder={`Option ${i + 1}`}
                placeholderTextColor="#6b7280"
                style={s.optionInput}
                maxLength={100}
              />
            </View>
            {options.length > 2 && (
              <TouchableOpacity
                onPress={() => removeOption(i)}
                style={s.removeButton}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather name="x-circle" size={18} color="#6b7280" />
              </TouchableOpacity>
            )}
          </View>
        ))}

        {options.length < 10 && (
          <TouchableOpacity onPress={addOption} style={s.addOptionButton}>
            <Feather name="plus-circle" size={16} color="#a855f7" />
            <Text style={s.addOptionText}>Add option</Text>
          </TouchableOpacity>
        )}

        <Text style={[s.sectionLabel, { marginTop: 8 }]}>Settings</Text>
        <View style={s.settingsCard}>
          <View style={[s.settingRow, s.settingRowBorder]}>
            <Text style={s.settingText}>Allow multiple votes</Text>
            <Switch
              value={allowMultiple}
              onValueChange={setAllowMultiple}
              trackColor={{ false: '#334155', true: '#7c3aed' }}
              thumbColor="#ffffff"
            />
          </View>
          <View style={s.settingRow}>
            <Text style={s.settingText}>Anonymous voting</Text>
            <Switch
              value={anonymous}
              onValueChange={setAnonymous}
              trackColor={{ false: '#334155', true: '#7c3aed' }}
              thumbColor="#ffffff"
            />
          </View>
        </View>
      </ScrollView>
    </PlatformBottomSheet>
  );
}

const INPUT_HEIGHT = 48;

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  cancelText: {
    color: '#9ca3af',
    fontSize: 16,
  },
  title: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '600',
  },
  createText: {
    color: '#a855f7',
    fontSize: 16,
    fontWeight: '600',
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  sectionLabel: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  questionInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#ffffff',
    fontSize: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 24,
    minHeight: INPUT_HEIGHT,
    textAlignVertical: 'center',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  optionInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
    height: INPUT_HEIGHT,
    paddingHorizontal: 16,
  },
  optionNumber: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '500',
    marginRight: 8,
    width: 18,
  },
  optionInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 16,
    height: INPUT_HEIGHT,
    padding: 0,
    ...Platform.select({
      android: { textAlignVertical: 'center' as const },
    }),
  },
  removeButton: {
    padding: 6,
  },
  addOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    marginBottom: 20,
  },
  addOptionText: {
    color: '#a855f7',
    fontSize: 14,
    fontWeight: '500',
  },
  settingsCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
    marginBottom: 24,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  settingRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  settingText: {
    color: '#e2e8f0',
    fontSize: 15,
  },
});

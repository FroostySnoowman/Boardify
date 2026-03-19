import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Platform, ActionSheetIOS } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { listMatchHistory, MatchHistoryItem, Note, listNotes, createNote, deleteNote, updateNote } from '../../api/matches';
import { Skeleton } from '../../components/Skeleton';
import { hapticLight } from '../../utils/haptics';
import { KeyboardSpacer } from '@/components/KeyboardSpacer';
import { ContextMenu } from '../../components/ContextMenu';

const BACKGROUND_COLOR = '#020617';
const isIOS = Platform.OS === ('ios' as any);

type NoteType = 'pre-match' | 'post-match' | 'training';

const noteTypes: { id: NoteType; label: string }[] = [
  { id: 'pre-match', label: 'Pre-Match' },
  { id: 'post-match', label: 'Post-Match' },
  { id: 'training', label: 'Training' },
];

const SearchableSelect = ({
  options,
  value,
  onChange,
  placeholder,
}: {
  options: MatchHistoryItem[];
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
}) => {
  const selectedOption = options.find(opt => opt.id === value);

  const contextMenuOptions = [
    { label: 'None', value: '', onPress: () => onChange('') },
    ...options.map(opt => ({
      label: `${new Date(opt.date).toLocaleDateString()} vs ${opt.opponentNames}`,
      value: opt.id,
      onPress: () => onChange(opt.id),
    })),
  ];

  return (
    <ContextMenu
      options={contextMenuOptions}
      trigger={
        <TouchableOpacity
          className="w-full flex-row items-center justify-between bg-white/10 border border-transparent rounded-lg px-4 py-3"
          activeOpacity={0.7}
        >
          <Text className={selectedOption ? 'text-white' : 'text-gray-400'} numberOfLines={1}>
            {selectedOption
              ? `${new Date(selectedOption.date).toLocaleDateString()} vs ${selectedOption.opponentNames}`
              : placeholder}
          </Text>
          <Feather name="chevron-down" size={16} color="#9ca3af" />
        </TouchableOpacity>
      }
    />
  );
};

export default function NotesPage() {
  const insets = useSafeAreaInsets();
  const [notes, setNotes] = useState<Note[]>([]);
  const [matchHistory, setMatchHistory] = useState<MatchHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [filterText, setFilterText] = useState('');

  useFocusEffect(
    React.useCallback(() => {
      async function loadData() {
        try {
          const [matchHistoryData, notesData] = await Promise.all([listMatchHistory(), listNotes()]);
          setMatchHistory(matchHistoryData);
          setNotes(notesData);
        } catch (error) {
          console.error('Failed to load notes page data:', error);
        } finally {
          setIsLoading(false);
        }
      }
      loadData();
    }, [])
  );


  const handleOpenModalForNew = () => {
    hapticLight();
    router.push('/create-note');
  };

  const handleOpenModalForEdit = (note: Note) => {
    hapticLight();
    router.push(`/edit-note?noteId=${note.id}`);
  };


  const handleDelete = async (id: number) => {
    try {
      await deleteNote(id);
      setNotes(prev => prev.filter(n => n.id !== id));
    } catch (error) {
      console.error('Failed to delete note:', error);
    }
  };

  const filteredNotes = useMemo(() => {
    return notes
      .filter(n => {
        const match = n.matchId ? matchHistory.find(m => m.id === n.matchId) : null;
        const searchText = filterText.toLowerCase();

        return (
          n.content.toLowerCase().includes(searchText) ||
          (match ? match.opponentNames.toLowerCase().includes(searchText) : false) ||
          n.type.replace('-', ' ').toLowerCase().includes(searchText)
        );
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [notes, filterText, matchHistory]);

  const getNoteTypeStyle = (type: NoteType) => {
    switch (type) {
      case 'pre-match':
        return 'bg-blue-500/20 text-blue-300';
      case 'post-match':
        return 'bg-green-500/20 text-green-300';
      case 'training':
        return 'bg-green-500/20 text-green-300';
    }
  };

  const getMatchResultStyle = (result: MatchHistoryItem['result']) => {
    switch (result) {
      case 'Won':
        return 'text-green-400';
      case 'Lost':
        return 'text-blue-400';
      case 'Ongoing':
        return 'text-green-400';
    }
  };

  return (
    <View className="gap-y-8">
      <View>
        <View className="flex-row items-center mb-6" style={{ gap: 10 }}>
          <View className="relative flex-1">
            <View 
              style={{ 
                position: 'absolute', 
                left: 16, 
                top: 0,
                bottom: 0,
                justifyContent: 'center',
                zIndex: 1 
              }}
            >
              <Feather name="search" size={20} color="#9ca3af" />
            </View>
            <TextInput
              placeholder="Search notes..."
              placeholderTextColor="#6b7280"
              value={filterText}
              onChangeText={setFilterText}
              className="w-full pl-11 pr-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white"
              style={{ color: '#ffffff' }}
            />
          </View>
          <TouchableOpacity
            onPress={handleOpenModalForNew}
            className="w-10 h-10 items-center justify-center bg-white/10 rounded-full"
            activeOpacity={0.7}
          >
            <Feather name="plus" size={20} color="#d1d5db" />
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={isIOS ? 'interactive' : 'on-drag'}
          contentContainerStyle={{ paddingBottom: 16 }}
        >
          <View className="flex-row flex-wrap gap-6">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-48 flex-1 min-w-[45%] rounded-xl" />
              ))
            ) : filteredNotes.length === 0 ? (
              <View className="w-full items-center py-2">
                <Text className="text-center text-gray-500">
                  {notes.length > 0 ? 'No notes match your search.' : 'No notes yet. Add one to get started!'}
                </Text>
              </View>
            ) : (
              filteredNotes.map(note => {
                const match = note.matchId ? matchHistory.find(m => m.id === note.matchId) : null;
                return (
                  <TouchableOpacity
                    key={note.id}
                    onPress={() => handleOpenModalForEdit(note)}
                    className="flex-1 min-w-[45%] p-6 rounded-xl bg-white/5 border border-white/10"
                    activeOpacity={0.7}
                    style={{
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.2,
                      shadowRadius: 4,
                      elevation: 4,
                    }}
                  >
                    <View className="flex-row justify-between items-start gap-4">
                      <View className="flex-1">
                        <View className={`px-3 py-1 self-start rounded-full ${getNoteTypeStyle(note.type)}`}>
                          <Text className="text-xs font-bold capitalize">{note.type.replace('-', ' ')}</Text>
                        </View>
                        {(() => {
                          if (match) {
                            return (
                              <View className="flex-row items-center gap-2 mt-2">
                                <Feather name="target" size={16} color="#9ca3af" />
                                <Text className="font-semibold text-white flex-1" numberOfLines={1}>
                                  vs {match.opponentNames}
                                  <Text className={`ml-2 text-xs font-medium ${getMatchResultStyle(match.result)}`}>
                                    ({match.result})
                                  </Text>
                                </Text>
                              </View>
                            );
                          }
                          switch (note.type) {
                            case 'training':
                              return (
                                <View className="flex-row items-center gap-2 mt-2">
                                  <Feather name="activity" size={16} color="#facc15" />
                                  <Text className="font-semibold text-white">Training Session</Text>
                                </View>
                              );
                            case 'pre-match':
                              return (
                                <View className="flex-row items-center gap-2 mt-2">
                                  <Feather name="clipboard" size={16} color="#60a5fa" />
                                  <Text className="font-semibold text-white">General Strategy</Text>
                                </View>
                              );
                            case 'post-match':
                              return (
                                <View className="flex-row items-center gap-2 mt-2">
                                  <Feather name="check-circle" size={16} color="#22c55e" />
                                  <Text className="font-semibold text-white">Post-Match Recap</Text>
                                </View>
                              );
                            default:
                              return null;
                          }
                        })()}
                        <Text className="text-xs text-gray-400 mt-1">
                          {new Date(note.createdAt).toLocaleString()}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => {
                          hapticLight();
                          handleDelete(note.id);
                        }}
                        className="p-2 rounded-full bg-blue-500/20"
                        activeOpacity={0.7}
                      >
                        <Feather name="trash-2" size={16} color="#3b82f6" />
                      </TouchableOpacity>
                    </View>
                    <Text className="text-gray-300 text-sm mt-4 border-t border-white/10 pt-4" numberOfLines={4}>
                      {note.content}
                    </Text>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
          <KeyboardSpacer extraOffset={24} />
        </ScrollView>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  selectModal: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: BACKGROUND_COLOR,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: Platform.OS === 'ios' ? 400 : 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
  },
});

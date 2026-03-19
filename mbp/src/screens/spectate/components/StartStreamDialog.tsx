import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlatformBottomSheet } from '../../../components/PlatformBottomSheet';
import { hapticLight } from '../../../utils/haptics';
import { createStream, attachStreamToMatch, Stream } from '../../../api/streams';
import { createMatch, getCurrentMatch, Match } from '../../../api/matches';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { usePlusGate } from '../../../components/PlusGate';

interface StartStreamDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function StartStreamDialog({ isOpen, onClose }: StartStreamDialogProps) {
  const insets = useSafeAreaInsets();
  const { requirePlus, paywallElement } = usePlusGate();
  const [currentMatch, setCurrentMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(false);
  const [creatingStream, setCreatingStream] = useState(false);
  const [stream, setStream] = useState<Stream | null>(null);
  const [streamName, setStreamName] = useState('');
  const [matchIdInput, setMatchIdInput] = useState('');
  const [showAttachMatch, setShowAttachMatch] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadCurrentMatch();
    } else {
      // Reset state when closed
      setStream(null);
      setStreamName('');
      setMatchIdInput('');
      setShowAttachMatch(false);
      setCreatingStream(false);
    }
  }, [isOpen]);

  const loadCurrentMatch = async () => {
    try {
      const match = await getCurrentMatch();
      setCurrentMatch(match);
    } catch (error) {
      // No current match, that's okay
      setCurrentMatch(null);
    }
  };

  const handleCreateStreamWithCurrentMatch = async () => {
    if (!currentMatch) return;
    
    setCreatingStream(true);
    hapticLight();
    
    try {
      const streamData = await createStream({
        matchId: currentMatch.id,
        meta: {
          name: streamName || `Match ${currentMatch.id}`,
        },
      });
      
      // Navigate directly to camera streaming screen
      onClose();
      router.push({
        pathname: '/spectate-camera-stream',
        params: { 
          matchId: currentMatch.id,
          streamUid: streamData.stream.uid,
          webRTCUrl: streamData.stream.liveInput?.webRTCUrl || '',
        },
      });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create stream');
      setCreatingStream(false);
    }
  };

  const handleCreateMatchAndStream = async () => {
    setCreatingStream(true);
    hapticLight();
    
    try {
      // Create a simple match
      const newMatchId = await createMatch({
        type: 'singles',
        yourPlayer1: 'You',
        oppPlayer1: 'Opponent',
        format: 'normal',
        gamesTo: 6,
        bestOf: '3',
        tiebreak: '7-point',
        scoringType: 'ad',
        statMode: 'intermediate',
        isPublic: true,
      });
      
      // Create stream for the new match
      const streamData = await createStream({
        matchId: newMatchId,
        meta: {
          name: streamName || `Match ${newMatchId}`,
        },
      });
      
      // Navigate directly to camera streaming screen
      onClose();
      router.push({
        pathname: '/spectate-camera-stream',
        params: { 
          matchId: newMatchId,
          streamUid: streamData.stream.uid,
          webRTCUrl: streamData.stream.liveInput?.webRTCUrl || '',
        },
      });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create match and stream');
      setCreatingStream(false);
    }
  };

  const handleAttachToMatch = async () => {
    if (!stream || !matchIdInput.trim()) {
      Alert.alert('Error', 'Please enter a match ID');
      return;
    }

    setLoading(true);
    hapticLight();
    
    try {
      await attachStreamToMatch(matchIdInput.trim(), stream.uid);
      Alert.alert('Success', 'Stream attached to match');
      setShowAttachMatch(false);
      setMatchIdInput('');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to attach stream');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    hapticLight();
    await Clipboard.setStringAsync(text);
    Alert.alert('Copied', `${label} copied to clipboard`);
  };

  return (
    <>
    <PlatformBottomSheet
      isOpened={isOpen}
      presentationDragIndicator="visible"
      presentationDetents={stream ? [0.85] : [0.6]}
      onIsOpenedChange={(opened) => !opened && onClose()}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Start Live Stream</Text>
          <TouchableOpacity
            onPress={() => {
              hapticLight();
              onClose();
            }}
            style={styles.closeButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Feather name="x" size={24} color="#9ca3af" />
          </TouchableOpacity>
        </View>

        {!stream ? (
          <>
            {/* Stream Name Input */}
            <View style={styles.section}>
              <Text style={styles.label}>Stream Name (Optional)</Text>
              <TextInput
                value={streamName}
                onChangeText={setStreamName}
                placeholder="Enter stream name"
                placeholderTextColor="#6b7280"
                style={styles.input}
              />
            </View>

            {/* Options */}
            <View style={styles.optionsContainer}>
              {currentMatch ? (
                <TouchableOpacity
                  onPress={() => requirePlus(handleCreateStreamWithCurrentMatch)}
                  disabled={creatingStream}
                  style={styles.optionButton}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#22c55e', '#10b981']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.optionGradient}
                  >
                    {creatingStream ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <>
                        <Feather name="video" size={20} color="#ffffff" />
                        <View style={styles.optionTextContainer}>
                          <Text style={styles.optionTitle}>Stream Current Match</Text>
                          <Text style={styles.optionSubtitle}>Match ID: {currentMatch.id}</Text>
                        </View>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                onPress={() => requirePlus(handleCreateMatchAndStream)}
                disabled={creatingStream}
                style={styles.optionButton}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#3b82f6', '#2563eb']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.optionGradient}
                >
                  {creatingStream ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <Feather name="plus-circle" size={20} color="#ffffff" />
                      <View style={styles.optionTextContainer}>
                        <Text style={styles.optionTitle}>Create New Match & Stream</Text>
                        <Text style={styles.optionSubtitle}>Start a new match with streaming</Text>
                      </View>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {stream && (
                <TouchableOpacity
                  onPress={() => {
                    hapticLight();
                    setShowAttachMatch(true);
                  }}
                  style={[styles.optionButton, styles.secondaryButton]}
                  activeOpacity={0.7}
                >
                  <Feather name="link" size={20} color="#60a5fa" />
                  <View style={styles.optionTextContainer}>
                    <Text style={[styles.optionTitle, styles.secondaryText]}>Attach to Existing Match</Text>
                    <Text style={[styles.optionSubtitle, styles.secondarySubtitle]}>Link stream to a match ID</Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>

            {/* Attach to Match Input */}
            {showAttachMatch && stream && (
              <View style={styles.section}>
                <Text style={styles.label}>Match ID</Text>
                <TextInput
                  value={matchIdInput}
                  onChangeText={setMatchIdInput}
                  placeholder="Enter match ID"
                  placeholderTextColor="#6b7280"
                  keyboardType="numeric"
                  style={styles.input}
                />
                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    onPress={() => {
                      hapticLight();
                      setShowAttachMatch(false);
                      setMatchIdInput('');
                    }}
                    style={[styles.actionButton, styles.cancelButton]}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleAttachToMatch}
                    disabled={loading}
                    style={[styles.actionButton, styles.attachButton]}
                    activeOpacity={0.7}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={styles.attachButtonText}>Attach</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </>
        ) : null}
      </ScrollView>
    </PlatformBottomSheet>
    {paywallElement}
    </>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
  },
  closeButton: {
    padding: 4,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#d1d5db',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#ffffff',
  },
  optionsContainer: {
    gap: 12,
    marginBottom: 24,
  },
  optionButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  optionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 16,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  optionSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  secondaryButton: {
    backgroundColor: 'rgba(96, 165, 250, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.3)',
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderRadius: 16,
  },
  secondaryText: {
    color: '#60a5fa',
  },
  secondarySubtitle: {
    color: 'rgba(96, 165, 250, 0.7)',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  cancelButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  attachButton: {
    backgroundColor: '#3b82f6',
  },
  attachButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  successSection: {
    alignItems: 'center',
    marginBottom: 32,
    paddingVertical: 20,
  },
  successIcon: {
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 16,
  },
  rtmpField: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9ca3af',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  copyField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  copyFieldText: {
    flex: 1,
    fontSize: 14,
    color: '#ffffff',
  },
  monoText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  helpText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 8,
    lineHeight: 18,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  viewButton: {
    flex: 1,
    backgroundColor: '#22c55e',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
  },
  viewButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryActionButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  secondaryActionText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hapticLight } from '../../utils/haptics';
import StreamPlayer from '../../components/StreamPlayer';
import { createStream, getStreamByMatch, attachStreamToMatch, deleteStream, Stream } from '../../api/streams';
import { createMatch, getCurrentMatch, Match } from '../../api/matches';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';

interface StreamPageProps {
  teamId: string;
}

export default function StreamPage({ teamId }: StreamPageProps) {
  const insets = useSafeAreaInsets();
  const [stream, setStream] = useState<Stream | null>(null);
  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(false);
  const [creatingStream, setCreatingStream] = useState(false);
  const [showCreateMatch, setShowCreateMatch] = useState(false);
  const [showAttachMatch, setShowAttachMatch] = useState(false);
  const [matchIdInput, setMatchIdInput] = useState('');
  const [streamName, setStreamName] = useState('');

  useEffect(() => {
    loadCurrentMatch();
  }, []);

  const loadCurrentMatch = async () => {
    try {
      const currentMatch = await getCurrentMatch();
      setMatch(currentMatch);

      // Try to load stream for current match
      if (currentMatch) {
        try {
          const streamData = await getStreamByMatch(currentMatch.id);
          if (streamData) {
            setStream(streamData.stream);
          }
        } catch (error) {
          // No stream for this match, that's okay
        }
      }
    } catch (error) {
      // No current match, that's okay
    }
  };

  const handleCreateStream = async (matchId?: string) => {
    setCreatingStream(true);
    hapticLight();

    try {
      const streamData = await createStream({
        matchId: matchId || match?.id,
        meta: {
          name: streamName || `Match ${matchId || match?.id || 'Stream'}`,
        },
      });

      setStream(streamData.stream);
      setShowCreateMatch(false);
      setShowAttachMatch(false);

      Alert.alert(
        'Stream Created',
        'Your stream is ready! Use the RTMP details below to start broadcasting.',
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create stream');
    } finally {
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

  const handleCreateMatchAndStream = async () => {
    setLoading(true);
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
      await handleCreateStream(newMatchId);

      // Reload match
      await loadCurrentMatch();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create match and stream');
    } finally {
      setLoading(false);
      setShowCreateMatch(false);
    }
  };

  const handleDeleteStream = async () => {
    if (!stream) return;

    Alert.alert(
      'Delete Stream',
      'Are you sure you want to delete this stream?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await deleteStream(stream.uid);
              setStream(null);
              Alert.alert('Success', 'Stream deleted');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete stream');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const copyToClipboard = async (text: string, label: string) => {
    hapticLight();
    await Clipboard.setStringAsync(text);
    Alert.alert('Copied', `${label} copied to clipboard`);
  };

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{
        paddingBottom: insets.bottom + 24,
        paddingHorizontal: 16,
        paddingTop: 16,
      }}
      showsVerticalScrollIndicator={false}
    >
      <View className="gap-6">
        {/* Stream Player */}
        {(stream?.playback?.hls || stream?.liveInput?.webRTCPlaybackUrl) ? (
          <View className="gap-4">
            <StreamPlayer
              hlsUrl={stream.playback?.hls}
              webRTCPlaybackUrl={stream.liveInput?.webRTCPlaybackUrl}
              isLive={stream.status.state === 'live' || stream.status.state === 'connected'}
            />

            {/* Stream Info */}
            <View className="p-4 rounded-2xl bg-white/5 border border-white/10">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-lg font-bold text-white">{stream.meta.name || 'Live Stream'}</Text>
                {(stream.status.state === 'live' || stream.status.state === 'connected') && (
                  <View className="flex-row items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/20">
                    <View className="w-2 h-2 rounded-full bg-red-500" />
                    <Text className="text-xs font-semibold text-red-400">LIVE</Text>
                  </View>
                )}
              </View>

              {stream.status.state !== 'live' && stream.status.state !== 'connected' && (
                <Text className="text-sm text-gray-400 mb-3">
                  Stream is {stream.status.state}. Start broadcasting to go live.
                </Text>
              )}
            </View>
          </View>
        ) : (
          <View className="aspect-video bg-gray-900 rounded-2xl items-center justify-center border border-white/10">
            <Feather name="video" size={48} color="#6b7280" />
            <Text className="text-gray-400 text-lg font-semibold mt-4">No Active Stream</Text>
            <Text className="text-gray-500 text-sm mt-2">Create a stream to start broadcasting</Text>
          </View>
        )}

        {/* RTMP Details (if stream exists) */}
        {stream?.liveInput && (
          <View className="p-6 rounded-2xl bg-white/5 border border-white/10 gap-4">
            <View className="flex-row items-center gap-3 mb-2">
              <Feather name="settings" size={20} color="#60a5fa" />
              <Text className="text-lg font-bold text-white">Broadcast Settings</Text>
            </View>

            <View className="gap-3">
              {stream.liveInput.rtmpUrl && (
                <View>
                  <Text className="text-xs font-medium text-gray-400 mb-1.5">RTMP URL</Text>
                  <TouchableOpacity
                    onPress={() => copyToClipboard(stream.liveInput.rtmpUrl!, 'RTMP URL')}
                    className="p-3 rounded-xl bg-white/5 border border-white/10 flex-row items-center justify-between"
                  >
                    <Text className="text-sm text-white flex-1 mr-2" numberOfLines={1}>
                      {stream.liveInput.rtmpUrl}
                    </Text>
                    <Feather name="copy" size={16} color="#60a5fa" />
                  </TouchableOpacity>
                </View>
              )}

              {stream.liveInput.streamKey && (
                <View>
                  <Text className="text-xs font-medium text-gray-400 mb-1.5">Stream Key</Text>
                  <TouchableOpacity
                    onPress={() => copyToClipboard(stream.liveInput.streamKey!, 'Stream Key')}
                    className="p-3 rounded-xl bg-white/5 border border-white/10 flex-row items-center justify-between"
                  >
                    <Text className="text-sm text-white flex-1 mr-2 font-mono" numberOfLines={1}>
                      {stream.liveInput.streamKey}
                    </Text>
                    <Feather name="copy" size={16} color="#60a5fa" />
                  </TouchableOpacity>
                </View>
              )}

              {stream.liveInput.webRTCUrl && (
                <View>
                  <Text className="text-xs font-medium text-gray-400 mb-1.5">WebRTC URL (WHIP)</Text>
                  <TouchableOpacity
                    onPress={() => copyToClipboard(stream.liveInput.webRTCUrl!, 'WebRTC URL')}
                    className="p-3 rounded-xl bg-white/5 border border-white/10 flex-row items-center justify-between"
                  >
                    <Text className="text-sm text-white flex-1 mr-2" numberOfLines={1}>
                      {stream.liveInput.webRTCUrl}
                    </Text>
                    <Feather name="copy" size={16} color="#60a5fa" />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <Text className="text-xs text-gray-500 mt-2">
              Use these credentials in your broadcasting software (OBS, Streamlabs, etc.)
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        <View className="gap-4">
          {!stream ? (
            <>
              {/* Create Stream Options */}
              <TouchableOpacity
                onPress={() => {
                  hapticLight();
                  if (match) {
                    handleCreateStream();
                  } else {
                    setShowCreateMatch(true);
                  }
                }}
                disabled={creatingStream || loading}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#22c55e', '#10b981']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  className="px-6 py-4 rounded-2xl items-center"
                >
                  {creatingStream || loading ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <View className="flex-row items-center gap-3">
                      <Feather name="video" size={20} color="#ffffff" />
                      <Text className="text-lg font-bold text-white">
                        {match ? 'Start Stream' : 'Create Stream & Match'}
                      </Text>
                    </View>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {match && (
                <TouchableOpacity
                  onPress={() => {
                    hapticLight();
                    setShowAttachMatch(true);
                  }}
                  className="px-6 py-4 rounded-2xl bg-white/10 border border-white/20 items-center"
                  activeOpacity={0.7}
                >
                  <View className="flex-row items-center gap-3">
                    <Feather name="link" size={20} color="#ffffff" />
                    <Text className="text-lg font-semibold text-white">Attach to Existing Stream</Text>
                  </View>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <>
              {!match && (
                <TouchableOpacity
                  onPress={() => {
                    hapticLight();
                    setShowAttachMatch(true);
                  }}
                  className="px-6 py-4 rounded-2xl bg-blue-500/20 border border-blue-500/30 items-center"
                  activeOpacity={0.7}
                >
                  <View className="flex-row items-center gap-3">
                    <Feather name="link" size={20} color="#60a5fa" />
                    <Text className="text-lg font-semibold text-blue-400">Attach Stream to Match</Text>
                  </View>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={handleDeleteStream}
                disabled={loading}
                className="px-6 py-4 rounded-2xl bg-red-500/20 border border-red-500/30 items-center"
                activeOpacity={0.7}
              >
                <View className="flex-row items-center gap-3">
                  <Feather name="trash-2" size={20} color="#ef4444" />
                  <Text className="text-lg font-semibold text-red-400">End Stream</Text>
                </View>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Create Match Dialog */}
        {showCreateMatch && (
          <View className="p-6 rounded-2xl bg-white/5 border border-white/10 gap-4">
            <Text className="text-xl font-bold text-white">Create Match & Stream</Text>
            <Text className="text-sm text-gray-400">
              Create a new match and start streaming. You can customize match settings later.
            </Text>

            <View>
              <Text className="text-sm font-medium text-gray-300 mb-2">Stream Name (Optional)</Text>
              <TextInput
                value={streamName}
                onChangeText={setStreamName}
                placeholder="Enter stream name"
                placeholderTextColor="#6b7280"
                className="p-4 rounded-xl bg-white/5 border border-white/10 text-white"
              />
            </View>

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => {
                  hapticLight();
                  setShowCreateMatch(false);
                  setStreamName('');
                }}
                className="flex-1 px-4 py-3 rounded-xl bg-white/10 items-center"
                activeOpacity={0.7}
              >
                <Text className="text-white font-semibold">Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleCreateMatchAndStream}
                disabled={loading}
                className="flex-1 px-4 py-3 rounded-xl overflow-hidden"
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={['#22c55e', '#10b981']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  className="px-4 py-3 items-center"
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text className="text-white font-bold">Create</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Attach to Match Dialog */}
        {showAttachMatch && (
          <View className="p-6 rounded-2xl bg-white/5 border border-white/10 gap-4">
            <Text className="text-xl font-bold text-white">
              {stream ? 'Attach Stream to Match' : 'Attach Existing Stream'}
            </Text>
            <Text className="text-sm text-gray-400">
              Enter the match ID to attach this stream to.
            </Text>

            <View>
              <Text className="text-sm font-medium text-gray-300 mb-2">Match ID</Text>
              <TextInput
                value={matchIdInput}
                onChangeText={setMatchIdInput}
                placeholder="Enter match ID"
                placeholderTextColor="#6b7280"
                keyboardType="numeric"
                className="p-4 rounded-xl bg-white/5 border border-white/10 text-white"
              />
            </View>

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => {
                  hapticLight();
                  setShowAttachMatch(false);
                  setMatchIdInput('');
                }}
                className="flex-1 px-4 py-3 rounded-xl bg-white/10 items-center"
                activeOpacity={0.7}
              >
                <Text className="text-white font-semibold">Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={stream ? handleAttachToMatch : () => {
                  hapticLight();
                  if (matchIdInput.trim()) {
                    handleCreateStream(matchIdInput.trim());
                  } else {
                    Alert.alert('Error', 'Please enter a match ID');
                  }
                }}
                disabled={loading}
                className="flex-1 px-4 py-3 rounded-xl overflow-hidden"
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={['#3b82f6', '#2563eb']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  className="px-4 py-3 items-center"
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text className="text-white font-bold">Attach</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Match Info */}
        {match && (
          <View className="p-4 rounded-2xl bg-white/5 border border-white/10">
            <View className="flex-row items-center gap-3 mb-2">
              <Feather name="info" size={18} color="#60a5fa" />
              <Text className="text-base font-semibold text-white">Current Match</Text>
            </View>
            <Text className="text-sm text-gray-400">
              Match ID: {match.id}
            </Text>
            <TouchableOpacity
              onPress={() => {
                hapticLight();
                router.push(`/match-detail?matchId=${match.id}`);
              }}
              className="mt-3"
            >
              <Text className="text-sm text-blue-400 font-medium">View Match Details →</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

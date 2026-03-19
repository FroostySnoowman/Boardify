import React, { useState, useRef, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, Animated, Alert, Platform, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { hapticLight, hapticMedium } from '../utils/haptics';
import { uploadVoiceMessage, sendMessage } from '../api/messages';
import type { Message } from '../api/messages';
import { getAudioSessionOwner } from '../services/audioSessionOwnership';

const MAX_VOICE_DURATION_SECONDS = 10 * 60;
const RECORDER_AUDIO_MODE_PAYLOAD = { allowsRecording: true, playsInSilentMode: true };

function normalizeSentAt(v: number | string): number {
  return typeof v === 'number' ? (v < 1e12 ? v * 1000 : v) : new Date(v).getTime();
}

function dbToLevel(db: number | undefined): number {
  if (db == null || !Number.isFinite(db)) return 0.35;
  const normalized = Math.max(0, Math.min(1, (db + 60) / 60));
  return 0.25 + 0.75 * normalized;
}

const WAVEFORM_BAR_COUNT = 24;
/** Downsample recorded levels to a fixed number of bars (0–1). Silence → all zeros. */
function downsampleWaveform(samples: number[], bars: number): number[] {
  if (samples.length === 0) return Array(bars).fill(0);
  const result: number[] = [];
  const step = samples.length / bars;
  for (let i = 0; i < bars; i++) {
    const start = Math.floor(i * step);
    const end = Math.min(Math.floor((i + 1) * step), samples.length);
    let sum = 0;
    for (let j = start; j < end; j++) sum += samples[j];
    result.push(end > start ? sum / (end - start) : 0);
  }
  return result;
}

interface VoiceMessageRecorderProps {
  conversationId: string;
  onRecordingStateChange?: (isRecording: boolean) => void;
  onMessageSent?: (message: Message) => void;
  autoStart?: boolean;
  user?: { id: string; username?: string; email?: string; profilePictureUrl?: string | null } | null;
}

export function VoiceMessageRecorder({
  conversationId,
  onRecordingStateChange,
  onMessageSent,
  autoStart = false,
  user,
}: VoiceMessageRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const waveformIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const waveformSamplesRef = useRef<number[]>([]);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const recordingOptions = useMemo(
    () => ({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true }),
    []
  );
  const recorder = useAudioRecorder(recordingOptions);
  const recorderState = useAudioRecorderState(recorder, 80);

  const WAVE_BAR_COUNT = 7;
  const waveAnims = useRef(
    Array.from({ length: WAVE_BAR_COUNT }, () => new Animated.Value(0.35))
  ).current;

  useEffect(() => {
    if (isRecording) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.3, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [isRecording, pulseAnim]);

  useEffect(() => {
    if (!isRecording) {
      waveAnims.forEach((anim) => {
        Animated.timing(anim, {
          toValue: 0.35,
          duration: 100,
          useNativeDriver: true,
        }).start();
      });
      return;
    }
    const level = dbToLevel(recorderState.metering);
    const duration = 60;
    waveAnims.forEach((anim) => {
      Animated.timing(anim, {
        toValue: level,
        duration,
        useNativeDriver: true,
      }).start();
    });
  }, [isRecording, recorderState.metering, waveAnims]);

  useEffect(() => {
    if (getAudioSessionOwner() === 'radio') {
      console.debug('[VoiceMessageRecorder] audioMode:set skipped (radio owns session)');
      return;
    }
    console.debug('[VoiceMessageRecorder] audioMode:set', RECORDER_AUDIO_MODE_PAYLOAD);
    setAudioModeAsync(RECORDER_AUDIO_MODE_PAYLOAD)
      .then(() => console.debug('[VoiceMessageRecorder] audioMode:set OK'))
      .catch((e: any) => console.debug('[VoiceMessageRecorder] audioMode:set FAIL', e?.message || e));
  }, []);

  const startedAutoRef = useRef(false);
  useEffect(() => {
    if (!autoStart || startedAutoRef.current) return;
    startedAutoRef.current = true;
    startRecording();
  }, [autoStart]);

  const startRecording = async () => {
    try {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) {
        Alert.alert('Permission Required', 'Please enable microphone access to record voice messages.');
        onRecordingStateChange?.(false);
        return;
      }

      await recorder.prepareToRecordAsync();
      recorder.record();

      setIsRecording(true);
      setRecordingDuration(0);
      waveformSamplesRef.current = [];
      onRecordingStateChange?.(true);
      hapticMedium();

      waveformIntervalRef.current = setInterval(() => {
        const level = dbToLevel(recorder.getStatus().metering);
        waveformSamplesRef.current.push(level);
      }, 200);

      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => {
          if (prev + 1 >= MAX_VOICE_DURATION_SECONDS) {
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
            if (waveformIntervalRef.current) {
              clearInterval(waveformIntervalRef.current);
              waveformIntervalRef.current = null;
            }
            setTimeout(() => stopAndSend(), 0);
            return MAX_VOICE_DURATION_SECONDS;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (e) {
      console.warn('Failed to start recording:', e);
      Alert.alert('Error', 'Failed to start recording');
      onRecordingStateChange?.(false);
    }
  };

  const stopAndSend = async () => {
    hapticMedium();
    if (timerRef.current) clearInterval(timerRef.current);
    if (waveformIntervalRef.current) {
      clearInterval(waveformIntervalRef.current);
      waveformIntervalRef.current = null;
    }

    try {
      setIsSending(true);
      await recorder.stop();
      const uri = recorder.uri;

      setIsRecording(false);
      onRecordingStateChange?.(false);

      if (!uri) throw new Error('No recording URI');

      const waveform = downsampleWaveform(waveformSamplesRef.current, WAVEFORM_BAR_COUNT);
      waveformSamplesRef.current = [];

      const mimeType = Platform.OS === 'ios' ? 'audio/m4a' : 'audio/webm';
      const voiceUrl = await uploadVoiceMessage(uri, mimeType);

      const durationMs = Math.min(recordingDuration, MAX_VOICE_DURATION_SECONDS) * 1000;
      const saved = await sendMessage(
        conversationId,
        '',
        undefined,
        undefined,
        undefined,
        'voice',
        { voiceUrl, durationMs, waveform }
      );

      const sentAtMs = normalizeSentAt(saved.sentAt);
      const voiceMessage: Message = {
        id: saved.id,
        senderId: user?.id ?? '',
        senderName: user?.username ?? user?.email?.split('@')[0] ?? 'User',
        senderProfilePicture: user?.profilePictureUrl ?? null,
        content: '',
        timestamp: new Date(sentAtMs).toISOString(),
        isMine: true,
        sentAt: sentAtMs,
        parentMessageId: null,
        replyToMessageId: null,
        replyToMessageContent: undefined,
        replyToMessageSenderName: undefined,
        replyToMessageSenderProfilePicture: null,
        attachments: [],
        messageType: 'voice',
        metadata: { voiceUrl, durationMs, waveform },
      };
      onMessageSent?.(voiceMessage);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to send voice message');
      setIsRecording(false);
      onRecordingStateChange?.(false);
    } finally {
      setIsSending(false);
      setRecordingDuration(0);
    }
  };

  const cancelRecording = async () => {
    hapticLight();
    if (timerRef.current) clearInterval(timerRef.current);
    if (waveformIntervalRef.current) {
      clearInterval(waveformIntervalRef.current);
      waveformIntervalRef.current = null;
    }

    try {
      await recorder.stop();
    } catch (e) {
      console.warn('Cancel error:', e);
    }

    setIsRecording(false);
    setRecordingDuration(0);
    onRecordingStateChange?.(false);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const showRecordingBar = isRecording || autoStart;
  const onCancel = () => {
    if (isRecording) cancelRecording();
    else {
      startedAutoRef.current = false;
      onRecordingStateChange?.(false);
    }
  };

  if (showRecordingBar) {
    return (
      <View className="flex-row items-center gap-3 px-3 py-2.5">
        <TouchableOpacity
          onPress={onCancel}
          className="w-10 h-10 rounded-full bg-white/10 items-center justify-center"
        >
          <Feather name="x" size={20} color="#94a3b8" />
        </TouchableOpacity>
        <View className="flex-1 flex-row items-center justify-center gap-2">
          <Animated.View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: '#ef4444',
              transform: [{ scale: pulseAnim }],
            }}
          />
          <View className="flex-row items-end gap-0.5" style={{ height: 16 }}>
            {waveAnims.map((anim, i) => (
              <Animated.View
                key={i}
                style={{
                  width: 3,
                  height: 14,
                  borderRadius: 1.5,
                  backgroundColor: 'rgba(255, 255, 255, 0.85)',
                  transform: [{ scaleY: anim }],
                }}
              />
            ))}
          </View>
          <Text className="text-white text-base tabular-nums">
            {formatTime(recordingDuration)}
          </Text>
        </View>
        <TouchableOpacity
          onPress={stopAndSend}
          disabled={isSending || !isRecording}
          className="w-10 h-10 rounded-full bg-purple-500 items-center justify-center"
        >
          {isSending ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Feather name="send" size={18} color="white" />
          )}
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <TouchableOpacity
      onPress={startRecording}
      disabled={isSending}
      className="w-10 h-10 rounded-full bg-white/10 items-center justify-center"
    >
      <Feather name="mic" size={20} color="#9ca3af" />
    </TouchableOpacity>
  );
}

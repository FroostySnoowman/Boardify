import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import { hapticLight, hapticMedium } from '../utils/haptics';
import { getImageUrl } from '../utils/imageUrl';
import { getAudioSessionOwner } from '../services/audioSessionOwnership';

interface VoiceMessagePlayerProps {
  voiceUrl: string;
  durationMs?: number;
  waveform?: number[];
  onLongPress?: () => void;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

const WAVEFORM_BAR_COUNT = 24;
const FLAT_LINE_HEIGHT = 12;
const AUDIO_MODE_PAYLOAD = { allowsRecording: false, playsInSilentMode: true };

function getWaveformHeights(waveform: number[] | undefined): number[] {
  if (!waveform || waveform.length !== WAVEFORM_BAR_COUNT) {
    return Array(WAVEFORM_BAR_COUNT).fill(FLAT_LINE_HEIGHT);
  }
  const hasLevel = waveform.some(v => v > 0.05);
  if (!hasLevel) return Array(WAVEFORM_BAR_COUNT).fill(FLAT_LINE_HEIGHT);
  return waveform.map(v => 8 + 20 * Math.max(0, Math.min(1, v)));
}

export function VoiceMessagePlayer({ voiceUrl, durationMs, waveform, onLongPress }: VoiceMessagePlayerProps) {
  const resolvedUrl = useMemo(() => getImageUrl(voiceUrl) || voiceUrl, [voiceUrl]);
  const player = useAudioPlayer(resolvedUrl, {
    updateInterval: 100,
    downloadFirst: true,
  });
  const status = useAudioPlayerStatus(player);

  const [isPlayingLocal, setIsPlayingLocal] = useState(false);

  useEffect(() => {
    if (getAudioSessionOwner() === 'radio') {
      console.debug('[VoiceMessagePlayer] audioMode:set skipped (radio owns session)');
      return;
    }
    console.debug('[VoiceMessagePlayer] audioMode:set', AUDIO_MODE_PAYLOAD);
    setAudioModeAsync(AUDIO_MODE_PAYLOAD)
      .then(() => console.debug('[VoiceMessagePlayer] audioMode:set OK'))
      .catch((e: any) => console.debug('[VoiceMessagePlayer] audioMode:set FAIL', e?.message || e));
  }, []);

  useEffect(() => {
    setIsPlayingLocal(prev => (status.playing !== undefined ? status.playing : prev));
  }, [status.playing]);

  useEffect(() => {
    if (status.didJustFinish) setIsPlayingLocal(false);
  }, [status.didJustFinish]);

  const isPlaying = isPlayingLocal;
  const positionMs = status.currentTime != null ? status.currentTime * 1000 : 0;
  const durationMsResolved = status.duration != null ? status.duration * 1000 : (durationMs || 0);
  const position = positionMs;
  const duration = durationMsResolved;

  const progress =
    duration > 0 ? Math.min(1, Math.max(0, position / duration)) : 0;
  const isAtEnd = duration > 0 && position >= duration - 30;

  const togglePlayback = async () => {
    hapticLight();
    try {
      if (isPlaying) {
        player.pause();
        setIsPlayingLocal(false);
      } else {
        if (getAudioSessionOwner() === 'radio') {
          console.debug('[VoiceMessagePlayer] audioMode:set before play skipped (radio owns session)');
        } else {
        console.debug('[VoiceMessagePlayer] audioMode:set before play', AUDIO_MODE_PAYLOAD);
        await setAudioModeAsync(AUDIO_MODE_PAYLOAD);
        console.debug('[VoiceMessagePlayer] audioMode:set before play OK');
        }
        if (isAtEnd) {
          player.seekTo(0);
        }
        await player.play();
        setIsPlayingLocal(true);
      }
    } catch (e) {
      console.warn('Voice playback error:', e);
      setIsPlayingLocal(false);
    }
  };

  const iconName = isPlaying ? 'pause' : isAtEnd ? 'rotate-cw' : 'play';
  const barHeights = useMemo(() => getWaveformHeights(waveform), [waveform]);

  return (
    <TouchableOpacity
      onPress={togglePlayback}
      onLongPress={() => {
        if (onLongPress) {
          hapticMedium();
          onLongPress();
        }
      }}
      delayLongPress={300}
      className="flex-row items-center bg-white/5 rounded-2xl px-4 py-3 border border-white/10 my-1"
      style={{ minWidth: 220 }}
      activeOpacity={0.7}
    >
      <View className="w-10 h-10 rounded-full bg-purple-500 items-center justify-center mr-3">
        <Feather
          name={iconName}
          size={18}
          color="white"
          style={iconName === 'play' ? { marginLeft: 2 } : iconName === 'rotate-cw' ? {} : {}}
        />
      </View>

      <View
        className="flex-1 flex-row items-center justify-between"
        style={[styles.waveformRow, { height: 32, minWidth: 0 }]}
      >
        <View style={styles.barsWrapper}>
          {barHeights.map((h, i) => {
            const isFilled = i / WAVEFORM_BAR_COUNT < progress;
            return (
              <View
                key={i}
                style={[
                  styles.bar,
                  {
                    height: h,
                    backgroundColor: isFilled ? '#a855f7' : 'rgba(255,255,255,0.15)',
                  },
                ]}
              />
            );
          })}
        </View>
        <View
          pointerEvents="none"
          style={[
            styles.playhead,
            { left: `${progress * 100}%` },
          ]}
        />
      </View>

      <Text className="text-xs text-gray-400 text-right shrink-0" style={{ width: 36, marginLeft: 8 }}>
        {isPlaying ? formatDuration(position) : formatDuration(duration)}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  waveformRow: {
    position: 'relative',
    overflow: 'hidden',
  },
  barsWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  bar: {
    flex: 1,
    minWidth: 2,
    borderRadius: 1.5,
  },
  playhead: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1.5,
    marginLeft: -0.75,
    backgroundColor: '#a855f7',
    borderRadius: 0.75,
    zIndex: 1,
  },
});

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Platform, AppState } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { setAudioModeAsync } from 'expo-audio';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { hapticLight } from '../utils/haptics';
import WebRTCPlayer, { isWHEPPlaybackAvailable } from './WebRTCPlayer';
import { getAudioSessionOwner } from '../services/audioSessionOwnership';

interface StreamPlayerProps {
  hlsUrl?: string;
  webRTCPlaybackUrl?: string;
  isLive?: boolean;
  onError?: (error: string) => void;
  showControls?: boolean;
  fillContainer?: boolean;
}

const STREAM_AUDIO_MODE_PAYLOAD = {
  allowsRecording: false,
  playsInSilentMode: true,
  shouldRouteThroughEarpiece: false,
  interruptionMode: 'doNotMix' as const,
  shouldPlayInBackground: true,
};

async function checkManifestAvailable(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/vnd.apple.mpegurl, application/x-mpegURL, video/m3u8, */*'
      }
    });

    if (response.status === 200) {
      const text = await response.text();
      const isManifest = text.trim().startsWith('#EXTM3U') || text.includes('#EXT-X-');
      return isManifest;
    }

    return false;
  } catch (error) {
    return false;
  }
}

export default function StreamPlayer({
  hlsUrl,
  webRTCPlaybackUrl,
  isLive = true,
  onError,
  showControls = true,
  fillContainer = false,
}: StreamPlayerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showControlsOverlay, setShowControlsOverlay] = useState(false);
  const [manifestReady, setManifestReady] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [useWebRTC, setUseWebRTC] = useState(false);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingPlayRef = useRef(false);
  const maxRetries = 3;

  useEffect(() => {
    if (webRTCPlaybackUrl && isWHEPPlaybackAvailable()) {
      setUseWebRTC(true);
    }
  }, [webRTCPlaybackUrl]);

  useEffect(() => {
    if (Platform.OS !== 'web' && (hlsUrl || webRTCPlaybackUrl)) {
      if (getAudioSessionOwner() === 'radio') {
        console.debug('[StreamPlayer] audioMode:set skipped (radio owns session)');
        return;
      }
      console.debug('[StreamPlayer] audioMode:set', STREAM_AUDIO_MODE_PAYLOAD, {
        hasHls: !!hlsUrl,
        hasWebRTC: !!webRTCPlaybackUrl,
      });
      setAudioModeAsync(STREAM_AUDIO_MODE_PAYLOAD)
        .then(() => console.debug('[StreamPlayer] audioMode:set OK'))
        .catch((e: any) => console.debug('[StreamPlayer] audioMode:set FAIL', e?.message || e));
    }
  }, [hlsUrl, webRTCPlaybackUrl]);

  useEffect(() => {
    if (!hlsUrl) return;

    const checkManifest = async () => {
      const isAvailable = await checkManifestAvailable(hlsUrl);

      if (isAvailable) {
        setManifestReady(true);
        setRetryCount(0);
      } else {
        if (retryCount < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, retryCount), 5000);
          retryTimeoutRef.current = setTimeout(() => {
            setRetryCount(prev => prev + 1);
          }, delay);
        } else {
          if (webRTCPlaybackUrl && isWHEPPlaybackAvailable()) {
            setUseWebRTC(true);
          } else {
            setManifestReady(true);
          }
        }
      }
    };

    checkManifest();

    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [hlsUrl, retryCount, maxRetries]);

  const [playerUrl, setPlayerUrl] = useState<string>('');

  useEffect(() => {
    if (manifestReady && hlsUrl) {
      setPlayerUrl(hlsUrl);
    }
  }, [manifestReady, hlsUrl]);

  const player = useVideoPlayer(playerUrl, (player) => {
    if (!player) return;
    player.loop = false;
    player.muted = false;
    player.staysActiveInBackground = true;
    if (isLive) {
      player.play();
    }
  });

  useEffect(() => {
    if (!useWebRTC && playerUrl && player && isLive) {
      pendingPlayRef.current = true;
      try { player.play(); } catch {}
    }
  }, [useWebRTC, playerUrl, player, isLive]);

  useEffect(() => {
    if (!player || !playerUrl) return;

    const statusSubscription = player.addListener('statusChange', (status) => {
      console.debug('[StreamPlayer] statusChange', {
        status: status.status,
        appState: AppState.currentState,
        playerPlaying: player.playing,
        playerUrl,
        useWebRTC,
      });
      if (status.status === 'readyToPlay') {
        setIsLoading(false);
        setIsPlaying(player.playing);
        if (pendingPlayRef.current) {
          pendingPlayRef.current = false;
          console.debug('[StreamPlayer] pendingPlay flush');
          try { player.play(); } catch {}
        }
      } else if (status.status === 'error') {
        setIsLoading(false);
        const errorMsg = typeof status.error === 'string' ? status.error : status.error?.message || 'Unknown playback error';
        console.error('❌ Player error:', errorMsg);

        if (errorMsg.includes('204') || errorMsg.includes('No Content')) {
          setTimeout(() => {
            setManifestReady(false);
            setRetryCount(0);
          }, 2000);
        } else {
          onError?.(errorMsg);
        }
      } else if (status.status === 'loading') {
        setIsLoading(true);
      } else if (status.status === 'idle') {
        setIsLoading(false);
        setIsPlaying(false);
      }
    });

    const playingSubscription = player.addListener('playingChange', () => {
      console.debug('[StreamPlayer] playingChange', {
        playerPlaying: player.playing,
        appState: AppState.currentState,
        playerUrl,
        useWebRTC,
      });
      setIsPlaying(player.playing);
    });

    return () => {
      statusSubscription.remove();
      playingSubscription.remove();
    };
  }, [player, onError, playerUrl]);

  const togglePlayPause = () => {
    hapticLight();
    if (!player) return;

    try {
      if (player.playing) {
        player.pause();
      } else {
        player.play();
      }
    } catch (error) {
      console.error('Error toggling playback:', error);
    }
  };

  const toggleFullscreen = () => {
    hapticLight();
  };

  if (useWebRTC && webRTCPlaybackUrl) {
    return (
      <WebRTCPlayer
        whepUrl={webRTCPlaybackUrl}
        isLive={isLive}
        onError={onError}
        showControls={showControls}
        fillContainer={fillContainer}
      />
    );
  }

  if (!hlsUrl && !webRTCPlaybackUrl) {
    return (
      <View style={styles.container}>
        <View style={styles.placeholder}>
          <Feather name="video" size={48} color="#6b7280" />
          <Text style={styles.placeholderText}>No stream available</Text>
        </View>
      </View>
    );
  }

  if (!manifestReady || !playerUrl) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#60a5fa" />
          <Text style={styles.loadingText}>Preparing stream...</Text>
          <Text style={[styles.loadingText, { fontSize: 12, marginTop: 8, opacity: 0.7 }]}>
            {retryCount > 0
              ? `Checking stream availability (${retryCount + 1}/${maxRetries})...`
              : 'Connecting to stream...'
            }
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, fillContainer && styles.containerFill]}>
      {player ? (
        <VideoView
          player={player}
          style={styles.video}
          contentFit={fillContainer ? 'cover' : 'contain'}
          nativeControls={Platform.OS === 'ios' && showControls}
          fullscreenOptions={{ enable: true }}
        />
      ) : (
        <View style={styles.placeholder}>
          <Feather name="video" size={48} color="#6b7280" />
          <Text style={styles.placeholderText}>Initializing player...</Text>
        </View>
      )}

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#60a5fa" />
          <Text style={styles.loadingText}>Loading stream...</Text>
        </View>
      )}

      {Platform.OS === 'android' && showControls && !isLoading && player && (
        <TouchableOpacity
          style={styles.controlsOverlay}
          onPress={() => setShowControlsOverlay(!showControlsOverlay)}
          activeOpacity={1}
        >
          {showControlsOverlay && (
            <View style={styles.controlsContainer}>
              <TouchableOpacity
                onPress={togglePlayPause}
                style={styles.controlButton}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={['rgba(0, 0, 0, 0.6)', 'rgba(0, 0, 0, 0.4)']}
                  style={styles.controlButtonGradient}
                >
                  <Feather
                    name={player.playing ? 'pause' : 'play'}
                    size={24}
                    color="#ffffff"
                  />
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={toggleFullscreen}
                style={styles.controlButton}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={['rgba(0, 0, 0, 0.6)', 'rgba(0, 0, 0, 0.4)']}
                  style={styles.controlButtonGradient}
                >
                  <Feather name="maximize" size={24} color="#ffffff" />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000000',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  containerFill: {
    ...StyleSheet.absoluteFillObject,
    aspectRatio: undefined,
    borderRadius: 0,
    borderWidth: 0,
  },
  video: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111827',
  },
  placeholderText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '500',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '500',
  },
  liveBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ffffff',
  },
  liveText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  controlsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  controlButton: {
    borderRadius: 30,
    overflow: 'hidden',
  },
  controlButtonGradient: {
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 30,
  },
});

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, TouchableOpacity, Platform, AppState, AppStateStatus } from 'react-native';
import InCallManager from 'react-native-incall-manager';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { hapticLight } from '../utils/haptics';

let RTCPeerConnection: any;
let RTCSessionDescription: any;
let RTCView: any;

try {
  const webrtc = require('react-native-webrtc');
  RTCPeerConnection = webrtc.RTCPeerConnection;
  RTCSessionDescription = webrtc.RTCSessionDescription;
  RTCView = webrtc.RTCView;
} catch {
}

interface WebRTCPlayerProps {
  whepUrl: string;
  isLive?: boolean;
  onError?: (error: string) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
  showControls?: boolean;
  fillContainer?: boolean;
}

export default function WebRTCPlayer({
  whepUrl,
  isLive = true,
  onError,
  onConnected,
  onDisconnected,
  showControls = true,
  fillContainer = false,
}: WebRTCPlayerProps) {
  const peerConnectionRef = useRef<any>(null);
  const [remoteStreamURL, setRemoteStreamURL] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isNativeModuleAvailable, setIsNativeModuleAvailable] = useState(false);
  const [showControlsOverlay, setShowControlsOverlay] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 8;
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const disconnectGraceRef = useRef<NodeJS.Timeout | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const wasConnectedRef = useRef(false);
  const whepUrlRef = useRef(whepUrl);
  const retryCountRef = useRef(0);

  useEffect(() => {
    whepUrlRef.current = whepUrl;
  }, [whepUrl]);

  useEffect(() => {
    retryCountRef.current = retryCount;
  }, [retryCount]);

  useEffect(() => {
    if (RTCPeerConnection && RTCView) {
      setIsNativeModuleAvailable(true);
    } else {
      setIsNativeModuleAvailable(false);
      setError('WebRTC playback not available on this device');
      setIsConnecting(false);
    }
  }, []);

  const iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' },
    ],
  };

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      const prevState = appStateRef.current;
      appStateRef.current = nextAppState;
      console.debug('[WebRTCPlayer] appState', {
        prevState,
        nextAppState,
        wasConnected: wasConnectedRef.current,
      });

      if (prevState.match(/inactive|background/) && nextAppState === 'active') {
        const pc = peerConnectionRef.current;
        const iceState = pc?.iceConnectionState;
        console.debug('[WebRTCPlayer] appState->active check', {
          hasPc: !!pc,
          iceState,
          wasConnected: wasConnectedRef.current,
        });

        if (wasConnectedRef.current && (!pc || iceState === 'failed' || iceState === 'disconnected' || iceState === 'closed')) {
          console.debug('[WebRTCPlayer] reconnect on foreground', { iceState });
          cleanupConnection();
          setRetryCount(0);
          retryCountRef.current = 0;
          setError(null);
          connectWHEP();
        } else if (wasConnectedRef.current) {
          // Returning from background with an active connection — re-force speaker
          console.debug('[WebRTCPlayer] foreground force speaker on');
          InCallManager.setForceSpeakerphoneOn(true);
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);

  const cleanupConnection = useCallback(() => {
    if (disconnectGraceRef.current) {
      clearTimeout(disconnectGraceRef.current);
      disconnectGraceRef.current = null;
    }
    if (peerConnectionRef.current) {
      try {
        peerConnectionRef.current.close();
      } catch {}
      peerConnectionRef.current = null;
    }
  }, []);

  const connectWHEP = useCallback(async () => {
    if (!whepUrlRef.current || !isNativeModuleAvailable) {
      return;
    }

    try {
      setIsConnecting(true);
      setError(null);

      // Start InCallManager in video mode — routes audio to loudspeaker
      console.debug('[WebRTCPlayer] InCallManager.start', { media: 'video' });
      InCallManager.start({ media: 'video' });
      console.debug('[WebRTCPlayer] InCallManager.setForceSpeakerphoneOn(true)');
      InCallManager.setForceSpeakerphoneOn(true);

      const pc = new RTCPeerConnection(iceServers);
      peerConnectionRef.current = pc;

      pc.ontrack = (event: any) => {
        const trackKind = event.track?.kind;

        if (trackKind === 'video' && event.streams && event.streams[0]) {
          const streamUrl = event.streams[0].toURL();
          setRemoteStreamURL(streamUrl);
          setIsConnecting(false);
          setIsConnected(true);
          wasConnectedRef.current = true;
          setRetryCount(0);
          retryCountRef.current = 0;
          onConnected?.();
        }
      };

      pc.oniceconnectionstatechange = () => {
        const state = pc.iceConnectionState;
        console.debug('[WebRTCPlayer] iceConnectionState', { state, appState: appStateRef.current });
        if (state === 'connected' || state === 'completed') {
          setIsConnected(true);
          setIsConnecting(false);
          wasConnectedRef.current = true;
          setRetryCount(0);
          retryCountRef.current = 0;
        } else if (state === 'disconnected') {
          if (disconnectGraceRef.current) clearTimeout(disconnectGraceRef.current);
          disconnectGraceRef.current = setTimeout(() => {
            if (peerConnectionRef.current === pc && pc.iceConnectionState === 'disconnected') {
              handleConnectionError('Connection interrupted');
            }
          }, 4000);
        } else if (state === 'failed') {
          handleConnectionError('Connection failed');
        } else if (state === 'closed') {
          setIsConnected(false);
          onDisconnected?.();
        }
      };

      pc.onconnectionstatechange = () => {
        console.debug('[WebRTCPlayer] connectionState', {
          state: pc.connectionState,
          appState: appStateRef.current,
        });
        if (pc.connectionState === 'failed') {
          handleConnectionError('Connection failed');
        }
      };

      pc.addTransceiver('video', { direction: 'recvonly' });
      pc.addTransceiver('audio', { direction: 'recvonly' });

      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });

      await pc.setLocalDescription(offer);

      await waitForICEGathering(pc);

      const localSDP = pc.localDescription;

      const response = await fetch(whepUrlRef.current, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/sdp',
        },
        body: localSDP.sdp,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('WHEP request failed:', response.status, errorText);
        throw new Error(`WHEP request failed: ${response.status}`);
      }

      const answerSDP = await response.text();

      const answer = new RTCSessionDescription({
        type: 'answer',
        sdp: answerSDP,
      });
      await pc.setRemoteDescription(answer);

    } catch (err: any) {
      console.error('❌ WHEP connection error:', err);
      handleConnectionError(err.message || 'Failed to connect');
    }
  }, [isNativeModuleAvailable, onConnected]);

  const handleConnectionError = useCallback((errorMessage: string) => {
    console.debug('[WebRTCPlayer] handleConnectionError', {
      errorMessage,
      retryCount: retryCountRef.current,
      maxRetries,
      appState: appStateRef.current,
    });
    setIsConnecting(false);
    setIsConnected(false);

    cleanupConnection();

    const currentRetry = retryCountRef.current;
    if (currentRetry < maxRetries) {
      const delay = Math.min(1000 * Math.pow(1.5, currentRetry), 10000);
      reconnectTimeoutRef.current = setTimeout(() => {
        const next = retryCountRef.current + 1;
        setRetryCount(next);
        retryCountRef.current = next;
        connectWHEP();
      }, delay);
    } else {
      setError(errorMessage);
      onError?.(errorMessage);
    }
  }, [maxRetries, connectWHEP, onError, cleanupConnection]);

  const waitForICEGathering = (pc: any): Promise<void> => {
    return new Promise((resolve) => {
      if (pc.iceGatheringState === 'complete') {
        resolve();
        return;
      }

      const checkState = () => {
        if (pc.iceGatheringState === 'complete') {
          pc.removeEventListener('icegatheringstatechange', checkState);
          resolve();
        }
      };

      pc.addEventListener('icegatheringstatechange', checkState);

      setTimeout(() => {
        pc.removeEventListener('icegatheringstatechange', checkState);
        resolve();
      }, 5000);
    });
  };

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    cleanupConnection();
    console.debug('[WebRTCPlayer] InCallManager.stop');
    InCallManager.stop();

    setRemoteStreamURL(null);
    setIsConnected(false);
    setIsConnecting(false);
    wasConnectedRef.current = false;
    onDisconnected?.();
  }, [onDisconnected, cleanupConnection]);

  useEffect(() => {
    if (whepUrl && isNativeModuleAvailable) {
      connectWHEP();
    }

    return () => {
      disconnect();
    };
  }, [whepUrl, isNativeModuleAvailable]);

  if (!isNativeModuleAvailable) {
    return (
      <View style={styles.container}>
        <View style={styles.placeholder}>
          <Feather name="video-off" size={48} color="#6b7280" />
          <Text style={styles.placeholderText}>WebRTC not available</Text>
          <Text style={[styles.placeholderText, { fontSize: 12, opacity: 0.7 }]}>
            Build with react-native-webrtc for live playback
          </Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.placeholder}>
          <Feather name="alert-circle" size={48} color="#ef4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            onPress={() => {
              hapticLight();
              setError(null);
              setRetryCount(0);
              retryCountRef.current = 0;
              wasConnectedRef.current = false;
              connectWHEP();
            }}
            style={styles.retryButton}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (isConnecting || !remoteStreamURL) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#60a5fa" />
          <Text style={styles.loadingText}>
            {retryCount > 0
              ? `Reconnecting to stream (attempt ${retryCount + 1})...`
              : 'Connecting to live stream...'
            }
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, fillContainer && styles.containerFill]}>
      {RTCView && (
        <RTCView
          streamURL={remoteStreamURL}
          style={styles.video}
          objectFit="contain"
          zOrder={0}
        />
      )}

      {showControls && Platform.OS === 'android' && (
        <TouchableOpacity
          style={styles.controlsOverlay}
          onPress={() => setShowControlsOverlay(!showControlsOverlay)}
          activeOpacity={1}
        >
          {showControlsOverlay && (
            <View style={styles.controlsContainer}>
              <TouchableOpacity
                onPress={() => {
                  hapticLight();
                  disconnect();
                  setTimeout(connectWHEP, 500);
                }}
                style={styles.controlButton}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={['rgba(0, 0, 0, 0.6)', 'rgba(0, 0, 0, 0.4)']}
                  style={styles.controlButtonGradient}
                >
                  <Feather name="refresh-cw" size={24} color="#ffffff" />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

export function isWHEPPlaybackAvailable(): boolean {
  return !!RTCPeerConnection && !!RTCView;
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
    padding: 20,
  },
  placeholderText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '500',
    textAlign: 'center',
  },
  errorText: {
    marginTop: 16,
    fontSize: 14,
    color: '#ef4444',
    fontWeight: '500',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  retryButtonText: {
    color: '#60a5fa',
    fontSize: 14,
    fontWeight: '600',
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
    textAlign: 'center',
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

import React, { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { View, StyleSheet, Platform, AppState, AppStateStatus } from 'react-native';
import * as Device from 'expo-device';

let RTCPeerConnection: any;
let RTCSessionDescription: any;
let mediaDevices: any;
let RTCView: any;

try {
  const webrtc = require('react-native-webrtc');
  RTCPeerConnection = webrtc.RTCPeerConnection;
  RTCSessionDescription = webrtc.RTCSessionDescription;
  mediaDevices = webrtc.mediaDevices;
  RTCView = webrtc.RTCView;
} catch {
}

interface WebRTCStreamerProps {
  whipUrl: string;
  isStreaming: boolean;
  onStreamStart?: () => void;
  onStreamStop?: () => void;
  onError?: (error: string) => void;
  cameraFacing?: 'front' | 'back';
  videoBitrate?: number;
  audioBitrate?: number;
  videoResolution?: { width: number; height: number };
}

export interface WebRTCStreamerRef {
  startStreaming: () => Promise<void>;
  stopStreaming: () => void;
  switchCamera: () => void;
}

const WHIP_TIMEOUT_MS = 35000;

/** Ensure URL has a scheme and, on Android emulator, rewrite localhost → 10.0.2.2 so the emulator can reach the host machine. */
function normalizeWhipUrl(url: string): string {
  let u = url.trim();
  if (!/^https?:\/\//i.test(u)) {
    u = `https://${u}`;
  }
  if (Platform.OS === 'android' && (u.includes('localhost') || u.includes('127.0.0.1'))) {
    u = u.replace(/localhost|127\.0\.0\.1/gi, '10.0.2.2');
  }
  return u;
}

async function whipPost(url: string, sdp: string): Promise<string> {
  const fullUrl = normalizeWhipUrl(url);

  if (Platform.OS === 'android') {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const timeoutId = setTimeout(() => {
        xhr.abort();
        reject(new Error('Request timeout'));
      }, WHIP_TIMEOUT_MS);

      xhr.open('POST', fullUrl);
      xhr.setRequestHeader('Content-Type', 'application/sdp');
      xhr.setRequestHeader('Accept', 'application/sdp');
      xhr.timeout = WHIP_TIMEOUT_MS;

      xhr.onload = () => {
        clearTimeout(timeoutId);
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(xhr.responseText);
        } else {
          reject(new Error(`WHIP request failed: ${xhr.status} ${xhr.responseText || xhr.statusText}`));
        }
      };
      xhr.onerror = () => {
        clearTimeout(timeoutId);
        reject(new Error('Network request failed'));
      };
      xhr.ontimeout = () => {
        clearTimeout(timeoutId);
        reject(new Error('Request timeout'));
      };
      xhr.send(sdp);
    });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), WHIP_TIMEOUT_MS);
  try {
    const response = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/sdp',
        'Accept': 'application/sdp',
      },
      body: sdp,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`WHIP request failed: ${response.status} ${errorText}`);
    }
    return response.text();
  } catch (e: any) {
    clearTimeout(timeoutId);
    if (e.name === 'AbortError') throw new Error('Request timeout');
    throw e;
  }
}

const WebRTCStreamer = forwardRef<WebRTCStreamerRef, WebRTCStreamerProps>(({
  whipUrl,
  isStreaming,
  onStreamStart,
  onStreamStop,
  onError,
  cameraFacing = 'back',
  videoResolution = { width: 1280, height: 720 },
}, ref) => {
  const videoRes = videoResolution || { width: 1280, height: 720 };

  const peerConnectionRef = useRef<any>(null);
  const localStreamRef = useRef<any>(null);
  const [localStreamURL, setLocalStreamURL] = useState<string | null>(null);
  const [isNativeModuleAvailable, setIsNativeModuleAvailable] = useState(false);
  const [isSimulator, setIsSimulator] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isStreamReady, setIsStreamReady] = useState(false);
  const hasStartedRef = useRef(false);
  const isInitializingRef = useRef(false);
  const [currentFacing, setCurrentFacing] = useState(cameraFacing);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 8;
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const wasStreamingBeforeBackgroundRef = useRef(false);
  
  const onErrorRef = useRef(onError);
  const onStreamStartRef = useRef(onStreamStart);
  const onStreamStopRef = useRef(onStreamStop);
  const whipUrlRef = useRef(whipUrl);
  
  useEffect(() => {
    onErrorRef.current = onError;
    onStreamStartRef.current = onStreamStart;
    onStreamStopRef.current = onStreamStop;
  }, [onError, onStreamStart, onStreamStop]);

  useEffect(() => {
    whipUrlRef.current = whipUrl;
  }, [whipUrl]);

  const iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      const prevState = appStateRef.current;
      appStateRef.current = nextAppState;

      if (prevState === 'active' && nextAppState.match(/inactive|background/)) {
        if (hasStartedRef.current && peerConnectionRef.current) {
          wasStreamingBeforeBackgroundRef.current = true;
          const videoTrack = localStreamRef.current?.getVideoTracks()?.[0];
          if (videoTrack) {
            videoTrack.enabled = false;
          }
        }
      } else if (prevState.match(/inactive|background/) && nextAppState === 'active') {
        const videoTrack = localStreamRef.current?.getVideoTracks()?.[0];
        if (videoTrack) {
          videoTrack.enabled = true;
        }

        if (wasStreamingBeforeBackgroundRef.current && hasStartedRef.current) {
          const pc = peerConnectionRef.current;
          const iceState = pc?.iceConnectionState;
          if (!pc || iceState === 'failed' || iceState === 'disconnected' || iceState === 'closed') {
            reconnectStream();
          }
        }
        wasStreamingBeforeBackgroundRef.current = false;
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);

  const reconnectStream = useCallback(async () => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      onErrorRef.current?.('Stream connection lost. Please restart the stream.');
      return;
    }

    reconnectAttemptsRef.current += 1;
    const attempt = reconnectAttemptsRef.current;
    const delay = Math.min(1000 * Math.pow(1.5, attempt - 1), 8000);

    reconnectTimerRef.current = setTimeout(async () => {
      if (peerConnectionRef.current) {
        try {
          peerConnectionRef.current.close();
        } catch {}
        peerConnectionRef.current = null;
      }
      setIsConnected(false);

      if (localStreamRef.current && whipUrlRef.current) {
        try {
          await startWHIPStream();
        } catch (err: any) {
          // if this attempt fails, the ICE state handler will trigger another reconnect
        }
      }
    }, delay);
  }, []);

  useImperativeHandle(ref, () => ({
    startStreaming: async () => {
      if (!whipUrl) {
        onErrorRef.current?.('No WHIP URL provided');
        return;
      }
      reconnectAttemptsRef.current = 0;
      await startWHIPStream();
    },
    stopStreaming: () => {
      stopWHIPStream();
    },
    switchCamera: () => {
      switchCamera();
    },
  }));

  useEffect(() => {
    const checkSimulator = async () => {
      try {
        const deviceName = Device.deviceName || '';
        const modelName = Device.modelName || '';
                
        const isSim = deviceName.toLowerCase().includes('simulator') ||
                     modelName.toLowerCase().includes('simulator');
        
        setIsSimulator(isSim);
      } catch (error) {
        console.error('Error checking device:', error);
        setIsSimulator(false);
      }
    };

    checkSimulator();
  }, []);

  useEffect(() => {
    if (RTCPeerConnection && mediaDevices && RTCView) {
      if (!isSimulator) {
        setIsNativeModuleAvailable(true);
      } else {
        setIsNativeModuleAvailable(false);
      }
    } else {
      setIsNativeModuleAvailable(false);
    }
  }, [isSimulator]);

  useEffect(() => {
    if (!isNativeModuleAvailable) return;
    
    if (isInitializingRef.current || localStreamRef.current) {
      return;
    }

    const initLocalStream = async () => {
      isInitializingRef.current = true;
      try {
        const constraints = {
          audio: true,
          video: {
            facingMode: currentFacing === 'front' ? 'user' : 'environment',
            width: { ideal: videoRes.width },
            height: { ideal: videoRes.height },
            frameRate: { ideal: 30 },
          },
        };

        const stream = await mediaDevices.getUserMedia(constraints);
        
        if (localStreamRef.current) {
          stream.getTracks().forEach((track: any) => track.stop());
          return;
        }
        
        localStreamRef.current = stream;
        setLocalStreamURL(stream.toURL());
        setIsStreamReady(true);
      } catch (error: any) {
        console.error('❌ Failed to get user media:', error);
        onErrorRef.current?.(`Failed to access camera: ${error.message}`);
      } finally {
        isInitializingRef.current = false;
      }
    };

    initLocalStream();

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
        hasStartedRef.current = false;
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track: any) => track.stop());
        localStreamRef.current = null;
      }
      setLocalStreamURL(null);
      setIsStreamReady(false);
      setIsConnected(false);
      isInitializingRef.current = false;
    };
  }, [isNativeModuleAvailable]);

  useEffect(() => {
    if (!isNativeModuleAvailable || !whipUrl || !isStreamReady) {
      return;
    }

    if (isStreaming && !hasStartedRef.current) {
      hasStartedRef.current = true;
      reconnectAttemptsRef.current = 0;
      startWHIPStream();
    } else if (!isStreaming && hasStartedRef.current) {
      hasStartedRef.current = false;
      stopWHIPStream();
    }
  }, [isStreaming, isNativeModuleAvailable, whipUrl, isStreamReady]);

  const startWHIPStream = async () => {
    if (!localStreamRef.current) {
      console.error('❌ No local stream available');
      onErrorRef.current?.('Camera not ready');
      return;
    }

    try {
      const pc = new RTCPeerConnection(iceServers);
      peerConnectionRef.current = pc;

      localStreamRef.current.getTracks().forEach((track: any) => {
        pc.addTrack(track, localStreamRef.current);
      });

      pc.oniceconnectionstatechange = () => {
        const state = pc.iceConnectionState;
        if (state === 'connected' || state === 'completed') {
          setIsConnected(true);
          reconnectAttemptsRef.current = 0;
          onStreamStartRef.current?.();
        } else if (state === 'disconnected') {
          setTimeout(() => {
            if (peerConnectionRef.current === pc && pc.iceConnectionState === 'disconnected') {
              if (hasStartedRef.current) {
                reconnectStream();
              }
            }
          }, 3000);
        } else if (state === 'failed') {
          setIsConnected(false);
          if (hasStartedRef.current) {
            reconnectStream();
          }
        }
      };

      const offer = await pc.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false,
      });

      await pc.setLocalDescription(offer);

      await waitForICEGathering(pc);

      const finalOffer = pc.localDescription;

      const whipUrl = normalizeWhipUrl(whipUrlRef.current);
      if (__DEV__) {
        try {
          const host = new URL(whipUrl).host;
          console.log('[WHIP] POST to', host, whipUrl.includes('10.0.2.2') ? '(localhost→10.0.2.2)' : '');
        } catch (_) {}
      }

      const answerSDP = await whipPost(whipUrl, finalOffer.sdp);

      const answer = new RTCSessionDescription({
        type: 'answer',
        sdp: answerSDP,
      });
      await pc.setRemoteDescription(answer);

    } catch (error: any) {
      const msg = error?.message ?? '';
      const isNetworkError = msg.includes('Network request failed') || msg.includes('Failed to fetch') || msg.includes('Request timeout');
      const host = (() => {
        try {
          return new URL(whipUrlRef.current).host;
        } catch {
          return whipUrlRef.current;
        }
      })();
      if (isNetworkError && Platform.OS === 'android') {
        const isLocalhost = (whipUrlRef.current ?? '').includes('localhost') || (whipUrlRef.current ?? '').includes('127.0.0.1');
        console.error(
          `❌ WHIP stream error (Android): ${msg}\n` +
          `   Endpoint: ${host}\n` +
          (isLocalhost
            ? `   (URL uses localhost → we rewrite to 10.0.2.2 for emulator; ensure your WHIP server is running on the host.)\n`
            : `   (External URL – emulator needs internet to reach it. Cold boot AVD, open Chrome in emulator to verify internet. 10.0.2.2 is only used when the URL contains localhost.)\n`) +
          `   Device: Ensure internet and stream URL are reachable.`
        );
      } else {
        console.error('❌ WHIP stream error:', error);
      }
      if (hasStartedRef.current && reconnectAttemptsRef.current < maxReconnectAttempts) {
        reconnectStream();
      } else {
        hasStartedRef.current = false;
        onErrorRef.current?.(`Stream failed: ${error.message}`);
        stopWHIPStream();
      }
    }
  };

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

  const stopWHIPStream = () => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    reconnectAttemptsRef.current = 0;

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    setIsConnected(false);
    onStreamStopRef.current?.();
  };

  const switchCamera = async () => {
    if (!localStreamRef.current) return;

    try {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack && videoTrack._switchCamera) {
        await videoTrack._switchCamera();
        setCurrentFacing(current => current === 'front' ? 'back' : 'front');
      }
    } catch (error) {
      console.error('Failed to switch camera:', error);
    }
  };

  if (isSimulator) {
    return null;
  }

  if (!isNativeModuleAvailable || !RTCView) {
    return null;
  }

  return (
    <View style={styles.container}>
      {localStreamURL && (
        <RTCView
          streamURL={localStreamURL}
          style={styles.preview}
          objectFit="cover"
          mirror={currentFacing === 'front'}
          zOrder={0}
        />
      )}
    </View>
  );
});

WebRTCStreamer.displayName = 'WebRTCStreamer';

export default WebRTCStreamer;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  preview: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});

export function isWebRTCStreamingAvailable(): boolean {
  try {
    const hasModule = !!RTCPeerConnection && !!mediaDevices && !!RTCView;
    return hasModule;
  } catch (error) {
    console.error('Error checking WebRTC availability:', error);
    return false;
  }
}

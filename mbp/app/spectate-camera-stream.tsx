import React, { useState, useEffect, useRef } from 'react';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Platform, Animated, PanResponder, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as ScreenOrientation from 'expo-screen-orientation';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import * as Device from 'expo-device';
import { hapticLight, hapticMedium } from '../src/utils/haptics';
import WebRTCStreamer, { isWebRTCStreamingAvailable, WebRTCStreamerRef } from '../src/components/WebRTCStreamer';
import { deleteStream } from '../src/api/streams';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const BACKGROUND_COLOR = '#020617';

export default function CameraStreamScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ 
    matchId: string;
    streamUid: string;
    rtmpUrl?: string;
    streamKey?: string;
    webRTCUrl?: string;
  }>();
  
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingError, setStreamingError] = useState<string | null>(null);
  const [nativeStreamingAvailable, setNativeStreamingAvailable] = useState(false);
  const [isSimulator, setIsSimulator] = useState<boolean | null>(null);
  const [isAndroidEmulator, setIsAndroidEmulator] = useState<boolean>(false);
  const [showStreamer, setShowStreamer] = useState(false);
  const streamerRef = useRef<WebRTCStreamerRef>(null);
  const teardownInFlightRef = useRef(false);
  const streamDeletedRef = useRef(false);

  const androidTestPan = useRef(new Animated.ValueXY({ x: SCREEN_WIDTH / 2 - 80, y: SCREEN_HEIGHT / 2 - 80 })).current;
  const androidTestPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        hapticLight();
        androidTestPan.setOffset({ x: (androidTestPan.x as any)._value, y: (androidTestPan.y as any)._value });
        androidTestPan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event([null, { dx: androidTestPan.x, dy: androidTestPan.y }], { useNativeDriver: false }),
      onPanResponderRelease: () => {
        androidTestPan.flattenOffset();
      },
    })
  ).current;

  useEffect(() => {
    const checkSimulator = async () => {
      try {
        const deviceName = Device.deviceName || '';
        const modelName = Device.modelName || '';
        const isSim = deviceName.toLowerCase().includes('simulator') ||
                     modelName.toLowerCase().includes('simulator');
        setIsSimulator(isSim);
        setIsAndroidEmulator(Platform.OS === 'android' && !Device.isDevice);
      } catch (error) {
        console.error('Error checking simulator:', error);
        setIsSimulator(false);
        setIsAndroidEmulator(false);
      }
    };

    checkSimulator();
  }, []);

  useEffect(() => {
    if (isSimulator === null) {
      return;
    }

    const checkAvailability = () => {
      const available = isWebRTCStreamingAvailable() && !isSimulator;
      setNativeStreamingAvailable(available);
    };
    
    checkAvailability();
    const timeout = setTimeout(checkAvailability, 500);
    
    return () => clearTimeout(timeout);
  }, [isSimulator]);

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  useEffect(() => {
    if (!isSimulator && isStreaming && showStreamer) {
      ScreenOrientation.unlockAsync().catch(() => {});
    } else if (!isSimulator) {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    }
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, [isSimulator, isStreaming, showStreamer]);

  const toggleCameraFacing = () => {
    hapticLight();
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  const startStreaming = async () => {
    if (!params.webRTCUrl) {
      Alert.alert('Error', 'WebRTC stream URL not available. Please try creating a new stream.');
      return;
    }

    hapticMedium();
    setStreamingError(null);

    if (!nativeStreamingAvailable) {
      const message = isSimulator
        ? 'Camera streaming is not available on iOS Simulator. Please test on a real device.\n\n' +
          'The iOS Simulator does not have a camera, so native streaming cannot work.\n\n' +
          'To test streaming:\n' +
          '1. Build and run on a physical iOS device\n' +
          '2. Or use external software like OBS with WHIP support'
        : 'Direct camera streaming requires a development build with react-native-webrtc.\n\n' +
          'To enable native streaming:\n' +
          '1. Install: npm install react-native-webrtc\n' +
          '2. iOS: cd ios && pod install\n' +
          '3. Create a development build\n\n' +
          'For now, you can use external software like OBS with WHIP support.';

      Alert.alert(
        isSimulator ? 'Simulator Not Supported' : 'Native Streaming Not Available',
        message,
        [
          { 
            text: 'View Stream', 
            onPress: () => {
              router.push({
                pathname: '/spectate-stream-viewer',
                params: { matchId: params.matchId },
              });
            }
          },
          { text: 'OK', style: 'default' }
        ]
      );
      return;
    }

    setShowStreamer(true);
    setTimeout(() => {
      setIsStreaming(true);
    }, 500);
  };

  const closeLocalStream = React.useCallback(() => {
    setIsStreaming(false);
    setStreamingError(null);
    setTimeout(() => {
      setShowStreamer(false);
    }, 300);
  }, []);

  const teardownStreamAndExit = React.useCallback(
    async (shouldNavigateBack: boolean) => {
      if (teardownInFlightRef.current) return;
      teardownInFlightRef.current = true;
      hapticMedium();
      closeLocalStream();

      if (!streamDeletedRef.current && params.streamUid) {
        try {
          await deleteStream(params.streamUid);
          streamDeletedRef.current = true;
        } catch (error) {
          console.warn('Failed to delete stream during teardown:', error);
        }
      }

      teardownInFlightRef.current = false;
      if (shouldNavigateBack) {
        router.back();
      }
    },
    [closeLocalStream, params.streamUid]
  );

  const stopStreaming = React.useCallback(() => {
    void teardownStreamAndExit(true);
  }, [teardownStreamAndExit]);

  if (!permission) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Stack.Screen
          options={{
            title: 'Camera Stream',
            headerStyle: { backgroundColor: BACKGROUND_COLOR },
            headerTintColor: '#ffffff',
            headerShadowVisible: false,
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#60a5fa" />
          <Text style={styles.loadingText}>Requesting camera permission...</Text>
        </View>
      </View>
    );
  }

  if (isSimulator === null) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Stack.Screen
          options={{
            title: 'Live Stream',
            headerStyle: { backgroundColor: BACKGROUND_COLOR },
            headerTintColor: '#ffffff',
            headerShadowVisible: false,
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#60a5fa" />
          <Text style={styles.loadingText}>Checking device...</Text>
        </View>
      </View>
    );
  }

  if (!isSimulator && !permission.granted) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Stack.Screen
          options={{
            title: 'Camera Stream',
            headerStyle: { backgroundColor: BACKGROUND_COLOR },
            headerTintColor: '#ffffff',
            headerShadowVisible: false,
          }}
        />
        <View style={styles.permissionContainer}>
          <Feather name="camera-off" size={64} color="#6b7280" />
          <Text style={styles.permissionTitle}>Camera Permission Required</Text>
          <Text style={styles.permissionText}>
            We need access to your camera to start streaming.
          </Text>
          <TouchableOpacity
            onPress={requestPermission}
            style={styles.permissionButton}
            activeOpacity={0.7}
          >
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen
        options={{
          title: 'Live Stream',
          headerStyle: { backgroundColor: BACKGROUND_COLOR },
          headerTintColor: '#ffffff',
          headerShadowVisible: false,
        }}
      />
      
      <View style={styles.cameraContainer}>
        {isSimulator ? (
          <View style={[styles.camera, styles.simulatorPlaceholder]}>
            <Feather name="camera-off" size={64} color="#6b7280" />
            <Text style={styles.simulatorText}>Camera Not Available</Text>
            <Text style={styles.simulatorSubtext}>
              iOS Simulator does not have a camera.{'\n'}
              Please test on a physical device.
            </Text>
          </View>
        ) : (
          <>
            {!showStreamer ? (
              <CameraView
                style={styles.camera}
                facing={facing}
                mode="picture"
              />
            ) : isAndroidEmulator ? (
              <View style={[styles.camera, styles.androidEmulatorPlaceholder]}>
                <Text style={styles.androidEmulatorTitle}>Android Emulator – Test View</Text>
                <Text style={styles.androidEmulatorSubtext}>WHIP is not available here. Drag the card to test layout.</Text>
                <Animated.View
                  style={[
                    styles.androidTestCard,
                    {
                      transform: androidTestPan.getTranslateTransform(),
                    },
                  ]}
                  {...androidTestPanResponder.panHandlers}
                >
                  <Feather name="video" size={48} color="#60a5fa" />
                  <Text style={styles.androidTestCardLabel}>Drag me</Text>
                </Animated.View>
              </View>
            ) : nativeStreamingAvailable && params.webRTCUrl ? (
              <WebRTCStreamer
                ref={streamerRef}
                whipUrl={params.webRTCUrl}
                isStreaming={isStreaming}
                cameraFacing={facing === 'front' ? 'front' : 'back'}
                videoBitrate={2000000}
                audioBitrate={128000}
                onStreamStart={() => {
                  hapticMedium();
                  setStreamingError(null);
                }}
                onStreamStop={() => {
                  hapticLight();
                }}
                onError={(error) => {
                  console.error('❌ WebRTC streaming error:', error);
                  setStreamingError(error);
                  setIsStreaming(false);
                  setShowStreamer(false);
                  Alert.alert('Streaming Error', error);
                }}
              />
            ) : (
              <CameraView
                style={styles.camera}
                facing={facing}
                mode="picture"
              />
            )}
          </>
        )}
        
        {/* In-content error state: icon + message when WHIP/stream fails */}
        {streamingError && (
          <View style={styles.errorOverlay} pointerEvents="box-none">
            <View style={styles.errorCard}>
              <Feather name="alert-circle" size={48} color="#ef4444" />
              <Text style={styles.errorCardTitle}>Stream failed</Text>
              <Text style={styles.errorCardMessage}>{streamingError}</Text>
              <TouchableOpacity
                onPress={() => setStreamingError(null)}
                style={styles.errorDismissButton}
                activeOpacity={0.8}
              >
                <Text style={styles.errorDismissText}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.overlay} pointerEvents="box-none">
          <View style={styles.topBar}>
            {isStreaming && (
              <View style={styles.liveIndicator}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            )}
          </View>

          <View style={styles.bottomControls}>
            {!isSimulator && (
              <TouchableOpacity
                onPress={toggleCameraFacing}
                style={styles.controlButton}
                activeOpacity={0.7}
                disabled={isStreaming}
              >
                <LinearGradient
                  colors={isStreaming ? ['rgba(50, 50, 50, 0.6)', 'rgba(50, 50, 50, 0.4)'] : ['rgba(0, 0, 0, 0.6)', 'rgba(0, 0, 0, 0.4)']}
                  style={styles.controlButtonGradient}
                >
                  <Feather name="refresh-cw" size={24} color={isStreaming ? '#666' : '#ffffff'} />
                </LinearGradient>
              </TouchableOpacity>
            )}
            {isSimulator && <View style={{ width: 56 }} />}

            {!isStreaming ? (
              <TouchableOpacity
                onPress={startStreaming}
                style={[
                  styles.streamButton,
                  (isSimulator || !nativeStreamingAvailable || !params.webRTCUrl) && styles.streamButtonDisabled
                ]}
                activeOpacity={0.8}
                disabled={isSimulator || !nativeStreamingAvailable || !params.webRTCUrl}
              >
                <LinearGradient
                  colors={
                    isSimulator 
                      ? ['#6b7280', '#4b5563']
                      : nativeStreamingAvailable 
                        ? ['#ef4444', '#dc2626']
                        : ['#6b7280', '#4b5563']
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.streamButtonGradient}
                >
                  <View style={styles.streamButtonInner}>
                    <View style={[styles.recordDot, (isSimulator || !nativeStreamingAvailable) && styles.recordDotDisabled]} />
                    <Text style={styles.streamButtonText}>
                      {isSimulator 
                        ? 'Simulator Not Supported' 
                        : nativeStreamingAvailable 
                          ? 'Go Live' 
                          : 'Setup Required'}
                    </Text>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={stopStreaming}
                style={styles.stopButton}
                activeOpacity={0.8}
              >
                <View style={styles.stopButtonInner}>
                  <View style={styles.stopSquare} />
                  <Text style={styles.stopButtonText}>End Stream</Text>
                </View>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={() => {
                if (isStreaming) {
                  Alert.alert(
                    'End Stream?',
                    'Are you sure you want to end the live stream?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { 
                        text: 'End Stream', 
                        style: 'destructive',
                        onPress: () => {
                          void teardownStreamAndExit(true);
                        }
                      }
                    ]
                  );
                } else {
                  hapticLight();
                  router.back();
                }
              }}
              style={styles.controlButton}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={['rgba(0, 0, 0, 0.6)', 'rgba(0, 0, 0, 0.4)']}
                style={styles.controlButtonGradient}
              >
                <Feather name="x" size={24} color="#ffffff" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    color: '#9ca3af',
    fontSize: 16,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 16,
  },
  permissionTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
  },
  permissionText: {
    color: '#9ca3af',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  permissionButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#3b82f6',
    borderRadius: 12,
  },
  permissionButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000000',
    position: 'relative',
    overflow: 'hidden',
  },
  camera: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  topBar: {
    paddingTop: 16,
    paddingHorizontal: 16,
    alignItems: 'flex-end',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.95)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ffffff',
  },
  liveText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 1,
  },
  bottomControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    gap: 16,
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
  streamButton: {
    flex: 1,
    borderRadius: 30,
    overflow: 'hidden',
    maxWidth: 180,
  },
  streamButtonDisabled: {
    opacity: 0.6,
  },
  streamButtonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  streamButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  recordDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#ffffff',
  },
  recordDotDisabled: {
    backgroundColor: '#9ca3af',
  },
  streamButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  stopButton: {
    flex: 1,
    borderRadius: 30,
    backgroundColor: '#374151',
    maxWidth: 180,
    paddingVertical: 16,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stopSquare: {
    width: 16,
    height: 16,
    backgroundColor: '#ffffff',
    borderRadius: 2,
  },
  stopButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 50,
    elevation: 50,
  },
  errorCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    maxWidth: 320,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  errorCardTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 8,
  },
  errorCardMessage: {
    color: '#f87171',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  errorDismissButton: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  errorDismissText: {
    color: '#fca5a5',
    fontSize: 15,
    fontWeight: '600',
  },
  simulatorPlaceholder: {
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  simulatorText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  simulatorSubtext: {
    color: '#9ca3af',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 32,
  },
  androidEmulatorPlaceholder: {
    backgroundColor: '#0f172a',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 48,
    paddingHorizontal: 24,
  },
  androidEmulatorTitle: {
    color: '#f1f5f9',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  androidEmulatorSubtext: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 32,
  },
  androidTestCard: {
    position: 'absolute',
    width: 160,
    height: 160,
    backgroundColor: '#1e293b',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  androidTestCardLabel: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
});

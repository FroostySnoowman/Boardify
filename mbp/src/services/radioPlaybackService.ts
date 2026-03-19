import { AppState, AppStateStatus, Platform } from 'react-native';
import { AudioStatus, createAudioPlayer, setAudioModeAsync, setIsAudioActiveAsync } from 'expo-audio';
import { Directory, File, Paths } from 'expo-file-system';
import { State as TrackPlayerState } from 'react-native-track-player';

import { getStoredSessionToken } from '../api/auth';
import { ENV } from '../config/env';
import { getImageUrl } from '../utils/imageUrl';
import { claimAudioSession, releaseAudioSession } from './audioSessionOwnership';
import {
  addRadioPlaybackErrorListener,
  addRadioPlaybackProgressListener,
  addRadioPlaybackStateListener,
  getRadioPlaybackState,
  pauseRadioStream,
  playRadioStream,
  resumeRadioStream,
  setRadioRemoteCommandHandlers,
  stopRadioStream,
  updateRadioNowPlaying,
} from './radioTrackPlayerService';
import {
  dismissRadioPlaybackNotification,
  showRadioPlaybackNotification,
  showRadioUpdateNotification,
} from './radioPlaybackNotificationService';

const WS_HEARTBEAT_INTERVAL_MS = 20000;
const WS_PONG_TIMEOUT_MS = 8000;
const WS_RECONNECT_BASE_MS = 1500;
const WS_RECONNECT_MAX_MS = 30000;
const STREAM_RECOVERY_BASE_MS = 2000;
const STREAM_RECOVERY_MAX_MS = 30000;
const STREAM_STABLE_PLAYING_DWELL_MS = 1500;
const STREAM_PROLONGED_BUFFERING_MS = 12000;
const STREAM_NO_PROGRESS_TIMEOUT_MS = 10000;

export interface AudioItem {
  url?: string;
  text: string;
  tts?: boolean;
}

interface RadioSocketMessage {
  type: 'connected' | 'radio' | 'pong';
  seq?: number;
  audio?: AudioItem[];
  text?: string;
}

interface RadioCatchupResponse {
  events: RadioSocketMessage[];
  latestSeq: number;
}

export interface RadioPlaybackState {
  enabled: boolean;
  connected: boolean;
  isPlaying: boolean;
  paused: boolean;
  hasPendingLive: boolean;
  lastCommentary: string | null;
  commentaryVersion: number;
  currentMatchId: string | null;
  debugLines: string[];
}

type StateListener = (state: RadioPlaybackState) => void;

const clipCache = new Map<string, string>();
const radioClipsDir = new Directory(Paths.cache, 'radio-clips');

async function downloadClip(remoteUrl: string): Promise<string> {
  const cached = clipCache.get(remoteUrl);
  if (cached) return cached;
  if (!radioClipsDir.exists) {
    radioClipsDir.create();
  }
  const filename = remoteUrl.replace(/[^a-zA-Z0-9._-]/g, '_') + '.wav';
  const dest = new File(radioClipsDir, filename);
  const downloaded = await File.downloadFileAsync(remoteUrl, dest, { idempotent: true });
  const uri = downloaded.uri;
  clipCache.set(remoteUrl, uri);
  return uri;
}

class RadioPlaybackService {
  private readonly listeners = new Set<StateListener>();
  private readonly player = createAudioPlayer(null, { keepAudioSessionActive: true });
  private readonly maxDebugLines = 200;

  private state: RadioPlaybackState = {
    enabled: false,
    connected: false,
    isPlaying: false,
    paused: false,
    hasPendingLive: false,
    lastCommentary: null,
    commentaryVersion: 0,
    currentMatchId: null,
    debugLines: [],
  };

  private wsRef: WebSocket | null = null;
  private reconnectTimeoutRef: ReturnType<typeof setTimeout> | null = null;
  private wsHeartbeatIntervalRef: ReturnType<typeof setInterval> | null = null;
  private wsPongTimeoutRef: ReturnType<typeof setTimeout> | null = null;
  private connectedRef = false;
  private wsReconnectAttemptRef = 0;
  private wsShouldReconnectRef = true;
  private cancelQueueRef = false;
  private pausedRef = false;
  private pendingAudioRef: AudioItem[] | null = null;
  private lastAudioRef: AudioItem[] | null = null;
  private queueRef: AudioItem[] = [];
  private queueIndexRef = -1;
  private playingQueueRef = false;
  private pendingPlayRef = false;
  private advancingRef = false;
  private pendingQueueReplacementRef: AudioItem[] | null = null;
  private pendingQueueReplacementReasonRef: string | null = null;
  private appStateRef: AppStateStatus = AppState.currentState;
  private lastWsConnectStartedAt = 0;
  private lastWsMessageAt = 0;
  private lastPlaybackPlaying = false;
  private lastPlaybackState = '';
  private playbackModeRef: 'stream' | 'queue' = 'stream';
  private streamStartupTimerRef: ReturnType<typeof setTimeout> | null = null;
  private streamRecoveryTimerRef: ReturnType<typeof setTimeout> | null = null;
  private streamRecoveryAttemptRef = 0;
  private lastSeenRadioSeqRef = 0;
  private catchupInFlightRef = false;
  private lastBackgroundUpdateNotificationAt = 0;
  private removeTrackPlayerStateListener: (() => void) | null = null;
  private removeTrackPlayerErrorListener: (() => void) | null = null;
  private removeTrackPlayerProgressListener: (() => void) | null = null;
  private lastTrackPlaybackErrorRef: string | null = null;
  private currentTrackStateRef: TrackPlayerState = TrackPlayerState.None;
  private playingSinceMsRef = 0;
  private bufferingSinceMsRef = 0;
  private lastTrackProgressAtMsRef = 0;
  private lastTrackPositionSecRef = 0;
  private audibleConfirmedRef = false;

  constructor() {
    this.player.addListener('playbackStatusUpdate', this.handlePlaybackStatus);
    AppState.addEventListener('change', this.handleAppStateChange);
    this.removeTrackPlayerStateListener = addRadioPlaybackStateListener(this.handleTrackPlayerStateChange);
    this.removeTrackPlayerErrorListener = addRadioPlaybackErrorListener(this.handleTrackPlayerError);
    this.removeTrackPlayerProgressListener = addRadioPlaybackProgressListener(this.handleTrackPlayerProgress);
    setRadioRemoteCommandHandlers({
      onPlay: () => this.handleRemotePlay(),
      onPause: () => this.handleRemotePause(),
      onStop: () => this.handleRemoteStop(),
    });
    this.pushDebug(`service:init platform=${Platform.OS} appState=${this.appStateRef}`);
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  getState(): RadioPlaybackState {
    return {
      ...this.state,
      debugLines: [...this.state.debugLines],
    };
  }

  start(matchId: string): void {
    if (!matchId) return;
    if (this.state.currentMatchId !== matchId) {
      this.state.currentMatchId = matchId;
      this.pushDebug(`match: ${matchId}`);
      if (this.state.enabled) {
        this.resetSocketAndReconnect();
      } else {
        this.emit();
      }
    }
    if (!this.state.enabled) {
      this.state.enabled = true;
      this.state.paused = false;
      this.pausedRef = false;
      this.wsShouldReconnectRef = true;
      this.wsReconnectAttemptRef = 0;
      this.pushDebug('radio: enabled');
      this.connectWebSocket();
      showRadioPlaybackNotification(matchId, 'Live radio is playing').catch(() => {});
      this.startNativeStreamPlayback(matchId).catch((e: any) => {
        this.pushDebug(`stream: start FAIL ${e?.message || e}`);
        this.switchToQueueFallback('stream start exception');
      });
      this.emit();
    } else if (this.state.paused) {
      this.resume();
    }
  }

  setMatch(matchId: string): void {
    if (!matchId || this.state.currentMatchId === matchId) return;
    this.state.currentMatchId = matchId;
    this.pushDebug(`match switched: ${matchId}`);
    if (this.state.enabled) {
      this.wsReconnectAttemptRef = 0;
      this.resetSocketAndReconnect();
      showRadioPlaybackNotification(matchId, this.pausedRef ? 'Radio paused' : 'Live radio is playing').catch(() => {});
      this.startNativeStreamPlayback(matchId).catch((e: any) => {
        this.pushDebug(`stream: rematch FAIL ${e?.message || e}`);
        this.switchToQueueFallback('stream rematch exception');
      });
    } else {
      this.emit();
    }
  }

  pause(): void {
    if (!this.state.enabled) return;
    if (this.playbackModeRef === 'stream') {
      pauseRadioStream().catch((e: any) => this.pushDebug(`track: pause FAIL ${e?.message || e}`));
      this.state.isPlaying = false;
    } else {
      this.stopPlayback({ keepEnabled: true, reason: 'pause() user action' });
    }
    this.state.paused = true;
    this.pausedRef = true;
    this.pushDebug('radio: paused');
    if (this.state.currentMatchId) {
      showRadioPlaybackNotification(this.state.currentMatchId, 'Radio paused').catch(() => {});
    }
    this.emit();
  }

  resume(): void {
    if (!this.state.enabled) return;
    this.state.paused = false;
    this.pausedRef = false;
    if (this.playbackModeRef === 'stream') {
      resumeRadioStream().catch((e: any) => this.pushDebug(`track: resume FAIL ${e?.message || e}`));
      this.state.isPlaying = true;
    } else {
      const toPlay = this.pendingAudioRef || this.lastAudioRef;
      if (toPlay) {
        this.playAudioQueue(toPlay).catch(() => {});
      }
    }
    this.pushDebug(`radio: resume requested mode=${this.playbackModeRef}`);
    if (this.state.currentMatchId) {
      showRadioPlaybackNotification(this.state.currentMatchId, 'Live radio is playing').catch(() => {});
    }
    this.emit();
  }

  jumpToLive(): void {
    if (!this.state.enabled) return;
    this.state.paused = false;
    this.pausedRef = false;
    if (this.playbackModeRef === 'stream') {
      resumeRadioStream().catch((e: any) => this.pushDebug(`track: jumpToLive resume FAIL ${e?.message || e}`));
      this.state.isPlaying = true;
    } else {
      const toPlay = this.pendingAudioRef || this.lastAudioRef;
      if (toPlay) {
        this.stopPlayback({ keepEnabled: true, reason: 'jumpToLive() replace queue' });
        this.playAudioQueue(toPlay).catch(() => {});
      }
    }
    this.state.hasPendingLive = false;
    this.pushDebug('radio: jump to live');
    this.emit();
  }

  stop(): void {
    const modeBeforeStop = this.playbackModeRef;
    this.clearStreamStartupTimer();
    this.clearStreamRecoveryTimer();
    this.stopPlayback({ keepEnabled: false, reason: 'stop() user/teardown' });
    this.pendingAudioRef = null;
    this.lastAudioRef = null;
    this.state.enabled = false;
    this.state.paused = false;
    this.state.connected = false;
    this.state.hasPendingLive = false;
    this.connectedRef = false;
    this.wsShouldReconnectRef = false;
    this.wsReconnectAttemptRef = 0;
    this.teardownSocket();
    if (modeBeforeStop === 'queue') {
      this.pushDebug(`audioActive:set false (appState=${this.appStateRef})`);
      setIsAudioActiveAsync(false)
        .then(() => this.pushDebug('audioActive:false OK'))
        .catch((e: any) => this.pushDebug(`audioActive:false FAIL ${e?.message || e}`));
    } else {
      this.pushDebug('audioActive:set false skipped for track-player stream mode');
    }
    releaseAudioSession('radio');
    this.pushDebug('radio: stopped');
    dismissRadioPlaybackNotification().catch(() => {});
    this.emit();
  }

  clearDebug(): void {
    this.state.debugLines = [];
    this.emit();
  }

  private emit(): void {
    const snapshot = this.getState();
    this.listeners.forEach(listener => listener(snapshot));
  }

  private pushDebug(message: string): void {
    const ts = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 2,
    } as any);
    const line = `[${ts}] ${message}`;
    const next = [...this.state.debugLines, line];
    this.state.debugLines = next.length > this.maxDebugLines ? next.slice(-this.maxDebugLines) : next;
    this.emit();
  }

  private getApiBase(): string {
    let apiBase = (ENV.API_BASE || '').replace(/\/$/, '');
    if (Platform.OS === 'android' && apiBase.includes('localhost')) {
      apiBase = apiBase.replace(/localhost|127\.0\.0\.1/g, '10.0.2.2');
    }
    return apiBase;
  }

  private clearStreamStartupTimer(): void {
    if (this.streamStartupTimerRef) {
      clearTimeout(this.streamStartupTimerRef);
      this.streamStartupTimerRef = null;
    }
  }

  private clearStreamRecoveryTimer(): void {
    if (this.streamRecoveryTimerRef) {
      clearTimeout(this.streamRecoveryTimerRef);
      this.streamRecoveryTimerRef = null;
    }
  }

  private async startNativeStreamPlayback(matchId: string): Promise<void> {
    const token = await getStoredSessionToken();
    if (!token) {
      this.pushDebug('stream: skipped (missing auth token)');
      return;
    }
    const apiBase = this.getApiBase();
    const manifestUrl = `${apiBase}/matches/${encodeURIComponent(matchId)}/radio/manifest.m3u8?token=${encodeURIComponent(token)}`;
    this.playbackModeRef = 'stream';
    this.clearStreamRecoveryTimer();
    this.lastTrackPlaybackErrorRef = null;
    this.currentTrackStateRef = TrackPlayerState.None;
    this.playingSinceMsRef = 0;
    this.bufferingSinceMsRef = 0;
    this.lastTrackProgressAtMsRef = Date.now();
    this.lastTrackPositionSecRef = 0;
    this.audibleConfirmedRef = false;
    this.pushDebug(`mode:stream start ${manifestUrl}`);
    this.lastPlaybackPlaying = false;
    this.state.isPlaying = false;
    this.emit();

    this.pushDebug(
      'audioSession: stream mode handled by TrackPlayer (skipping expo-audio audioMode/audioActive)'
    );

    this.clearStreamStartupTimer();
    this.streamStartupTimerRef = setTimeout(() => {
      if (this.playbackModeRef !== 'stream' || this.audibleConfirmedRef || !this.state.enabled) return;
      if (!this.lastAudioRef?.length && this.state.currentMatchId) {
        this.pushDebug('mode:stream startup waiting for first segment -> refresh stream');
        this.startNativeStreamPlayback(this.state.currentMatchId).catch(() => {});
        return;
      }
      const lastError = this.lastTrackPlaybackErrorRef ? ` lastTrackError="${this.lastTrackPlaybackErrorRef}"` : '';
      this.pushDebug(`mode:stream startup timeout -> recovery/fallback${lastError}`);
      if (this.appStateRef === 'active') {
        this.switchToQueueFallback('stream startup timeout');
      } else {
        this.scheduleStreamRecovery('stream startup timeout');
      }
    }, 15000);

    try {
      await playRadioStream({
        manifestUrl,
        matchId,
        title: 'Live Radio',
        artist: 'MyBreakPoint',
      });
      const state = await getRadioPlaybackState();
      this.currentTrackStateRef = state;
      this.lastPlaybackPlaying = state === TrackPlayerState.Playing;
      this.pushDebug(`track: play stream issued state=${state}`);
    } catch (e: any) {
      const lastError = this.lastTrackPlaybackErrorRef ? ` lastTrackError="${this.lastTrackPlaybackErrorRef}"` : '';
      this.pushDebug(`track: stream play FAIL ${e?.message || e}${lastError}`);
      throw e;
    }
  }

  private switchToQueueFallback(reason: string): void {
    if (this.playbackModeRef === 'queue') return;
    if (this.appStateRef !== 'active') {
      this.pushDebug(`mode:queue skipped in background reason="${reason}" -> stream recovery`);
      this.scheduleStreamRecovery(`queue fallback skipped (${reason})`);
      return;
    }
    this.playbackModeRef = 'queue';
    this.clearStreamStartupTimer();
    this.pushDebug(`mode:queue enabled reason="${reason}" appState=${this.appStateRef}`);
    if (this.lastAudioRef?.length) {
      this.stopPlayback({ keepEnabled: true, reason: 'queue fallback restart latest audio' });
      this.playAudioQueue(this.lastAudioRef).catch(() => {});
    }
  }

  private handleAppStateChange = (nextState: AppStateStatus) => {
    const prevState = this.appStateRef;
    this.appStateRef = nextState;
    if (!this.state.enabled) return;
    const wsReady = this.wsRef ? this.wsRef.readyState : -1;
    const sinceLastMsg = this.lastWsMessageAt ? `${Date.now() - this.lastWsMessageAt}ms` : 'n/a';
    this.pushDebug(
      `appState: ${prevState}->${nextState} wsReady=${wsReady} playing=${this.state.isPlaying} paused=${this.pausedRef} queue=${Math.max(this.queueIndexRef, 0)}/${this.queueRef.length} lastMsgAgo=${sinceLastMsg}`
    );
    if (nextState === 'active') {
      const ws = this.wsRef;
      if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
        this.pushDebug('appState:active -> reconnect websocket');
        this.connectWebSocket();
      }
      this.fetchCatchupEvents('app became active').catch(() => {});
      if (this.playbackModeRef === 'stream' && !this.pausedRef && !this.lastPlaybackPlaying && this.state.currentMatchId) {
        this.pushDebug('appState:active -> refresh stream');
        this.startNativeStreamPlayback(this.state.currentMatchId).catch(() => {});
      }
      this.streamRecoveryAttemptRef = 0;
      this.clearStreamRecoveryTimer();
      this.lastBackgroundUpdateNotificationAt = 0;
    }
  };

  private handleRemotePlay(): void {
    if (!this.state.enabled) return;
    this.pausedRef = false;
    this.state.paused = false;
    this.state.isPlaying = true;
    this.pushDebug('remote: play command received');
    this.emit();
  }

  private handleRemotePause(): void {
    if (!this.state.enabled) return;
    this.pausedRef = true;
    this.state.paused = true;
    this.state.isPlaying = false;
    this.pushDebug('remote: pause command received');
    this.emit();
  }

  private handleRemoteStop(): void {
    if (!this.state.enabled) return;
    this.pushDebug('remote: stop command received');
    this.stop();
  }

  private handleTrackPlayerStateChange = (nextState: TrackPlayerState) => {
    if (!this.state.enabled || this.playbackModeRef !== 'stream') return;

    const transportPlaying =
      nextState === TrackPlayerState.Playing ||
      nextState === TrackPlayerState.Loading ||
      nextState === TrackPlayerState.Buffering;
    const activelyAudible = nextState === TrackPlayerState.Playing;
    const now = Date.now();
    this.currentTrackStateRef = nextState;

    this.pushDebug(
      `TRACK: state=${nextState} transportPlaying=${transportPlaying} audible=${activelyAudible} appState=${this.appStateRef}`
    );

    if (transportPlaying !== this.lastPlaybackPlaying) {
      this.pushDebug(
        `TRACK: playingTransition ${this.lastPlaybackPlaying}->${transportPlaying} appState=${this.appStateRef}`
      );
      this.lastPlaybackPlaying = transportPlaying;
      this.emit();
    }

    if (activelyAudible) {
      if (this.playingSinceMsRef === 0) {
        this.playingSinceMsRef = now;
      }
      this.bufferingSinceMsRef = 0;
      const playingForMs = now - this.playingSinceMsRef;
      const hasRecentProgress = now - this.lastTrackProgressAtMsRef < STREAM_NO_PROGRESS_TIMEOUT_MS;
      if (playingForMs >= STREAM_STABLE_PLAYING_DWELL_MS && hasRecentProgress) {
        this.audibleConfirmedRef = true;
        this.state.isPlaying = true;
        this.emit();
        this.clearStreamStartupTimer();
        this.clearStreamRecoveryTimer();
        this.streamRecoveryAttemptRef = 0;
      }
      return;
    }

    this.playingSinceMsRef = 0;
    if (this.audibleConfirmedRef) {
      this.state.isPlaying = false;
      this.emit();
    }

    const isBufferingOrLoading =
      nextState === TrackPlayerState.Buffering || nextState === TrackPlayerState.Loading;
    if (isBufferingOrLoading && !this.pausedRef) {
      if (this.bufferingSinceMsRef === 0) this.bufferingSinceMsRef = now;
      const bufferingForMs = now - this.bufferingSinceMsRef;
      const stalledForMs = now - this.lastTrackProgressAtMsRef;
      if (bufferingForMs >= STREAM_PROLONGED_BUFFERING_MS || stalledForMs >= STREAM_NO_PROGRESS_TIMEOUT_MS) {
        this.pushDebug(
          `TRACK: prolonged buffering/loading (${bufferingForMs}ms, noProgress=${stalledForMs}ms) -> recovery`
        );
        this.audibleConfirmedRef = false;
        if (this.appStateRef === 'active') {
          this.switchToQueueFallback('prolonged buffering/loading');
        } else {
          this.scheduleStreamRecovery('prolonged buffering/loading');
        }
      }
      return;
    }

    this.bufferingSinceMsRef = 0;
    if (!this.pausedRef) {
      if (this.appStateRef === 'active') {
        this.pushDebug('TRACK: stream not playing in active state -> fallback queue');
        this.audibleConfirmedRef = false;
        this.switchToQueueFallback('track player stream not playing while active');
      } else {
        this.pushDebug('TRACK: stream not playing in background -> schedule recovery');
        this.audibleConfirmedRef = false;
        this.scheduleStreamRecovery('track player not playing in background');
      }
    }
  };

  private handleTrackPlayerError = (error: { code?: string; message?: string }) => {
    const parts = [error.code, error.message].filter(Boolean);
    const summary = parts.length > 0 ? parts.join(' | ') : 'unknown playback error';
    this.lastTrackPlaybackErrorRef = summary;
    this.audibleConfirmedRef = false;
    this.state.isPlaying = false;
    this.pushDebug(`TRACK: error ${summary} appState=${this.appStateRef}`);
    this.emit();
  };

  private handleTrackPlayerProgress = (progress: {
    positionSec: number;
    bufferedSec: number;
    durationSec: number;
  }) => {
    if (!this.state.enabled || this.playbackModeRef !== 'stream') return;
    const { positionSec, bufferedSec, durationSec } = progress;
    if (positionSec > this.lastTrackPositionSecRef + 0.01) {
      this.lastTrackProgressAtMsRef = Date.now();
      this.lastTrackPositionSecRef = positionSec;
      if (this.currentTrackStateRef === TrackPlayerState.Playing) {
        this.audibleConfirmedRef = true;
        this.state.isPlaying = true;
        this.emit();
      }
    }
    if (bufferedSec > 0 && this.currentTrackStateRef !== TrackPlayerState.Playing) {
      this.pushDebug(
        `TRACK: progress pos=${positionSec.toFixed(2)}s buf=${bufferedSec.toFixed(2)}s dur=${durationSec.toFixed(2)}s state=${this.currentTrackStateRef}`
      );
    }
  };

  private handlePlaybackStatus = (status: AudioStatus) => {
    if (this.playbackModeRef === 'stream') {
      return;
    }
    this.pushDebug(
      `STATUS: loaded=${status.isLoaded} playing=${status.playing} buffering=${status.isBuffering} state=${status.playbackState} tcs=${status.timeControlStatus} dur=${status.duration?.toFixed(2)} t=${status.currentTime?.toFixed(2)} finish=${status.didJustFinish}`
    );
    if (typeof status.playing === 'boolean' && status.playing !== this.lastPlaybackPlaying) {
      this.pushDebug(
        `STATUS: playingTransition ${this.lastPlaybackPlaying}->${status.playing} mode=${this.playbackModeRef} appState=${this.appStateRef} queue=${Math.max(this.queueIndexRef, 0)}/${this.queueRef.length}`
      );
      if (status.playing) {
        this.clearStreamStartupTimer();
        this.clearStreamRecoveryTimer();
        this.streamRecoveryAttemptRef = 0;
      }
      if (!status.playing && (this.appStateRef === 'background' || this.appStateRef === 'inactive')) {
        this.pushDebug(
          `STATUS: background-stop detected playbackState=${status.playbackState} tcs=${status.timeControlStatus}`
        );
      }
      this.lastPlaybackPlaying = status.playing;
    }
    if (status.playbackState && status.playbackState !== this.lastPlaybackState) {
      this.pushDebug(`STATUS: playbackStateTransition ${this.lastPlaybackState || 'none'}->${status.playbackState}`);
      this.lastPlaybackState = String(status.playbackState);
    }

    if (status.didJustFinish && this.playingQueueRef) {
      this.pushDebug('didJustFinish -> advanceQueue');
      this.advanceQueue().catch(() => {});
      return;
    }

    if (this.pendingPlayRef && status.isLoaded && !status.playing) {
      this.pendingPlayRef = false;
      this.pushDebug('pendingPlay: isLoaded=true, playing=false -> play()');
      try {
        this.player.play();
      } catch {}
    }
  };

  private async advanceQueue(): Promise<void> {
    if (this.advancingRef) return;
    this.advancingRef = true;
    let idx = this.queueIndexRef + 1;
    this.pushDebug(`advanceQueue: next idx=${idx}, queueLen=${this.queueRef.length}`);

    while (idx < this.queueRef.length) {
      if (this.cancelQueueRef) break;
      const item = this.queueRef[idx];
      if (item.url && !item.tts) {
        const resolved = getImageUrl(item.url) || item.url;
        this.pushDebug(`advance: resolve ${item.url} -> ${resolved}`);
        try {
          const localUri = await downloadClip(resolved);
          this.pushDebug(`advance: downloaded -> ${localUri.slice(-60)}`);
          if (this.cancelQueueRef) break;
          this.queueIndexRef = idx;
          this.pendingPlayRef = true;
          this.player.replace(localUri);
          this.pushDebug('advance: replace() + play() called');
          this.player.play();
          this.advancingRef = false;
          this.flushPendingQueueReplacement('advanceQueue resumed playback');
          return;
        } catch (e: any) {
          this.pushDebug(`advance: DOWNLOAD FAIL: ${e?.message || e}`);
          idx++;
          continue;
        }
      }
      idx++;
    }

    this.pushDebug('advanceQueue: queue exhausted');
    this.advancingRef = false;
    this.playingQueueRef = false;
    this.queueRef = [];
    this.queueIndexRef = -1;
    if (!this.cancelQueueRef) {
      this.state.isPlaying = false;
      this.state.lastCommentary = null;
      this.emit();
    }
    this.flushPendingQueueReplacement('advanceQueue exhausted');
  }

  private stopPlayback({ keepEnabled, reason }: { keepEnabled: boolean; reason: string }): void {
    this.pushDebug(
      `stopPlayback called reason="${reason}" keepEnabled=${keepEnabled} appState=${this.appStateRef} queueLen=${this.queueRef.length}`
    );
    this.clearStreamStartupTimer();
    this.clearStreamRecoveryTimer();
    this.cancelQueueRef = true;
    this.pendingPlayRef = false;
    this.playingQueueRef = false;
    this.queueRef = [];
    this.queueIndexRef = -1;
    if (this.playbackModeRef === 'stream') {
      stopRadioStream().catch((e: any) => this.pushDebug(`track: stop FAIL ${e?.message || e}`));
    } else {
      this.player.pause();
    }
    this.state.isPlaying = false;
    if (!keepEnabled) {
      this.state.enabled = false;
    }
  }

  private async playAudioQueue(items: AudioItem[]): Promise<void> {
    this.playbackModeRef = 'queue';
    if (!claimAudioSession('radio')) {
      this.pushDebug('audioSession: claim skipped (owned by another component)');
    }
    const urlCount = items.filter(i => i.url && !i.tts).length;
    this.pushDebug(
      `playAudioQueue: ${items.length} items, ${urlCount} with URLs appState=${this.appStateRef} paused=${this.pausedRef}`
    );

    this.cancelQueueRef = false;
    this.pendingPlayRef = false;
    this.state.isPlaying = true;
    this.state.hasPendingLive = false;
    this.pendingAudioRef = null;
    this.emit();

    try {
      this.pushDebug(
        `audioMode:set caller=radioPlaybackService payload={allowsRecording:false,playsInSilentMode:true,interruptionMode:doNotMix,shouldPlayInBackground:true} appState=${this.appStateRef}`
      );
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
        interruptionMode: 'doNotMix',
        shouldPlayInBackground: true,
      });
      this.pushDebug(`audioMode: OK appState=${this.appStateRef}`);
    } catch (e: any) {
      this.pushDebug(`audioMode: FAIL ${e?.message || e}`);
    }

    try {
      this.pushDebug(`audioActive:set true (appState=${this.appStateRef})`);
      await setIsAudioActiveAsync(true);
      this.pushDebug(`audioActive: OK appState=${this.appStateRef}`);
    } catch (e: any) {
      this.pushDebug(`audioActive: FAIL ${e?.message || e}`);
    }

    const firstIdx = items.findIndex(item => item.url && !item.tts);
    if (firstIdx === -1) {
      this.pushDebug('no playable items found (all TTS or no URL)');
      this.state.isPlaying = false;
      this.state.lastCommentary = null;
      this.emit();
      return;
    }

    const resolved = getImageUrl(items[firstIdx].url!) || items[firstIdx].url!;
    this.pushDebug(`resolved[${firstIdx}]: ${items[firstIdx].url} -> ${resolved}`);

    try {
      const localUri = await downloadClip(resolved);
      this.pushDebug(`downloaded: ${localUri.slice(-80)}`);
      if (this.cancelQueueRef) {
        this.pushDebug('cancelled after download');
        return;
      }
      this.queueRef = items;
      this.queueIndexRef = firstIdx;
      this.playingQueueRef = true;
      this.pendingPlayRef = true;
      this.player.replace(localUri);
      this.pushDebug('replace() called with local URI');
      this.player.play();
      this.pushDebug('play() called immediately');
    } catch (e: any) {
      this.pushDebug(`DOWNLOAD FAIL: ${e?.message || e}`);
      this.state.isPlaying = false;
      this.state.lastCommentary = null;
      this.emit();
    }
  }

  private queueReplaceWithLatest(items: AudioItem[], reason: string): void {
    if (this.playbackModeRef !== 'queue') return;
    if (this.advancingRef) {
      this.pendingQueueReplacementRef = items;
      this.pendingQueueReplacementReasonRef = reason;
      this.pushDebug(`queue:update deferred while advancing reason="${reason}" appState=${this.appStateRef}`);
      return;
    }

    const backgroundSuffix = this.appStateRef === 'active' ? '' : ' (background/inactive)';
    this.pushDebug(`queue:update applying reason="${reason}"${backgroundSuffix}`);
    this.stopPlayback({ keepEnabled: true, reason: `queue replace latest (${reason})` });
    this.playAudioQueue(items).catch((e: any) =>
      this.pushDebug(`queue:update play FAIL reason="${reason}" err=${e?.message || e}`)
    );
  }

  private flushPendingQueueReplacement(trigger: string): void {
    if (!this.pendingQueueReplacementRef || this.advancingRef || this.playbackModeRef !== 'queue') return;
    const items = this.pendingQueueReplacementRef;
    const reason = this.pendingQueueReplacementReasonRef || 'pending queue replacement';
    this.pendingQueueReplacementRef = null;
    this.pendingQueueReplacementReasonRef = null;
    this.pushDebug(`queue:update replay trigger="${trigger}" reason="${reason}"`);
    this.queueReplaceWithLatest(items, `${reason}; replay:${trigger}`);
  }

  private scheduleStreamRecovery(reason: string): void {
    if (!this.state.enabled || this.pausedRef || this.playbackModeRef !== 'stream' || !this.state.currentMatchId) return;
    if (this.streamRecoveryTimerRef) return;
    this.streamRecoveryAttemptRef += 1;
    const exp = Math.min(this.streamRecoveryAttemptRef, 6);
    const backoff = Math.min(STREAM_RECOVERY_BASE_MS * 2 ** exp, STREAM_RECOVERY_MAX_MS);
    const jitter = Math.floor(Math.random() * 1000);
    const delayMs = backoff + jitter;
    this.pushDebug(`stream: recovery scheduled in ${delayMs}ms reason="${reason}" attempt=${this.streamRecoveryAttemptRef}`);
    this.streamRecoveryTimerRef = setTimeout(() => {
      this.streamRecoveryTimerRef = null;
      if (!this.state.enabled || this.pausedRef || this.playbackModeRef !== 'stream' || !this.state.currentMatchId) return;
      this.pushDebug(`stream: recovery firing reason="${reason}"`);
      this.startNativeStreamPlayback(this.state.currentMatchId).catch((e: any) => {
        this.pushDebug(`stream: recovery FAIL ${e?.message || e}`);
        this.scheduleStreamRecovery('recovery exception');
      });
    }, delayMs);
  }

  private clearWsHeartbeat(): void {
    if (this.wsHeartbeatIntervalRef) {
      clearInterval(this.wsHeartbeatIntervalRef);
      this.wsHeartbeatIntervalRef = null;
    }
    if (this.wsPongTimeoutRef) {
      clearTimeout(this.wsPongTimeoutRef);
      this.wsPongTimeoutRef = null;
    }
  }

  private startWsHeartbeat(ws: WebSocket): void {
    this.clearWsHeartbeat();
    this.wsHeartbeatIntervalRef = setInterval(() => {
      if (!this.state.enabled || ws.readyState !== WebSocket.OPEN) return;
      try {
        ws.send(JSON.stringify({ type: 'ping', ts: Date.now() }));
        if (this.wsPongTimeoutRef) clearTimeout(this.wsPongTimeoutRef);
        this.wsPongTimeoutRef = setTimeout(() => {
          if (this.wsRef === ws && ws.readyState === WebSocket.OPEN) {
            this.pushDebug('ws: heartbeat timeout -> closing socket for reconnect');
            try {
              ws.close(4000, 'heartbeat timeout');
            } catch {}
          }
        }, WS_PONG_TIMEOUT_MS);
      } catch (e: any) {
        this.pushDebug(`ws: heartbeat send FAIL ${e?.message || e}`);
      }
    }, WS_HEARTBEAT_INTERVAL_MS);
  }

  private scheduleWsReconnect(reason: string): void {
    if (!this.state.enabled || !this.wsShouldReconnectRef || this.reconnectTimeoutRef) return;
    this.wsReconnectAttemptRef += 1;
    const exp = Math.min(this.wsReconnectAttemptRef, 6);
    const base = Math.min(WS_RECONNECT_BASE_MS * 2 ** exp, WS_RECONNECT_MAX_MS);
    const jitter = Math.floor(Math.random() * 1000);
    const delayMs = base + jitter;
    this.pushDebug(`ws: reconnect scheduled in ${delayMs}ms reason="${reason}" attempt=${this.wsReconnectAttemptRef}`);
    this.reconnectTimeoutRef = setTimeout(() => {
      this.reconnectTimeoutRef = null;
      if (this.state.enabled && !this.wsRef && this.wsShouldReconnectRef) {
        this.pushDebug('ws: reconnect firing');
        this.connectWebSocket();
      }
    }, delayMs);
  }

  private async fetchCatchupEvents(reason: string): Promise<void> {
    if (!this.state.enabled || !this.state.currentMatchId || this.catchupInFlightRef) return;
    this.catchupInFlightRef = true;
    try {
      const token = await getStoredSessionToken();
      if (!token) return;
      const apiBase = this.getApiBase();
      const sinceSeq = this.lastSeenRadioSeqRef;
      const url =
        `${apiBase}/matches/${encodeURIComponent(this.state.currentMatchId)}/radio/events` +
        `?token=${encodeURIComponent(token)}&sinceSeq=${sinceSeq}`;
      const response = await fetch(url, { method: 'GET' });
      if (!response.ok) {
        this.pushDebug(`catchup: fail status=${response.status} reason="${reason}"`);
        return;
      }
      const data = (await response.json()) as RadioCatchupResponse;
      const events = Array.isArray(data?.events) ? data.events : [];
      if (events.length > 0) {
        this.pushDebug(`catchup: ${events.length} event(s) reason="${reason}"`);
      }
      for (const event of events) {
        this.applySocketMessage(event, 'catchup');
      }
      if (typeof data?.latestSeq === 'number') {
        this.lastSeenRadioSeqRef = Math.max(this.lastSeenRadioSeqRef, data.latestSeq);
      }
    } catch (e: any) {
      this.pushDebug(`catchup: exception ${e?.message || e}`);
    } finally {
      this.catchupInFlightRef = false;
    }
  }

  private applySocketMessage(msg: RadioSocketMessage, source: 'ws' | 'catchup'): void {
    if (msg?.type === 'pong') {
      if (this.wsPongTimeoutRef) {
        clearTimeout(this.wsPongTimeoutRef);
        this.wsPongTimeoutRef = null;
      }
      return;
    }
    if (msg?.type === 'connected') {
      this.pushDebug(`${source}: connected msg received appState=${this.appStateRef}`);
      this.connectedRef = true;
      this.state.connected = true;
      this.emit();
      return;
    }
    if (msg?.type !== 'radio' || !Array.isArray(msg.audio)) return;

    const seq = typeof msg.seq === 'number' ? msg.seq : undefined;
    if (typeof seq === 'number') {
      if (seq <= this.lastSeenRadioSeqRef) return;
      this.lastSeenRadioSeqRef = seq;
    }

    const urlItems = msg.audio.filter(a => a.url && !a.tts);
    this.pushDebug(
      `${source}: radio msg, ${msg.audio.length} items, ${urlItems.length} playable, paused=${this.pausedRef} mode=${this.playbackModeRef} appState=${this.appStateRef}${typeof seq === 'number' ? ` seq=${seq}` : ''}`
    );
    if (msg.text) {
      this.state.lastCommentary = msg.text;
      this.state.commentaryVersion += 1;
      this.emit();
      if (this.playbackModeRef === 'stream') {
        updateRadioNowPlaying(msg.text).catch(() => {});
      }
      if (this.state.currentMatchId && this.state.enabled) {
        showRadioPlaybackNotification(
          this.state.currentMatchId,
          this.pausedRef ? 'Radio paused' : msg.text.slice(0, 80)
        ).catch(() => {});
      }
      if (this.appStateRef !== 'active' && this.state.currentMatchId) {
        const now = Date.now();
        if (now - this.lastBackgroundUpdateNotificationAt > 90000) {
          this.lastBackgroundUpdateNotificationAt = now;
          showRadioUpdateNotification(this.state.currentMatchId, msg.text.slice(0, 120)).catch(() => {});
        }
      }
    }
    this.lastAudioRef = msg.audio;
    if (this.pausedRef) {
      this.pendingAudioRef = msg.audio;
      this.state.hasPendingLive = true;
      this.emit();
    } else if (this.playbackModeRef === 'queue') {
      this.queueReplaceWithLatest(msg.audio, `${source}:radio latest commentary`);
    } else {
      this.state.hasPendingLive = false;
      this.emit();
    }
  }

  private teardownSocket(): void {
    if (this.reconnectTimeoutRef) {
      clearTimeout(this.reconnectTimeoutRef);
      this.reconnectTimeoutRef = null;
    }
    this.clearWsHeartbeat();
    if (this.wsRef) {
      try {
        this.pushDebug(`ws: teardown close readyState=${this.wsRef.readyState}`);
        this.wsRef.close();
      } catch {}
      this.wsRef = null;
    }
  }

  private resetSocketAndReconnect(): void {
    this.pushDebug('ws: resetSocketAndReconnect');
    this.wsShouldReconnectRef = true;
    this.teardownSocket();
    this.connectedRef = false;
    this.state.connected = false;
    this.emit();
    this.connectWebSocket();
  }

  private connectWebSocket(): void {
    if (!this.state.enabled || !this.state.currentMatchId) return;
    this.wsShouldReconnectRef = true;
    if (this.wsRef && (this.wsRef.readyState === WebSocket.OPEN || this.wsRef.readyState === WebSocket.CONNECTING)) {
      this.pushDebug(`ws: connect skipped readyState=${this.wsRef.readyState}`);
      return;
    }

    (async () => {
      try {
        const token = await getStoredSessionToken();
        if (!token) return;
        let apiBase = ENV.API_BASE || '';

        if (Platform.OS === 'android' && apiBase.includes('localhost')) {
          apiBase = apiBase.replace(/localhost|127\.0\.0\.1/g, '10.0.2.2');
        }

        const host = apiBase.replace(/^https?:\/\//, '').replace(/\/$/, '');
        const proto = apiBase.startsWith('https:') ? 'wss' : 'ws';
        const url = `${proto}://${host}/ws/matches/${this.state.currentMatchId}/radio?token=${encodeURIComponent(token)}`;

        this.lastWsConnectStartedAt = Date.now();
        this.pushDebug(`ws: connect appState=${this.appStateRef} -> ${url}`);
        const ws = new WebSocket(url);
        this.wsRef = ws;
        this.connectedRef = false;

        const checkConnection = setInterval(() => {
          const readyState = ws.readyState;
          if (readyState === WebSocket.OPEN && !this.connectedRef) {
            this.connectedRef = true;
            this.state.connected = true;
            this.emit();
            clearInterval(checkConnection);
          } else if (readyState === WebSocket.CLOSED || readyState === WebSocket.CLOSING) {
            clearInterval(checkConnection);
          }
        }, 500);

        ws.onopen = () => {
          clearInterval(checkConnection);
          this.connectedRef = true;
          this.state.connected = true;
          this.wsReconnectAttemptRef = 0;
          this.startWsHeartbeat(ws);
          const tookMs = Date.now() - this.lastWsConnectStartedAt;
          this.pushDebug(`ws: open (${tookMs}ms) appState=${this.appStateRef}`);
          this.emit();
          this.fetchCatchupEvents('ws open').catch(() => {});
        };

        ws.onclose = (event) => {
          clearInterval(checkConnection);
          this.clearWsHeartbeat();
          this.connectedRef = false;
          this.state.connected = false;
          this.wsRef = null;
          this.pushDebug(
            `ws: close code=${event.code} reason=${event.reason || 'n/a'} clean=${event.wasClean} appState=${this.appStateRef}`
          );
          this.emit();

          if (this.state.enabled && this.wsShouldReconnectRef) {
            const reconnectableCodes = new Set([1000, 1001, 1005, 1006, 1011, 1012, 1013, 4000]);
            if (reconnectableCodes.has(event.code)) {
              this.scheduleWsReconnect(`close code=${event.code}`);
            } else {
              this.pushDebug(`ws: reconnect skipped for close code=${event.code}`);
            }
            if (this.appStateRef !== 'active' && this.state.currentMatchId) {
              showRadioUpdateNotification(this.state.currentMatchId, 'Reconnecting radio updates in background').catch(() => {});
            }
          }
        };

        ws.onerror = () => {
          clearInterval(checkConnection);
          this.pushDebug(`ws: error appState=${this.appStateRef} readyState=${ws.readyState}`);
        };

        ws.onmessage = (ev) => {
          this.lastWsMessageAt = Date.now();
          try {
            const msg = JSON.parse(ev.data as string) as RadioSocketMessage;
            this.applySocketMessage(msg, 'ws');
          } catch (err: any) {
            this.pushDebug(`ws: PARSE ERROR: ${err?.message || err}`);
          }
        };
      } catch (err: any) {
        this.pushDebug(`ws: CONNECT FAIL ${err?.message || err}`);
      }
    })().catch(() => {});
  }
}

export const radioPlaybackService = new RadioPlaybackService();

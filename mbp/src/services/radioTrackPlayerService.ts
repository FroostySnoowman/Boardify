import TrackPlayer, {
  AndroidAudioContentType,
  AppKilledPlaybackBehavior,
  Capability,
  Event,
  IOSCategory,
  IOSCategoryOptions,
  State,
  TrackType,
} from 'react-native-track-player';

type RemoteCommandHandlers = {
  onPlay?: () => void;
  onPause?: () => void;
  onStop?: () => void;
};

type PlaybackStateListener = (state: State) => void;
type PlaybackErrorListener = (error: { code?: string; message?: string }) => void;
type PlaybackProgressListener = (progress: {
  positionSec: number;
  bufferedSec: number;
  durationSec: number;
}) => void;

let setupPromise: Promise<void> | null = null;
let setupDone = false;
let remoteHandlers: RemoteCommandHandlers = {};

export function setRadioRemoteCommandHandlers(handlers: RemoteCommandHandlers): void {
  remoteHandlers = handlers;
}

export async function ensureRadioTrackPlayerSetup(): Promise<void> {
  if (setupDone) return;
  if (setupPromise) return setupPromise;

  setupPromise = (async () => {
    await TrackPlayer.setupPlayer({
      minBuffer: 5,
      maxBuffer: 30,
      backBuffer: 15,
      playBuffer: 1.5,
      iosCategory: IOSCategory.Playback,
      iosCategoryOptions: [IOSCategoryOptions.AllowAirPlay, IOSCategoryOptions.AllowBluetoothA2DP],
      androidAudioContentType: AndroidAudioContentType.Music,
      autoHandleInterruptions: true,
      autoUpdateMetadata: true,
    });

    await TrackPlayer.updateOptions({
      progressUpdateEventInterval: 2,
      capabilities: [Capability.Play, Capability.Pause, Capability.Stop],
      notificationCapabilities: [Capability.Play, Capability.Pause, Capability.Stop],
      android: {
        appKilledPlaybackBehavior: AppKilledPlaybackBehavior.ContinuePlayback,
        alwaysPauseOnInterruption: false,
      },
    });

    setupDone = true;
  })().finally(() => {
    setupPromise = null;
  });

  return setupPromise;
}

export async function playRadioStream(params: {
  manifestUrl: string;
  matchId: string;
  title?: string;
  artist?: string;
}): Promise<void> {
  await ensureRadioTrackPlayerSetup();
  const { manifestUrl, matchId, title = 'Live Radio', artist = 'MyBreakPoint' } = params;
  await TrackPlayer.reset();
  await TrackPlayer.add({
    id: `radio-${matchId}`,
    url: manifestUrl,
    type: TrackType.HLS,
    contentType: 'application/vnd.apple.mpegurl',
    title,
    artist,
    album: 'Live Match Commentary',
    isLiveStream: true,
  });
  await TrackPlayer.play();
}

export async function pauseRadioStream(): Promise<void> {
  await ensureRadioTrackPlayerSetup();
  await TrackPlayer.pause();
}

export async function resumeRadioStream(): Promise<void> {
  await ensureRadioTrackPlayerSetup();
  await TrackPlayer.play();
}

export async function stopRadioStream(): Promise<void> {
  if (!setupDone) return;
  await TrackPlayer.stop();
  await TrackPlayer.reset();
}

export async function updateRadioNowPlaying(text: string): Promise<void> {
  if (!setupDone) return;
  await TrackPlayer.updateNowPlayingMetadata({
    title: 'Live Radio',
    artist: 'MyBreakPoint',
    description: text.slice(0, 180),
    isLiveStream: true,
  });
}

export async function getRadioPlaybackState(): Promise<State> {
  if (!setupDone) return State.None;
  const playbackState = await TrackPlayer.getPlaybackState();
  return playbackState.state;
}

export function addRadioPlaybackStateListener(listener: PlaybackStateListener): () => void {
  const subscription = TrackPlayer.addEventListener(Event.PlaybackState, ({ state }) => {
    listener(state);
  });
  return () => subscription.remove();
}

export function addRadioPlaybackErrorListener(listener: PlaybackErrorListener): () => void {
  const subscription = TrackPlayer.addEventListener(Event.PlaybackError, (event: any) => {
    listener({
      code: event?.code ? String(event.code) : undefined,
      message: event?.message ? String(event.message) : undefined,
    });
  });
  return () => subscription.remove();
}

export function addRadioPlaybackProgressListener(listener: PlaybackProgressListener): () => void {
  const subscription = TrackPlayer.addEventListener(Event.PlaybackProgressUpdated, (event: any) => {
    listener({
      positionSec: typeof event?.position === 'number' ? event.position : 0,
      bufferedSec: typeof event?.buffered === 'number' ? event.buffered : 0,
      durationSec: typeof event?.duration === 'number' ? event.duration : 0,
    });
  });
  return () => subscription.remove();
}

export const radioTrackPlayerPlaybackService = async (): Promise<void> => {
  TrackPlayer.addEventListener(Event.RemotePlay, async () => {
    await TrackPlayer.play().catch(() => {});
    remoteHandlers.onPlay?.();
  });

  TrackPlayer.addEventListener(Event.RemotePause, async () => {
    await TrackPlayer.pause().catch(() => {});
    remoteHandlers.onPause?.();
  });

  TrackPlayer.addEventListener(Event.RemoteStop, async () => {
    await TrackPlayer.stop().catch(() => {});
    remoteHandlers.onStop?.();
  });

  TrackPlayer.addEventListener(Event.RemoteDuck, async ({ paused }) => {
    if (paused) {
      await TrackPlayer.pause().catch(() => {});
      remoteHandlers.onPause?.();
    }
  });
};

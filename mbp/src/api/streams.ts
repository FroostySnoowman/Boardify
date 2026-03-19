import { nativeFetch } from './http'

export interface Stream {
  uid: string
  liveInput: {
    uid: string
    rtmpUrl?: string
    streamKey?: string
    webRTCUrl?: string
    webRTCPlaybackUrl?: string
  }
  playback?: {
    hls?: string
    dash?: string
  }
  meta: {
    name?: string
    matchId?: string
    userId?: string
    [key: string]: any
  }
  status: {
    state: string
    errorReasonCode?: string
    errorReasonText?: string
  }
  readyToStream?: boolean
  thumbnail?: string
}

export interface CreateStreamRequest {
  matchId?: string
  requireSignedURLs?: boolean
  allowedOrigins?: string[]
  meta?: {
    name?: string
    [key: string]: any
  }
}

export function isStreamActive(stream: Stream | null | undefined): boolean {
  if (!stream) return false
  const state = stream.status?.state
  return state === 'live' || state === 'connected'
}

export async function createStream(data: CreateStreamRequest): Promise<{ stream: Stream }> {
  const res = await nativeFetch('/streams', {
    method: 'POST',
    data,
  })
  return res.data as { stream: Stream }
}

export async function getStream(streamUid: string): Promise<{ stream: Stream }> {
  const res = await nativeFetch(`/streams/${streamUid}`, { method: 'GET' })
  return res.data as { stream: Stream }
}

export async function getStreamByMatch(matchId: string): Promise<{ stream: Stream } | null> {
  try {
    const res = await nativeFetch(`/matches/${matchId}/stream`, { method: 'GET' });
    return res.data as { stream: Stream };
  } catch (error: any) {
    const status = error?.status ?? error?.response?.status;
    if (status === 404) {
      return null;
    }
    const errorMessage = error?.message || 'Unknown error';
    const errorDetails = error?.data || error?.response?.data || {};
    console.error(`❌ [API] getStreamByMatch error for matchId ${matchId}:`, {
      message: errorMessage,
      status,
      details: errorDetails,
    });
    throw error;
  }
}

export async function attachStreamToMatch(matchId: string, streamUid: string): Promise<{ success: boolean; stream: Stream }> {
  const res = await nativeFetch(`/matches/${matchId}/stream`, {
    method: 'POST',
    data: { streamUid },
  })
  return res.data as { success: boolean; stream: Stream }
}

export async function deleteStream(streamUid: string): Promise<{ success: boolean }> {
  const res = await nativeFetch(`/streams/${streamUid}`, {
    method: 'DELETE',
  })
  return res.data as { success: boolean }
}

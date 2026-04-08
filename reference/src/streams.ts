import type { Env } from './bindings'
import { jsonResponse } from './http'
import { getCurrentUserFromSession } from './auth'

const CLOUDFLARE_STREAMS_API = 'https://api.cloudflare.com/client/v4/accounts'

async function broadcastStreamStatusToSpectators(
  env: Env,
  matchId: number,
  streamStatus: { event: string; stream?: any }
): Promise<void> {
  try {
    const id = env.MATCH_SPECTATE.idFromName(`match:${matchId}`)
    const stub = env.MATCH_SPECTATE.get(id)
    await stub.fetch(new Request('https://internal/broadcast', {
      method: 'POST',
      body: JSON.stringify({
        type: 'stream_status',
        ...streamStatus,
      })
    }))
  } catch (err) {
    console.error(`📡 Failed to broadcast stream status to spectators:`, err)
  }
}

interface StreamInput {
  matchId?: string
  requireSignedURLs?: boolean
  allowedOrigins?: string[]
  watermark?: {
    uid: string
  }
  meta?: {
    name?: string
    [key: string]: any
  }
}

async function createStream(request: Request, env: Env): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_STREAMS_API_TOKEN) {
    return jsonResponse(request, { error: 'Streams not configured' }, { status: 503 })
  }

  let data: StreamInput = {}
  try {
    data = await request.json()
  } catch {
    data = {}
  }

  const matchId = data.matchId
  const requireSignedURLs = data.requireSignedURLs ?? false
  const allowedOrigins = data.allowedOrigins || ['*']
  const meta = {
    name: data.meta?.name || `Match ${matchId || 'Stream'}`,
    matchId: matchId || null,
    userId: user.id,
    ...data.meta,
  }

  const liveInputPayload: any = {
    meta: {
      name: meta.name || `Match ${matchId || 'Stream'}`,
    },
  }

  if (requireSignedURLs !== undefined || (allowedOrigins && allowedOrigins.length > 0 && !allowedOrigins.includes('*'))) {
    liveInputPayload.recording = {
      mode: 'automatic',
      requireSignedURLs: requireSignedURLs || false,
      timeoutSeconds: 0,
      hideLiveViewerCount: false,
    }

    if (allowedOrigins && allowedOrigins.length > 0 && !allowedOrigins.includes('*')) {
      liveInputPayload.recording.allowedOrigins = allowedOrigins
    }
  }

  try {
    const requestBody = JSON.stringify(liveInputPayload)

    const liveInputResponse = await fetch(
      `${CLOUDFLARE_STREAMS_API}/${env.CLOUDFLARE_ACCOUNT_ID}/stream/live_inputs`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.CLOUDFLARE_STREAMS_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: requestBody,
      }
    )

    if (!liveInputResponse.ok) {
      const errorText = await liveInputResponse.text()
      let errorDetails: any
      try {
        errorDetails = JSON.parse(errorText)
      } catch {
        errorDetails = { message: errorText }
      }
      console.error('Failed to create live input:', {
        status: liveInputResponse.status,
        statusText: liveInputResponse.statusText,
        error: errorDetails,
        requestPayload: liveInputPayload,
      })
      return jsonResponse(
        request,
        { error: 'Failed to create stream input', details: errorDetails },
        { status: liveInputResponse.status || 500 }
      )
    }

    const liveInputResult: any = await liveInputResponse.json()

    if (!liveInputResult.success || !liveInputResult.result) {
      console.error('Invalid live input response:', liveInputResult)
      return jsonResponse(
        request,
        { error: 'Invalid live input response', details: liveInputResult },
        { status: 500 }
      )
    }

    const liveInput = liveInputResult.result
    const liveInputUid = liveInput.uid

    if (!liveInputUid) {
      return jsonResponse(request, { error: 'Invalid live input response: missing uid' }, { status: 500 })
    }

    if (matchId) {
      try {
        await env.DB.prepare(
          `INSERT INTO match_streams (match_id, stream_uid, live_input_uid, rtmp_url, stream_key, webrtc_url, webrtc_playback_url, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT (match_id) DO UPDATE SET
             stream_uid = excluded.stream_uid,
             live_input_uid = excluded.live_input_uid,
             rtmp_url = excluded.rtmp_url,
             stream_key = excluded.stream_key,
             webrtc_url = excluded.webrtc_url,
             webrtc_playback_url = excluded.webrtc_playback_url,
             updated_at = CURRENT_TIMESTAMP`
        )
          .bind(
            Number(matchId),
            liveInputUid,
            liveInputUid,
            liveInput.rtmps?.url || '',
            liveInput.rtmps?.streamKey || '',
            liveInput.webRTC?.url || '',
            liveInput.webRTCPlayback?.url || ''
          )
          .run()
      } catch (dbError) {
        console.error('Failed to store stream in database:', dbError)
      }
    }

    let hlsUrl: string | undefined = undefined
    const webRTCPlaybackUrl = liveInput.webRTCPlayback?.url
    if (webRTCPlaybackUrl && liveInputUid) {
      try {
        const urlMatch = webRTCPlaybackUrl.match(/https:\/\/(customer-[^\/]+)\.cloudflarestream\.com\//)
        if (urlMatch && urlMatch[1]) {
          const customerCode = urlMatch[1]
          hlsUrl = `https://${customerCode}.cloudflarestream.com/${liveInputUid}/manifest/video.m3u8`
        }
      } catch (e) {
        console.error(`[API] ❌ Error constructing HLS URL in createStream:`, e)
      }
    }

    const streamResponse = {
      uid: liveInputUid,
      liveInput: {
        uid: liveInputUid,
        rtmpUrl: liveInput.rtmps?.url,
        streamKey: liveInput.rtmps?.streamKey,
        webRTCUrl: liveInput.webRTC?.url,
        webRTCPlaybackUrl: webRTCPlaybackUrl,
      },
      playback: hlsUrl ? {
        hls: hlsUrl,
      } : undefined,
      meta: liveInput.meta || meta,
      status: {
        state: liveInput.status || 'disconnected',
      },
    }

    if (matchId) {
      await broadcastStreamStatusToSpectators(env, Number(matchId), {
        event: 'stream_created',
        stream: streamResponse,
      })
    }

    return jsonResponse(request, { stream: streamResponse })
  } catch (error: any) {
    console.error('Stream creation error:', error)
    return jsonResponse(
      request,
      { error: 'Failed to create stream', details: error.message },
      { status: 500 }
    )
  }
}

async function getStream(request: Request, env: Env, streamUid: string): Promise<Response> {
  if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_STREAMS_API_TOKEN) {
    return jsonResponse(request, { error: 'Streams not configured' }, { status: 503 })
  }

  try {
    const url = `${CLOUDFLARE_STREAMS_API}/${env.CLOUDFLARE_ACCOUNT_ID}/stream/${streamUid}`
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${env.CLOUDFLARE_STREAMS_API_TOKEN}`,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      return jsonResponse(request, { error: 'Stream not found' }, { status: 404 })
    }

    const result: any = await response.json()
    const stream = result.result

    return jsonResponse(request, {
      stream: {
        ...stream,
        thumbnail: stream.thumbnail || null,
        playback: stream.playback || null,
      }
    })
  } catch (error: any) {
    return jsonResponse(
      request,
      { error: 'Failed to fetch stream', details: error.message },
      { status: 500 }
    )
  }
}

async function getStreamByMatch(request: Request, env: Env, matchId: string): Promise<Response> {
  try {
    if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_STREAMS_API_TOKEN) {
      return jsonResponse(request, { error: 'Streams not configured' }, { status: 503 })
    }

    let record = await env.DB.prepare(
      'SELECT match_id, stream_uid, live_input_uid, rtmp_url, stream_key, webrtc_url, webrtc_playback_url FROM match_streams WHERE match_id = ?'
    )
      .bind(Number(matchId))
      .first<{
        match_id: number
        stream_uid: string
        live_input_uid: string
        rtmp_url: string
        stream_key: string
        webrtc_url: string | null
        webrtc_playback_url: string | null
      }>()

    if (!record) {
      try {
        const allRecords = await env.DB.prepare(
          'SELECT match_id, stream_uid, live_input_uid, rtmp_url, stream_key, webrtc_url, webrtc_playback_url FROM match_streams ORDER BY updated_at DESC LIMIT 20'
        )
          .all<{
            match_id: number
            stream_uid: string
            live_input_uid: string
            rtmp_url: string
            stream_key: string
            webrtc_url: string | null
            webrtc_playback_url: string | null
          }>()

        for (const rec of (allRecords.results || [])) {
          if (rec.live_input_uid) {
            try {
              const testLiveInputResponse = await fetch(
                `${CLOUDFLARE_STREAMS_API}/${env.CLOUDFLARE_ACCOUNT_ID}/stream/live_inputs/${rec.live_input_uid}`,
                {
                  headers: {
                    'Authorization': `Bearer ${env.CLOUDFLARE_STREAMS_API_TOKEN}`,
                  },
                }
              )

              if (testLiveInputResponse.ok) {
                const testLiveInputResult: any = await testLiveInputResponse.json()
                const testLiveInput = testLiveInputResult.result
                if (testLiveInput?.stream) {
                  const testStreamUid = testLiveInput.stream
                  const testStreamResponse = await getStream(request, env, testStreamUid)
                  if (testStreamResponse.ok) {
                    const testStreamData: any = await testStreamResponse.json()
                    const streamMatchId = testStreamData.stream?.meta?.matchId
                    if (streamMatchId && (String(streamMatchId) === String(matchId))) {
                      try {
                        await env.DB.prepare(
                          'UPDATE match_streams SET match_id = ?, stream_uid = ?, updated_at = CURRENT_TIMESTAMP WHERE live_input_uid = ?'
                        )
                          .bind(Number(matchId), testStreamUid, rec.live_input_uid)
                          .run()
                      } catch (e) {
                        try {
                          await env.DB.prepare(
                            `INSERT INTO match_streams (match_id, stream_uid, live_input_uid, rtmp_url, stream_key, webrtc_url, webrtc_playback_url, created_at)
                             VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                             ON CONFLICT (match_id) DO UPDATE SET stream_uid = excluded.stream_uid, updated_at = CURRENT_TIMESTAMP`
                          )
                            .bind(
                              Number(matchId),
                              testStreamUid,
                              rec.live_input_uid,
                              rec.rtmp_url,
                              rec.stream_key,
                              rec.webrtc_url,
                              rec.webrtc_playback_url
                            )
                            .run()
                        } catch (e2) {
                          console.error(`[API] Failed to update/insert database:`, e2)
                        }
                      }
                      record = { ...rec, match_id: Number(matchId), stream_uid: testStreamUid }
                      break
                    }
                  }
                }
              }
            } catch (e) {
              // continue searching
            }
          }
        }
      } catch (e) {
        console.error(`[API] Error searching all records:`, e)
      }
    }

    let recordExists = !!record
    let liveInputUid = record?.live_input_uid || null
    let storedStreamUid = record?.stream_uid || null

    let streamData: any = null
    let actualStreamUid: string | null = null

    if (storedStreamUid && storedStreamUid !== liveInputUid) {
      const streamResponse = await getStream(request, env, storedStreamUid)
      if (streamResponse.ok) {
        const data: any = await streamResponse.json()
        streamData = data
        actualStreamUid = storedStreamUid
      }
    }

    if (!streamData && liveInputUid) {
      try {
        const liveInputResponse = await fetch(
          `${CLOUDFLARE_STREAMS_API}/${env.CLOUDFLARE_ACCOUNT_ID}/stream/live_inputs/${liveInputUid}`,
          {
            headers: {
              'Authorization': `Bearer ${env.CLOUDFLARE_STREAMS_API_TOKEN}`,
            },
          }
        )

        if (liveInputResponse.ok) {
          const liveInputResult: any = await liveInputResponse.json()
          const liveInput = liveInputResult.result

          const streamUidFromLiveInput = liveInput?.stream
          const liveInputState = liveInput?.status?.current?.state
          const isLiveInputConnected = liveInputState === 'connected' || liveInputState === 'ready'

          if (streamUidFromLiveInput && typeof streamUidFromLiveInput === 'string') {
            actualStreamUid = streamUidFromLiveInput
            const streamResponse = await getStream(request, env, streamUidFromLiveInput)
            if (streamResponse.ok) {
              streamData = await streamResponse.json()

              try {
                if (recordExists) {
                  await env.DB.prepare(
                    'UPDATE match_streams SET stream_uid = ?, updated_at = CURRENT_TIMESTAMP WHERE match_id = ?'
                  )
                    .bind(actualStreamUid, Number(matchId))
                    .run()
                } else {
                  if (actualStreamUid) {
                    await env.DB.prepare(
                      `INSERT INTO match_streams (match_id, stream_uid, live_input_uid, rtmp_url, stream_key, webrtc_url, webrtc_playback_url, created_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
                    )
                      .bind(
                        Number(matchId),
                        actualStreamUid,
                        liveInputUid || liveInput.uid || '',
                        record?.rtmp_url || liveInput.rtmps?.url || '',
                        record?.stream_key || liveInput.rtmps?.streamKey || '',
                        record?.webrtc_url || liveInput.webRTC?.url || null,
                        record?.webrtc_playback_url || liveInput.webRTCPlayback?.url || null
                      )
                      .run()
                  }
                }
              } catch (dbError) {
                console.error(`[API] Failed to update database for matchId ${matchId}:`, dbError)
              }
            }
          } else if (isLiveInputConnected && recordExists) {
            try {
              const listUrl = `${CLOUDFLARE_STREAMS_API}/${env.CLOUDFLARE_ACCOUNT_ID}/stream?limit=50`
              const listResponse = await fetch(listUrl, {
                headers: {
                  'Authorization': `Bearer ${env.CLOUDFLARE_STREAMS_API_TOKEN}`,
                },
              })

              if (listResponse.ok) {
                const listResult: any = await listResponse.json()

                const matchingStream = listResult.result?.find((s: any) =>
                  s.liveInput?.uid === liveInputUid ||
                  (s.meta?.matchId && String(s.meta.matchId) === String(matchId))
                )

                if (matchingStream && matchingStream.uid) {
                  const actualStreamResponse = await getStream(request, env, matchingStream.uid)
                  if (actualStreamResponse.ok) {
                    streamData = await actualStreamResponse.json()
                    actualStreamUid = matchingStream.uid
                  }
                }
              }
            } catch (listErr: any) {
              console.error(`[API] ❌ [FIRST CHECK] Error listing streams to find actual stream:`, {
                message: listErr?.message,
                stack: listErr?.stack,
                error: listErr,
              })
            }

            if (!streamData) {
              try {
                const uidAsStreamResponse = await getStream(request, env, liveInputUid)
                if (uidAsStreamResponse.ok) {
                  const uidAsStreamData: any = await uidAsStreamResponse.json()
                  if (uidAsStreamData.stream) {
                    streamData = uidAsStreamData
                    actualStreamUid = liveInputUid
                  }
                }
              } catch {
              }
            }

            if (!streamData) {
              actualStreamUid = liveInputUid

              let hlsUrl: string | null = null
              const webRTCPlaybackUrl = liveInput?.webRTCPlayback?.url || record?.webrtc_playback_url || null

              if (webRTCPlaybackUrl && liveInputUid) {
                try {
                  const urlMatch = webRTCPlaybackUrl.match(/https:\/\/(customer-[^\/]+)\.cloudflarestream\.com\//)

                  if (urlMatch && urlMatch[1]) {
                    const customerCode = urlMatch[1]
                    hlsUrl = `https://${customerCode}.cloudflarestream.com/${liveInputUid}/manifest/video.m3u8`
                  }
                } catch (e: any) {
                  console.error(`[API] ❌ Error constructing HLS URL:`, {
                    message: e?.message,
                    error: e,
                  })
                }
              }

              streamData = {
                stream: {
                  uid: liveInputUid,
                  status: {
                    state: 'live',
                  },
                  liveInput: {
                    uid: liveInputUid,
                    rtmpUrl: record?.rtmp_url || liveInput?.rtmps?.url || '',
                    streamKey: record?.stream_key || liveInput?.rtmps?.streamKey || '',
                    webRTCUrl: record?.webrtc_url || liveInput?.webRTC?.url || null,
                    webRTCPlaybackUrl: webRTCPlaybackUrl,
                  },
                  playback: {
                    hls: hlsUrl,
                    dash: null,
                  },
                  meta: {
                    matchId: matchId,
                    name: `Match ${matchId} Stream`,
                  },
                },
              }
            }
          }
        }
      } catch (liveInputError) {
        console.error(`[API] Error fetching live input for matchId ${matchId}:`, liveInputError)
      }
    }

    if (actualStreamUid && streamData && !streamData.stream?.playback?.hls) {
      try {
        const actualStreamResponse = await getStream(request, env, actualStreamUid)
        if (actualStreamResponse.ok) {
          const actualStreamData: any = await actualStreamResponse.json()
          if (actualStreamData.stream?.playback?.hls) {
            streamData.stream.playback = {
              ...streamData.stream.playback,
              hls: actualStreamData.stream.playback.hls,
              dash: actualStreamData.stream.playback.dash || streamData.stream.playback?.dash || null,
            }
          }
        }
      } catch (fetchErr: any) {
        console.error(`[API] ❌ HLS CHECK: Error fetching actual stream ${actualStreamUid}:`, {
          message: fetchErr?.message,
          stack: fetchErr?.stack,
          error: fetchErr,
        })
      }
    }

    if (!streamData) {
      if (!recordExists && !liveInputUid) {
        try {
          const allStreamRecords = await env.DB.prepare(
            'SELECT match_id, stream_uid, live_input_uid FROM match_streams ORDER BY updated_at DESC LIMIT 10'
          )
            .all<{ match_id: number; stream_uid: string; live_input_uid: string }>()

          for (const rec of (allStreamRecords.results || [])) {
            if (rec.live_input_uid) {
              try {
                const testLiveInputResponse = await fetch(
                  `${CLOUDFLARE_STREAMS_API}/${env.CLOUDFLARE_ACCOUNT_ID}/stream/live_inputs/${rec.live_input_uid}`,
                  {
                    headers: {
                      'Authorization': `Bearer ${env.CLOUDFLARE_STREAMS_API_TOKEN}`,
                    },
                  }
                )

                if (testLiveInputResponse.ok) {
                  const testLiveInputResult: any = await testLiveInputResponse.json()
                  const testLiveInput = testLiveInputResult.result
                  if (testLiveInput?.stream) {
                    const testStreamUid = testLiveInput.stream
                    const testStreamResponse = await getStream(request, env, testStreamUid)
                    if (testStreamResponse.ok) {
                      const testStreamData: any = await testStreamResponse.json()
                      if (testStreamData.stream?.meta?.matchId === matchId ||
                        String(testStreamData.stream?.meta?.matchId) === String(matchId)) {
                        streamData = testStreamData
                        actualStreamUid = testStreamUid
                        liveInputUid = rec.live_input_uid
                        recordExists = true
                        break
                      }
                    }
                  }
                }
              } catch (e) {
                // continue searching
              }
            }
          }
        } catch (e) {
          console.error(`[API] Error searching database for streams:`, e)
        }
      }

      if (!streamData) {
        try {
          const listResponse = await fetch(
            `${CLOUDFLARE_STREAMS_API}/${env.CLOUDFLARE_ACCOUNT_ID}/stream?limit=100`,
            {
              headers: {
                'Authorization': `Bearer ${env.CLOUDFLARE_STREAMS_API_TOKEN}`,
              },
            }
          )

          if (listResponse.ok) {
            const listResult: any = await listResponse.json()
            if (listResult.result && Array.isArray(listResult.result)) {
              const matchingStream = listResult.result.find((s: any) => {
                const matchesLiveInput = liveInputUid && s.liveInput?.uid === liveInputUid
                const matchesMatchId = s.meta?.matchId === matchId || String(s.meta?.matchId) === String(matchId)
                return matchesLiveInput || matchesMatchId
              })

              if (matchingStream) {
                const matchingStreamUid = matchingStream.uid
                if (matchingStreamUid && typeof matchingStreamUid === 'string') {
                  actualStreamUid = matchingStreamUid
                  const streamResponse = await getStream(request, env, matchingStreamUid)
                  if (streamResponse.ok) {
                    streamData = await streamResponse.json()

                    try {
                      const streamLiveInput = streamData.stream.liveInput
                      if (recordExists) {
                        await env.DB.prepare(
                          'UPDATE match_streams SET stream_uid = ?, live_input_uid = COALESCE(?, live_input_uid), updated_at = CURRENT_TIMESTAMP WHERE match_id = ?'
                        )
                          .bind(matchingStreamUid, streamLiveInput?.uid || liveInputUid, Number(matchId))
                          .run()
                      } else {
                        await env.DB.prepare(
                          `INSERT INTO match_streams (match_id, stream_uid, live_input_uid, rtmp_url, stream_key, webrtc_url, webrtc_playback_url, created_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
                        )
                          .bind(
                            Number(matchId),
                            matchingStreamUid,
                            streamLiveInput?.uid || liveInputUid || '',
                            streamLiveInput?.rtmpUrl || record?.rtmp_url || '',
                            streamLiveInput?.streamKey || record?.stream_key || '',
                            streamLiveInput?.webRTCUrl || record?.webrtc_url || null,
                            streamLiveInput?.webRTCPlaybackUrl || record?.webrtc_playback_url || null
                          )
                          .run()
                      }
                    } catch (dbError) {
                      console.error(`[API] Failed to update database for matchId ${matchId}:`, dbError)
                    }
                  }
                }
              }
            }
          }
        } catch (listError) {
          console.error(`[API] Error listing streams for matchId ${matchId}:`, listError)
        }
      }
    }

    if (!streamData) {
      let diagnosticInfo: any = {
        matchId,
        recordExists,
        hasLiveInputUid: !!liveInputUid,
        liveInputUid,
        storedStreamUid,
        streamUidEqualsLiveInputUid: storedStreamUid === liveInputUid,
        attempts: []
      }

      if (liveInputUid && !streamData) {
        try {
          const finalLiveInputResponse = await fetch(
            `${CLOUDFLARE_STREAMS_API}/${env.CLOUDFLARE_ACCOUNT_ID}/stream/live_inputs/${liveInputUid}`,
            {
              headers: {
                'Authorization': `Bearer ${env.CLOUDFLARE_STREAMS_API_TOKEN}`,
              },
            }
          )

          if (finalLiveInputResponse.ok) {
            const finalLiveInputResult: any = await finalLiveInputResponse.json()
            const finalLiveInput = finalLiveInputResult.result
            diagnosticInfo.liveInputStatus = {
              uid: finalLiveInput?.uid,
              hasStream: !!finalLiveInput?.stream,
              streamUid: finalLiveInput?.stream,
              status: finalLiveInput?.status,
            }

            const liveInputState = finalLiveInput?.status?.current?.state
            const isLiveInputConnected = liveInputState === 'connected' || liveInputState === 'ready'

            if (finalLiveInput?.stream) {
              const finalStreamResponse = await getStream(request, env, finalLiveInput.stream)
              if (finalStreamResponse.ok) {
                const finalStreamData: any = await finalStreamResponse.json()
                diagnosticInfo.foundStreamButNoMatchId = {
                  streamUid: finalLiveInput.stream,
                  state: finalStreamData.stream?.status?.state,
                  meta: finalStreamData.stream?.meta,
                  hasPlayback: !!finalStreamData.stream?.playback,
                }

                if (recordExists && finalStreamData.stream?.status?.state === 'live') {
                  streamData = finalStreamData
                  actualStreamUid = finalLiveInput.stream

                  try {
                    await env.DB.prepare(
                      'UPDATE match_streams SET stream_uid = ?, updated_at = CURRENT_TIMESTAMP WHERE match_id = ?'
                    )
                      .bind(actualStreamUid, Number(matchId))
                      .run()
                  } catch (e) {
                    console.error(`[API] Failed to update database:`, e)
                  }
                }
              }
            } else if (isLiveInputConnected && recordExists) {
              let hlsUrl: string | null = null
              const webRTCPlaybackUrl = finalLiveInput?.webRTCPlayback?.url || record?.webrtc_playback_url || null
              if (webRTCPlaybackUrl && liveInputUid) {
                try {
                  const urlMatch = webRTCPlaybackUrl.match(/https:\/\/(customer-[^\/]+)\.cloudflarestream\.com\//)
                  if (urlMatch && urlMatch[1]) {
                    const customerCode = urlMatch[1]
                    hlsUrl = `https://${customerCode}.cloudflarestream.com/${liveInputUid}/manifest/video.m3u8`
                  }
                } catch (e) {
                  console.error(`[API] ❌ [LAST RESORT] Error constructing HLS URL:`, e)
                }
              }

              if (hlsUrl) {
                actualStreamUid = liveInputUid
                streamData = {
                  stream: {
                    uid: liveInputUid,
                    status: {
                      state: 'live',
                    },
                    liveInput: {
                      uid: liveInputUid,
                      rtmpUrl: record?.rtmp_url || finalLiveInput?.rtmps?.url || '',
                      streamKey: record?.stream_key || finalLiveInput?.rtmps?.streamKey || '',
                      webRTCUrl: record?.webrtc_url || finalLiveInput?.webRTC?.url || null,
                      webRTCPlaybackUrl: webRTCPlaybackUrl,
                    },
                    playback: {
                      hls: hlsUrl,
                      dash: null,
                    },
                    meta: {
                      matchId: matchId,
                      name: `Match ${matchId} Stream`,
                    },
                  },
                }
              } else {
                try {
                  const listUrl = `${CLOUDFLARE_STREAMS_API}/${env.CLOUDFLARE_ACCOUNT_ID}/stream?limit=50`
                  const listResponse = await fetch(listUrl, {
                    headers: {
                      'Authorization': `Bearer ${env.CLOUDFLARE_STREAMS_API_TOKEN}`,
                    },
                  })

                  if (listResponse.ok) {
                    const listResult: any = await listResponse.json()

                    const matchingStream = listResult.result?.find((s: any) =>
                      s.liveInput?.uid === liveInputUid ||
                      (s.meta?.matchId && String(s.meta.matchId) === String(matchId))
                    )

                    if (matchingStream && matchingStream.uid) {
                      const actualStreamResponse = await getStream(request, env, matchingStream.uid)
                      if (actualStreamResponse.ok) {
                        streamData = await actualStreamResponse.json()
                        actualStreamUid = matchingStream.uid
                      }
                    }
                  }
                } catch (listErr: any) {
                  console.error(`[API] ❌ [LAST RESORT] Error listing streams to find actual stream:`, {
                    message: listErr?.message,
                    stack: listErr?.stack,
                    error: listErr,
                  })
                }
              }

              if (!streamData) {
                actualStreamUid = liveInputUid

                streamData = {
                  stream: {
                    uid: liveInputUid,
                    status: {
                      state: 'live',
                    },
                    liveInput: {
                      uid: liveInputUid,
                      rtmpUrl: record?.rtmp_url || finalLiveInput?.rtmps?.url || '',
                      streamKey: record?.stream_key || finalLiveInput?.rtmps?.streamKey || '',
                      webRTCUrl: record?.webrtc_url || finalLiveInput?.webRTC?.url || null,
                      webRTCPlaybackUrl: record?.webrtc_playback_url || finalLiveInput?.webRTCPlayback?.url || null,
                    },
                    playback: {
                      hls: null,
                      dash: null,
                    },
                    meta: {
                      matchId: matchId,
                      name: `Match ${matchId} Stream`,
                    },
                  },
                }
              }
            }
          } else {
            diagnosticInfo.liveInputFetchFailed = {
              status: finalLiveInputResponse.status,
              statusText: finalLiveInputResponse.statusText,
            }
          }
        } catch (e) {
          diagnosticInfo.liveInputCheckError = String(e)
          console.error(`[API] Error in last resort live input check:`, e)
        }
      }

      if (!streamData && liveInputUid) {
        try {
          const otherMatchRecord = await env.DB.prepare(
            'SELECT match_id FROM match_streams WHERE live_input_uid = ? LIMIT 1'
          )
            .bind(liveInputUid)
            .first<{ match_id: number }>()

          if (otherMatchRecord) {
            diagnosticInfo.foundInOtherMatch = otherMatchRecord.match_id
          }
        } catch (e) {
          // ignore
        }
      }

      if (!streamData) {
        return jsonResponse(request, {
          error: 'Stream not found',
          details: diagnosticInfo
        }, { status: 404 })
      }
    }

    if (actualStreamUid && !streamData.stream?.playback?.hls) {
      try {
        const actualStreamResponse = await getStream(request, env, actualStreamUid)
        if (actualStreamResponse.ok) {
          const actualStreamData: any = await actualStreamResponse.json()
          if (actualStreamData.stream?.playback?.hls) {
            streamData.stream.playback = {
              ...streamData.stream.playback,
              hls: actualStreamData.stream.playback.hls,
              dash: actualStreamData.stream.playback.dash || streamData.stream.playback?.dash || null,
            }
          }
        }
      } catch (fetchErr: any) {
        console.error(`[API] ❌ FINAL HLS CHECK: Error fetching actual stream ${actualStreamUid}:`, {
          message: fetchErr?.message,
          stack: fetchErr?.stack,
          error: fetchErr,
        })
      }
    }

    const finalLiveInput = {
      uid: liveInputUid || streamData.stream.liveInput?.uid || '',
      rtmpUrl: record?.rtmp_url || streamData.stream.liveInput?.rtmpUrl || '',
      streamKey: record?.stream_key || streamData.stream.liveInput?.streamKey || '',
      webRTCUrl: record?.webrtc_url || streamData.stream.liveInput?.webRTCUrl || null,
      webRTCPlaybackUrl: record?.webrtc_playback_url || streamData.stream.liveInput?.webRTCPlaybackUrl || null,
    }

    return jsonResponse(request, {
      stream: {
        ...streamData.stream,
        liveInput: finalLiveInput,
        playback: streamData.stream.playback || null,
      },
    })
  } catch (error: any) {
    console.error('Error in getStreamByMatch:', error)
    return jsonResponse(
      request,
      { error: 'Failed to fetch stream', details: error.message },
      { status: 500 }
    )
  }
}

async function deleteStream(request: Request, env: Env, streamUid: string): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_STREAMS_API_TOKEN) {
    return jsonResponse(request, { error: 'Streams not configured' }, { status: 503 })
  }

  try {
    const streamLink = await env.DB
      .prepare('SELECT match_id FROM match_streams WHERE stream_uid = ?')
      .bind(streamUid)
      .first<{ match_id: number }>()

    if (streamLink?.match_id) {
      await broadcastStreamStatusToSpectators(env, Number(streamLink.match_id), {
        event: 'stream_ended',
        stream: {
          uid: streamUid,
          status: {
            state: 'ended',
          },
        },
      })
    }

    const [response] = await Promise.all([
      fetch(
        `${CLOUDFLARE_STREAMS_API}/${env.CLOUDFLARE_ACCOUNT_ID}/stream/${streamUid}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${env.CLOUDFLARE_STREAMS_API_TOKEN}`,
          },
        }
      ),
      env.DB.prepare('DELETE FROM match_streams WHERE stream_uid = ?')
        .bind(streamUid)
        .run()
        .catch((dbError) => {
          console.error('Failed to delete stream from database:', dbError)
        }),
    ])

    if (!response.ok) {
      return jsonResponse(request, { error: 'Failed to delete stream' }, { status: 500 })
    }

    return jsonResponse(request, { success: true })
  } catch (error: any) {
    return jsonResponse(
      request,
      { error: 'Failed to delete stream', details: error.message },
      { status: 500 }
    )
  }
}

export async function handleStreams(
  request: Request,
  env: Env,
  pathname: string
): Promise<Response | null> {
  const segments = pathname.split('/').filter(Boolean)
  const method = request.method

  if (pathname === '/streams' && method === 'POST') {
    return await createStream(request, env)
  }

  if (segments[0] === 'streams' && segments.length === 2 && method === 'GET') {
    return await getStream(request, env, segments[1])
  }

  if (segments[0] === 'streams' && segments.length === 2 && method === 'DELETE') {
    return await deleteStream(request, env, segments[1])
  }

  if (segments[0] === 'matches' && segments[2] === 'stream' && method === 'GET') {
    return await getStreamByMatch(request, env, segments[1])
  }

  if (segments[0] === 'matches' && segments[2] === 'stream' && method === 'POST') {
    const matchId = segments[1]
    let data: { streamUid?: string } | null = null
    try {
      data = await request.json() as { streamUid?: string }
    } catch {
      return jsonResponse(request, { error: 'Invalid payload' }, { status: 400 })
    }

    if (!data || !data.streamUid) {
      return jsonResponse(request, { error: 'streamUid required' }, { status: 400 })
    }

    try {
      const streamInfo = await getStream(request, env, data.streamUid)
      if (!streamInfo.ok) {
        return streamInfo
      }

      const streamData: any = await streamInfo.json()

      if (!streamData.stream) {
        return jsonResponse(request, { error: 'Stream not found' }, { status: 404 })
      }

      const liveInput = streamData.stream.liveInput
      await env.DB.prepare(
        `INSERT INTO match_streams (match_id, stream_uid, live_input_uid, rtmp_url, stream_key, created_at)
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT (match_id) DO UPDATE SET
           stream_uid = excluded.stream_uid,
           live_input_uid = excluded.live_input_uid,
           rtmp_url = excluded.rtmp_url,
           stream_key = excluded.stream_key,
           updated_at = CURRENT_TIMESTAMP`
      )
        .bind(
          Number(matchId),
          data.streamUid,
          liveInput?.uid || '',
          liveInput?.rtmpUrl || '',
          liveInput?.streamKey || ''
        )
        .run()

      return jsonResponse(request, { success: true, stream: streamData.stream })
    } catch (error: any) {
      return jsonResponse(
        request,
        { error: 'Failed to attach stream', details: error.message },
        { status: 500 }
      )
    }
  }

  return null
}

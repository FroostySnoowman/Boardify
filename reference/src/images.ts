import type { Env } from './bindings'
import { jsonResponse } from './http'
import { getCurrentUserFromSession } from './auth'

const MAX_IMAGE_SIZE = 10 * 1024 * 1024
const MAX_VIDEO_SIZE = 50 * 1024 * 1024

function generateImageKey(userId: string, type: 'profile' | 'team' | 'message'): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(7)
  return `${type}/${userId}/${timestamp}-${random}`
}

function getImageUrl(env: Env, key: string): string {
  return `/api/images/${key}`
}

function arrayBufferToBase64(data: ArrayBuffer): string {
  const bytes = new Uint8Array(data)
  let binary = ''
  const chunk = 8192
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk) as unknown as number[])
  }
  return btoa(binary)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function retryAfterMsFromResponse(res: Response): number | null {
  const ra = res.headers.get('retry-after')
  if (!ra) return null
  const sec = parseInt(ra, 10)
  if (Number.isNaN(sec)) return null
  return Math.min(sec * 1000, 60_000)
}

const OPENAI_MODERATION_MAX_ATTEMPTS = 5
const OPENAI_MODERATION_BASE_BACKOFF_MS = 500

const SEXUAL_SCORE_REJECT = 0.05
const SEXUAL_MINORS_SCORE_REJECT = 0.008
const VIOLENCE_GRAPHIC_SCORE_REJECT = 0.45

function isUnsafeModerationResult(result: {
  flagged?: boolean
  categories?: Record<string, boolean>
  category_scores?: Record<string, number>
}): boolean {
  if (result.flagged === true) return true
  const c = result.categories
  if (c) {
    if (c.sexual || c['sexual/minors']) return true
    if (c.violence || c['violence/graphic']) return true
    if (c.harassment || c['harassment/threatening'] || c.hate || c['hate/threatening']) return true
    if (c['self-harm'] || c['self-harm/intent'] || c['self-harm/instructions']) return true
    if (c.illicit || c['illicit/violent']) return true
  }
  const s = result.category_scores
  if (s) {
    const sexualScore = s.sexual ?? 0
    if (sexualScore >= SEXUAL_SCORE_REJECT) return true
    if ((s['sexual/minors'] ?? 0) >= SEXUAL_MINORS_SCORE_REJECT) return true
    if ((s['violence/graphic'] ?? 0) >= VIOLENCE_GRAPHIC_SCORE_REJECT) return true
  }
  return false
}

type MessageImageModeration =
  | 'safe'
  | 'unsafe'
  | 'verification_failed'
  | 'not_configured'
  | 'rate_limited'

async function moderateMessageImage(data: ArrayBuffer, contentType: string, env: Env): Promise<MessageImageModeration> {
  const apiKey = env.OPENAI_API_KEY?.trim()
  if (apiKey) {
    try {
      const base64 = arrayBufferToBase64(data)
      const mime = contentType?.split(';')[0]?.trim() || 'image/jpeg'
      const dataUrl = `data:${mime};base64,${base64}`
      const body = JSON.stringify({
        model: 'omni-moderation-latest',
        input: [
          {
            type: 'image_url',
            image_url: { url: dataUrl },
          },
        ],
      })

      let lastStatus = 0
      for (let attempt = 0; attempt < OPENAI_MODERATION_MAX_ATTEMPTS; attempt++) {
        const res = await fetch('https://api.openai.com/v1/moderations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body,
        })

        if (res.ok) {
          const json = (await res.json()) as {
            results?: Array<{
              flagged?: boolean
              categories?: Record<string, boolean>
              category_scores?: Record<string, number>
            }>
          }
          const result = json.results?.[0]
          if (!result) {
            console.warn('OpenAI moderation: empty results array')
            return 'verification_failed'
          }
          return isUnsafeModerationResult(result) ? 'unsafe' : 'safe'
        }

        lastStatus = res.status
        const errText = await res.text()
        console.warn(`OpenAI moderation API error (attempt ${attempt + 1}/${OPENAI_MODERATION_MAX_ATTEMPTS}):`, res.status, errText)

        const retryable = res.status === 429 || res.status === 502 || res.status === 503
        if (!retryable) {
          return 'verification_failed'
        }

        if (attempt === OPENAI_MODERATION_MAX_ATTEMPTS - 1) {
          break
        }

        const ra = retryAfterMsFromResponse(res)
        const backoff = Math.min(OPENAI_MODERATION_BASE_BACKOFF_MS * Math.pow(2, attempt), 10_000)
        await sleep(ra != null && ra > 0 ? ra : backoff)
      }

      if (lastStatus === 429) {
        return 'rate_limited'
      }
      return 'verification_failed'
    } catch (e) {
      console.warn('OpenAI moderation request failed:', e)
      return 'verification_failed'
    }
  }

  const url = env.IMAGE_MODERATION_API_URL?.trim()
  if (!url) return 'not_configured'
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': contentType || 'image/jpeg' },
      body: data,
    })
    if (!res.ok) {
      console.warn('Image moderation API error:', res.status, await res.text())
      return 'verification_failed'
    }
    const json = (await res.json()) as { safe?: boolean; flagged?: boolean }
    if (json.flagged === true || json.safe === false) return 'unsafe'
    if (json.safe === true) return 'safe'
    console.warn('Image moderation API: expected { safe: boolean } or { flagged: boolean }')
    return 'verification_failed'
  } catch (e) {
    console.warn('Image moderation request failed:', e)
    return 'verification_failed'
  }
}

async function uploadProfilePicture(request: Request, env: Env): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  if (!env.IMAGES) {
    console.error('IMAGES R2 bucket is not bound. Check wrangler.toml configuration.')
    return jsonResponse(request, { error: 'Image storage not configured' }, { status: 500 })
  }

  const contentType = request.headers.get('content-type') || ''
  
  const contentLength = request.headers.get('content-length')
  if (contentLength && parseInt(contentLength) > MAX_IMAGE_SIZE) {
    return jsonResponse(request, { error: 'File too large (max 10MB)' }, { status: 400 })
  }

  try {
    const imageData = await request.arrayBuffer()
    
    if (imageData.byteLength > MAX_IMAGE_SIZE) {
      return jsonResponse(request, { error: 'File too large (max 10MB)' }, { status: 400 })
    }

    const key = generateImageKey(user.id, 'profile')

    const [oldPicture] = await Promise.all([
      env.DB
        .prepare('SELECT profile_picture_url FROM users WHERE id = ?')
        .bind(Number(user.id))
        .first<{ profile_picture_url: string | null }>(),
      env.IMAGES.put(key, imageData, {
        httpMetadata: {
          contentType: contentType.split(';')[0],
          contentDisposition: 'inline'
        }
      })
    ])

    const imageUrl = getImageUrl(env, key)

    const updateDb = env.DB
      .prepare('UPDATE users SET profile_picture_url = ? WHERE id = ?')
      .bind(imageUrl, Number(user.id))
      .run()

    const deleteOld = (async () => {
      if (oldPicture?.profile_picture_url) {
        const oldKey = oldPicture.profile_picture_url.split('/api/images/')[1]
        if (oldKey) {
          try {
            await env.IMAGES.delete(oldKey)
          } catch (e) {
            console.error('Failed to delete old profile picture:', e)
          }
        }
      }
    })()

    await Promise.all([updateDb, deleteOld])

    return jsonResponse(request, { url: imageUrl }, { status: 200 })
  } catch (error) {
    console.error('Profile picture upload error:', error)
    return jsonResponse(request, { error: 'Upload failed' }, { status: 500 })
  }
}

async function uploadTeamImage(request: Request, env: Env, teamId: string): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const teamIdNum = parseInt(teamId)
  if (isNaN(teamIdNum)) {
    return jsonResponse(request, { error: 'Invalid team ID' }, { status: 400 })
  }

  const member = await env.DB
    .prepare('SELECT role FROM team_members WHERE team_id = ? AND user_id = ?')
    .bind(teamIdNum, Number(user.id))
    .first<{ role: string }>()

  if (!member || (member.role !== 'Owner' && member.role !== 'Coach')) {
    return jsonResponse(request, { error: 'Not authorized' }, { status: 403 })
  }

  if (!env.IMAGES) {
    console.error('IMAGES R2 bucket is not bound. Check wrangler.toml configuration.')
    return jsonResponse(request, { error: 'Image storage not configured' }, { status: 500 })
  }

  const contentType = request.headers.get('content-type') || ''
  
  const contentLength = request.headers.get('content-length')
  if (contentLength && parseInt(contentLength) > MAX_IMAGE_SIZE) {
    return jsonResponse(request, { error: 'File too large (max 10MB)' }, { status: 400 })
  }

  try {
    const imageData = await request.arrayBuffer()
    
    if (imageData.byteLength > MAX_IMAGE_SIZE) {
      return jsonResponse(request, { error: 'File too large (max 10MB)' }, { status: 400 })
    }

    const key = generateImageKey(user.id, 'team')

    const [oldImage] = await Promise.all([
      env.DB
        .prepare('SELECT image_url FROM teams WHERE id = ?')
        .bind(teamIdNum)
        .first<{ image_url: string | null }>(),
      env.IMAGES.put(key, imageData, {
        httpMetadata: {
          contentType: contentType.split(';')[0],
          contentDisposition: 'inline'
        }
      })
    ])

    const imageUrl = getImageUrl(env, key)

    const updateDb = env.DB
      .prepare('UPDATE teams SET image_url = ? WHERE id = ?')
      .bind(imageUrl, teamIdNum)
      .run()

    const deleteOld = (async () => {
      if (oldImage?.image_url) {
        const oldKey = oldImage.image_url.split('/api/images/')[1]
        if (oldKey) {
          try {
            await env.IMAGES.delete(oldKey)
          } catch (e) {
            console.error('Failed to delete old team image:', e)
          }
        }
      }
    })()

    await Promise.all([updateDb, deleteOld])

    return jsonResponse(request, { url: imageUrl }, { status: 200 })
  } catch (error) {
    console.error('Team image upload error:', error)
    return jsonResponse(request, { error: 'Upload failed' }, { status: 500 })
  }
}

async function deleteTeamImage(request: Request, env: Env, teamId: string): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const teamIdNum = parseInt(teamId)
  if (isNaN(teamIdNum)) {
    return jsonResponse(request, { error: 'Invalid team ID' }, { status: 400 })
  }

  const member = await env.DB
    .prepare('SELECT role FROM team_members WHERE team_id = ? AND user_id = ?')
    .bind(teamIdNum, Number(user.id))
    .first<{ role: string }>()

  if (!member || (member.role !== 'Owner' && member.role !== 'Coach')) {
    return jsonResponse(request, { error: 'Only team owner or coach can delete team image' }, { status: 403 })
  }

  if (!env.IMAGES) {
    console.error('IMAGES R2 bucket is not bound. Check wrangler.toml configuration.')
    return jsonResponse(request, { error: 'Image storage not configured' }, { status: 500 })
  }

  try {
    const team = await env.DB
      .prepare('SELECT image_url FROM teams WHERE id = ?')
      .bind(teamIdNum)
      .first<{ image_url: string | null }>()

    if (!team?.image_url) {
      return jsonResponse(request, { error: 'No team image to delete' }, { status: 404 })
    }

    const key = team.image_url.split('/api/images/')[1]
    if (!key) {
      return jsonResponse(request, { error: 'Invalid image key' }, { status: 400 })
    }

    await Promise.all([
      env.IMAGES.delete(key),
      env.DB
        .prepare('UPDATE teams SET image_url = NULL WHERE id = ?')
        .bind(teamIdNum)
        .run(),
    ])

    return jsonResponse(request, { success: true }, { status: 200 })
  } catch (error) {
    console.error('Team image delete error:', error)
    return jsonResponse(request, { error: 'Delete failed' }, { status: 500 })
  }
}

async function uploadMessageImages(request: Request, env: Env): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const files: File[] = []

    for (const [, value] of formData.entries()) {
      if (value instanceof File) {
        files.push(value)
      }
    }

    if (files.length === 0) {
      return jsonResponse(request, { error: 'No files provided' }, { status: 400 })
    }

    if (files.length > 5) {
      return jsonResponse(request, { error: 'Maximum 5 attachments allowed' }, { status: 400 })
    }

    const uploadedUrls: string[] = []
    const fileInfos: { file: File; data: ArrayBuffer; isVideo: boolean }[] = []

    for (const file of files) {
      const isVideo = file.type.startsWith('video/')
      const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE
      const maxSizeLabel = isVideo ? '50MB' : '10MB'

      if (file.size > maxSize) {
        return jsonResponse(
          request,
          { error: `File too large. Max size is ${maxSizeLabel} for ${isVideo ? 'videos' : 'images'}.` },
          { status: 400 }
        )
      }

      const data = await file.arrayBuffer()
      fileInfos.push({ file, data, isVideo })
    }

    const imageFiles = fileInfos.filter((fi) => !fi.isVideo)
    const hasImages = imageFiles.length > 0
    const imageVerificationEnabled =
      Boolean(env.OPENAI_API_KEY?.trim()) || Boolean(env.IMAGE_MODERATION_API_URL?.trim())

    if (hasImages && imageVerificationEnabled) {
      // Sequential calls avoid bursting OpenAI rate limits when several images are attached.
      for (const fi of imageFiles) {
        const r = await moderateMessageImage(fi.data, fi.file.type || 'image/jpeg', env)
        if (r === 'unsafe') {
          return jsonResponse(
            request,
            { error: 'Image was rejected by safety filters.' },
            { status: 400 }
          )
        }
        if (r === 'rate_limited') {
          return jsonResponse(
            request,
            {
              error:
                'Image safety check is temporarily rate-limited. Please wait a minute and try again, or check your OpenAI API usage limits.',
            },
            { status: 503 }
          )
        }
        if (r === 'verification_failed' || r === 'not_configured') {
          return jsonResponse(
            request,
            { error: 'Could not verify image safety. Try again in a moment.' },
            { status: 503 }
          )
        }
      }
    }

    for (const { file, data, isVideo: _isVideo } of fileInfos) {
      let extension = ''
      const typeParts = file.type.split('/')
      if (typeParts.length === 2) {
        extension = '.' + typeParts[1]
      }

      const key = `${generateImageKey(user.id, 'message')}${extension}`

      await env.IMAGES.put(key, data, {
        httpMetadata: {
          contentType: file.type,
          contentDisposition: 'inline'
        }
      })

      const imageUrl = getImageUrl(env, key)
      uploadedUrls.push(imageUrl)
    }

    return jsonResponse(request, { urls: uploadedUrls }, { status: 200 })
  } catch (error) {
    console.error('Message media upload error:', error)
    return jsonResponse(request, { error: 'Upload failed' }, { status: 500 })
  }
}

async function serveImage(request: Request, env: Env, key: string): Promise<Response> {
  try {
    if (!env.IMAGES) {
      console.error('IMAGES R2 bucket is not bound in serveImage')
      return new Response('Image storage not configured', { status: 500 })
    }

    const object = await env.IMAGES.get(key)

    if (!object || !object.body) {
      return new Response('Image not found', { status: 404 })
    }

    const headers = new Headers()
    object.writeHttpMetadata(headers)

    if (!headers.get('Content-Type')) {
      if (key.startsWith('voice/')) headers.set('Content-Type', 'audio/mp4')
      else if (key.endsWith('.mp4')) headers.set('Content-Type', 'video/mp4')
      else if (key.endsWith('.webm')) headers.set('Content-Type', 'video/webm')
      else if (key.endsWith('.m4a')) headers.set('Content-Type', 'audio/mp4')
      else if (key.endsWith('.mov') || key.endsWith('.qt')) headers.set('Content-Type', 'video/quicktime')
      else if (key.endsWith('.png')) headers.set('Content-Type', 'image/png')
      else if (key.endsWith('.jpg') || key.endsWith('.jpeg')) headers.set('Content-Type', 'image/jpeg')
      else if (key.endsWith('.webp')) headers.set('Content-Type', 'image/webp')
      else if (key.endsWith('.wav')) headers.set('Content-Type', 'audio/wav')
      else if (key.endsWith('.mp3')) headers.set('Content-Type', 'audio/mpeg')
      else headers.set('Content-Type', 'application/octet-stream')
    }

    if (!headers.get('Content-Disposition')) {
      headers.set('Content-Disposition', 'inline')
    }

    headers.set('Cache-Control', 'public, max-age=31536000, immutable')
    headers.set('Access-Control-Allow-Origin', '*')

    return new Response(object.body, { headers })
  } catch (error) {
    console.error('Image serve error for key:', key, error)
    return new Response('Error serving image', { status: 500 })
  }
}

async function deleteImage(request: Request, env: Env, key: string): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  if (!key.includes(`/${user.id}/`)) {
    return jsonResponse(request, { error: 'Not authorized' }, { status: 403 })
  }

  try {
    await env.IMAGES.delete(key)
    return jsonResponse(request, { success: true }, { status: 200 })
  } catch (error) {
    console.error('Image delete error:', error)
    return jsonResponse(request, { error: 'Delete failed' }, { status: 500 })
  }
}

export async function handleImages(
  request: Request,
  env: Env,
  pathname: string
): Promise<Response | null> {
  const method = request.method

  if (pathname === '/upload/profile-picture' && method === 'POST') {
    return uploadProfilePicture(request, env)
  }

  if (pathname === '/upload/message-images' && method === 'POST') {
    return uploadMessageImages(request, env)
  }

  if (pathname.startsWith('/teams/') && pathname.endsWith('/upload-image') && method === 'POST') {
    const segments = pathname.split('/')
    const teamId = segments[2]
    return uploadTeamImage(request, env, teamId)
  }

  if (pathname.startsWith('/teams/') && pathname.endsWith('/delete-image') && method === 'DELETE') {
    const segments = pathname.split('/')
    const teamId = segments[2]
    return deleteTeamImage(request, env, teamId)
  }

  const segments = pathname.split('/').filter(Boolean)

  if (segments.length === 3 && segments[0] === 'teams' && segments[2] === 'upload-image' && method === 'POST') {
    return uploadTeamImage(request, env, segments[1])
  }

  if (segments.length === 3 && segments[0] === 'teams' && segments[2] === 'delete-image' && method === 'DELETE') {
    return deleteTeamImage(request, env, segments[1])
  }

  if (segments[0] === 'images' && method === 'GET') {
    const key = segments.slice(1).join('/')
    return serveImage(request, env, key)
  }

  if (segments[0] === 'images' && method === 'DELETE') {
    const key = segments.slice(1).join('/')
    return deleteImage(request, env, key)
  }

  return null
}
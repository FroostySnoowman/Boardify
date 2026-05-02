import type { Env } from './bindings';
import { jsonResponse } from './http';
import { getCurrentUserFromSession } from './auth';
import { requireBoardAccess } from './boardAccess';
import { resolveAuthPrincipal } from './authPrincipal';

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024;

function roleAtLeast(role: string, min: 'member' | 'admin' | 'owner'): boolean {
  const order = { member: 0, admin: 1, owner: 2 };
  return order[role as keyof typeof order] >= order[min];
}

function sanitizeAttachmentFilename(name: string): string {
  const trimmed = name.replace(/[/\\]/g, '').trim();
  const base = trimmed.length > 0 ? trimmed : 'file';
  return base.length > 180 ? base.slice(0, 180) : base;
}

function generateImageKey(userId: string, type: 'profile'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return `${type}/${userId}/${timestamp}-${random}`;
}

export function getImageUrl(_env: Env, key: string): string {
  return `/api/images/${key}`;
}

async function uploadProfilePicture(request: Request, env: Env): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env);
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 });
  }

  if (!env.IMAGES) {
    return jsonResponse(request, { error: 'Image storage not configured' }, { status: 500 });
  }

  const contentType = request.headers.get('content-type') || '';
  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > MAX_IMAGE_SIZE) {
    return jsonResponse(request, { error: 'File too large (max 10MB)' }, { status: 400 });
  }

  try {
    const imageData = await request.arrayBuffer();
    if (imageData.byteLength > MAX_IMAGE_SIZE) {
      return jsonResponse(request, { error: 'File too large (max 10MB)' }, { status: 400 });
    }

    const key = generateImageKey(user.id, 'profile');

    const oldPicture = await env.DB
      .prepare('SELECT profile_picture_url FROM users WHERE id = ?')
      .bind(Number(user.id))
      .first<{ profile_picture_url: string | null }>();

    await env.IMAGES.put(key, imageData, {
      httpMetadata: {
        contentType: contentType.split(';')[0] || 'image/jpeg',
        contentDisposition: 'inline',
      },
    });

    const imageUrl = getImageUrl(env, key);

    await env.DB
      .prepare('UPDATE users SET profile_picture_url = ?, updated_at = ? WHERE id = ?')
      .bind(imageUrl, new Date().toISOString(), Number(user.id))
      .run();

    if (oldPicture?.profile_picture_url) {
      const oldKey = oldPicture.profile_picture_url.split('/api/images/')[1];
      if (oldKey) {
        await env.IMAGES.delete(oldKey).catch((e: unknown) => {
          console.error('Failed to delete old profile picture:', e);
        });
      }
    }

    return jsonResponse(request, { url: imageUrl }, { status: 200 });
  } catch (error) {
    console.error('Profile picture upload error:', error);
    return jsonResponse(request, { error: 'Upload failed' }, { status: 500 });
  }
}

async function uploadCardAttachment(request: Request, env: Env): Promise<Response> {
  if (!env.IMAGES) {
    return jsonResponse(request, { error: 'Image storage not configured' }, { status: 500 });
  }

  const url = new URL(request.url);
  const cardId = url.searchParams.get('cardId');
  if (!cardId) {
    return jsonResponse(request, { error: 'cardId required' }, { status: 400 });
  }
  let filename = url.searchParams.get('filename') || 'file';
  try {
    filename = decodeURIComponent(filename);
  } catch {
    // ignore
  }
  filename = sanitizeAttachmentFilename(filename);

  const card = await env.DB.prepare(
    `SELECT c.id, l.board_id FROM cards c JOIN lists l ON l.id = c.list_id WHERE c.id = ?`
  )
    .bind(cardId)
    .first<{ id: string; board_id: string }>();
  if (!card) {
    return jsonResponse(request, { error: 'Not found' }, { status: 404 });
  }

  const principal = await resolveAuthPrincipal(request, env);
  const access = await requireBoardAccess(request, env, card.board_id, principal);
  if (access instanceof Response) {
    return access;
  }
  if (!roleAtLeast(access.role, 'member')) {
    return jsonResponse(request, { error: 'Forbidden' }, { status: 403 });
  }

  const contentType = request.headers.get('content-type') || 'application/octet-stream';
  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > MAX_ATTACHMENT_SIZE) {
    return jsonResponse(request, { error: 'File too large (max 25MB)' }, { status: 400 });
  }

  try {
    const data = await request.arrayBuffer();
    if (data.byteLength > MAX_ATTACHMENT_SIZE) {
      return jsonResponse(request, { error: 'File too large (max 25MB)' }, { status: 400 });
    }
    if (data.byteLength === 0) {
      return jsonResponse(request, { error: 'Empty file' }, { status: 400 });
    }

    const attachmentId = crypto.randomUUID();
    const random = Math.random().toString(36).slice(2, 8);
    const safeTail = filename.replace(/[^a-zA-Z0-9._-]+/g, '_') || 'file';
    const key = `attachments/${card.board_id}/${cardId}/${attachmentId}-${random}-${safeTail}`;

    const ct = contentType.split(';')[0].trim() || 'application/octet-stream';
    const disp =
      ct.startsWith('image/') || ct === 'application/pdf' ? 'inline' : 'attachment';

    await env.IMAGES.put(key, data, {
      httpMetadata: {
        contentType: ct,
        contentDisposition: disp,
      },
    });

    const imageUrl = getImageUrl(env, key);
    return jsonResponse(
      request,
      {
        attachment: {
          id: attachmentId,
          name: filename,
          url: imageUrl,
          storageKey: key,
          size: data.byteLength,
          mimeType: ct,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Card attachment upload error:', error);
    return jsonResponse(request, { error: 'Upload failed' }, { status: 500 });
  }
}

async function serveImage(request: Request, env: Env, key: string): Promise<Response> {
  try {
    if (!env.IMAGES) {
      return new Response('Image storage not configured', { status: 500 });
    }

    const object = await env.IMAGES.get(key);
    if (!object || !object.body) {
      return new Response('Image not found', { status: 404 });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    if (!headers.get('Content-Type')) {
      if (key.endsWith('.png')) headers.set('Content-Type', 'image/png');
      else if (key.endsWith('.jpg') || key.endsWith('.jpeg')) headers.set('Content-Type', 'image/jpeg');
      else if (key.endsWith('.webp')) headers.set('Content-Type', 'image/webp');
      else headers.set('Content-Type', 'application/octet-stream');
    }
    if (!headers.get('Content-Disposition')) {
      headers.set('Content-Disposition', 'inline');
    }
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    headers.set('Access-Control-Allow-Origin', '*');

    return new Response(object.body, { headers });
  } catch (error) {
    console.error('Image serve error:', key, error);
    return new Response('Error serving image', { status: 500 });
  }
}

export async function handleImages(
  request: Request,
  env: Env,
  pathname: string
): Promise<Response | null> {
  const method = request.method;

  if (pathname === '/upload/profile-picture' && method === 'POST') {
    return uploadProfilePicture(request, env);
  }

  if (pathname === '/upload/card-attachment' && method === 'POST') {
    return uploadCardAttachment(request, env);
  }

  const segments = pathname.split('/').filter(Boolean);
  if (segments[0] === 'images' && method === 'GET') {
    const key = segments.slice(1).join('/');
    return serveImage(request, env, key);
  }

  return null;
}

const COOKIE_NAME = 'auth_session';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 14;

function isProduction(url: string): boolean {
  return url.startsWith('https://');
}

function isLocalhost(url: string): boolean {
  return url.includes('localhost') || url.includes('127.0.0.1');
}

export function setAuthCookie(
  response: Response,
  token: string,
  baseUrl: string
): Response {
  const isLocal = isLocalhost(baseUrl);

  const sameSite = isLocal ? 'Lax' : 'None';
  const secureFlag = isLocal ? '' : '; Secure';

  const cookieValue = `${COOKIE_NAME}=${token}; Path=/; Max-Age=${COOKIE_MAX_AGE}; HttpOnly; SameSite=${sameSite}${secureFlag}`;

  const headers = new Headers(response.headers);
  headers.append('Set-Cookie', cookieValue);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function clearAuthCookie(response: Response, baseUrl: string): Response {
  const isLocal = isLocalhost(baseUrl);

  const sameSite = isLocal ? 'Lax' : 'None';
  const secureFlag = isLocal ? '' : '; Secure';

  const cookieValue = `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=${sameSite}${secureFlag}`;

  const headers = new Headers(response.headers);
  headers.append('Set-Cookie', cookieValue);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function getAuthTokenFromCookie(request: Request): string | null {
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(';').map((c) => c.trim());
  for (const cookie of cookies) {
    const [name, value] = cookie.split('=');
    if (name === COOKIE_NAME && value) {
      return value;
    }
  }

  return null;
}

export function getAuthTokenFromHeader(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.trim().split(' ');
  if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
    return parts[1];
  } else if (parts.length === 1) {
    return parts[0];
  }

  return null;
}

export function getAuthTokenFromQueryParam(request: Request): string | null {
  try {
    const url = new URL(request.url);
    return url.searchParams.get('token');
  } catch {
    return null;
  }
}

export function getAuthToken(request: Request): string | null {
  const cookieToken = getAuthTokenFromCookie(request);
  if (cookieToken) {
    return cookieToken;
  }

  const headerToken = getAuthTokenFromHeader(request);
  if (headerToken) {
    return headerToken;
  }

  return getAuthTokenFromQueryParam(request);
}

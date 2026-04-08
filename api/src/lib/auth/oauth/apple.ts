interface AppleUserInfo {
  id: string;
  email?: string;
  email_verified?: boolean;
  name?: {
    firstName?: string;
    lastName?: string;
  };
}

export function getAppleAuthUrl(
  clientId: string,
  redirectUri: string,
  state: string
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code id_token',
    scope: 'name email',
    response_mode: 'form_post',
    state,
  });

  return `https://appleid.apple.com/auth/authorize?${params.toString()}`;
}

export async function exchangeAppleCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<{ idToken: string; refreshToken?: string }> {
  const response = await fetch('https://appleid.apple.com/auth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Apple token exchange failed: ${error}`);
  }

  const data = await response.json<{
    id_token: string;
    refresh_token?: string;
    expires_in: number;
  }>();

  return {
    idToken: data.id_token,
    refreshToken: data.refresh_token,
  };
}

export function getAppleUserFromIdToken(idToken: string): AppleUserInfo {
  const parts = idToken.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid ID token format');
  }

  const payload = JSON.parse(
    atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
  ) as {
    sub: string;
    email?: string;
    email_verified?: boolean | string;
    name?: string;
  };

  let name: { firstName?: string; lastName?: string } | undefined;
  if (payload.name) {
    try {
      name = typeof payload.name === 'string' ? JSON.parse(payload.name) : payload.name;
    } catch {
      name = undefined;
    }
  }

  return {
    id: payload.sub,
    email: payload.email,
    email_verified:
      typeof payload.email_verified === 'string'
        ? payload.email_verified === 'true'
        : payload.email_verified,
    name,
  };
}

export function validateAppleIdToken(
  idToken: string,
  clientId: string,
  bundleId?: string
): { isValid: boolean; error?: string } {
  try {
    const parts = idToken.split('.');
    if (parts.length !== 3) {
      return { isValid: false, error: 'Invalid token format: not a valid JWT' };
    }

    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
    ) as {
      iss?: string;
      aud?: string | string[];
      exp?: number;
      sub?: string;
    };

    if (payload.iss !== 'https://appleid.apple.com') {
      return {
        isValid: false,
        error: `Invalid issuer: expected 'https://appleid.apple.com', got '${payload.iss}'`,
      };
    }

    const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    const validAudiences = [clientId];
    if (bundleId) {
      validAudiences.push(bundleId);
    }

    const hasValidAudience = aud.some((a) => a && validAudiences.includes(a));
    if (!hasValidAudience) {
      return {
        isValid: false,
        error: `Invalid audience: expected one of [${validAudiences.join(', ')}], got ${JSON.stringify(payload.aud)}`,
      };
    }

    if (payload.exp && payload.exp < Date.now() / 1000) {
      return {
        isValid: false,
        error: `Token expired: exp=${payload.exp}, now=${Math.floor(Date.now() / 1000)}`,
      };
    }

    if (!payload.sub) {
      return { isValid: false, error: 'Missing subject (sub) claim' };
    }

    return { isValid: true };
  } catch (error) {
    return {
      isValid: false,
      error: `Token validation error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Google Service Account OAuth2 Access Token helper for Cloudflare Workers / Pages Functions.
 * Uses native Web Crypto API (RSASSA-PKCS1-v1_5 + SHA-256) with zero external packages.
 */

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

function base64UrlEncode(input) {
  const bytes = typeof input === 'string'
    ? new TextEncoder().encode(input)
    : input instanceof Uint8Array
      ? input
      : new Uint8Array(input);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemToArrayBuffer(pem) {
  const normalized = String(pem || '')
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export function extractGoogleCredentials(env) {
  if (env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    try {
      const parsed = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON);
      if (parsed?.client_email && parsed?.private_key) {
        return { clientEmail: parsed.client_email, privateKey: parsed.private_key };
      }
      return { error: 'GOOGLE_SERVICE_ACCOUNT_JSON is missing client_email or private_key.' };
    } catch {
      return { error: 'GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON.' };
    }
  }

  const clientEmail = env.GOOGLE_SERVICE_ACCOUNT_EMAIL || env.GOOGLE_CLIENT_EMAIL || '';
  const privateKey = env.GOOGLE_PRIVATE_KEY || '';

  if (clientEmail && privateKey) {
    return { clientEmail: clientEmail.trim(), privateKey };
  }

  const missing = [];
  if (!clientEmail) missing.push('GOOGLE_SERVICE_ACCOUNT_EMAIL (or GOOGLE_SERVICE_ACCOUNT_JSON)');
  if (!privateKey) missing.push('GOOGLE_PRIVATE_KEY (or GOOGLE_SERVICE_ACCOUNT_JSON)');
  return { missing };
}

export async function getGoogleAccessToken(env, scopes) {
  const creds = extractGoogleCredentials(env);
  if (creds.missing || creds.error) {
    return { ok: false, missing: creds.missing, error: creds.error };
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claimSet = base64UrlEncode(JSON.stringify({
      iss: creds.clientEmail,
      scope: Array.isArray(scopes) ? scopes.join(' ') : String(scopes),
      aud: TOKEN_ENDPOINT,
      exp: now + 3600,
      iat: now
    }));
    const unsignedJwt = `${header}.${claimSet}`;

    const keyBuffer = pemToArrayBuffer(creds.privateKey);
    const cryptoKey = await crypto.subtle.importKey(
      'pkcs8',
      keyBuffer,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      cryptoKey,
      new TextEncoder().encode(unsignedJwt)
    );

    const signedJwt = `${unsignedJwt}.${base64UrlEncode(signature)}`;

    const tokenResp = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: signedJwt
      })
    });

    const payload = await tokenResp.json().catch(() => ({}));
    if (!tokenResp.ok || !payload.access_token) {
      return {
        ok: false,
        authError: true,
        error: payload.error_description || payload.error || `Google OAuth token exchange failed (${tokenResp.status})`
      };
    }

    return { ok: true, accessToken: payload.access_token };
  } catch (err) {
    return {
      ok: false,
      authError: true,
      error: `Google Service Account signing failed: ${err?.message || 'Invalid key format'}`
    };
  }
}

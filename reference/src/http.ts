const ALLOWED_ORIGINS = new Set([
  'http://developers.google.com',
  'http://developers.google.com/',
  'https://developers.google.com',
  'https://localhost',
  'http://localhost',
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  'http://127.0.0.1:5005',
  'http://localhost:5005',
  'http://127.0.0.1:8081',
  'http://localhost:8081',
  'https://mybreakpoint.app',
  'http://mybreakpoint.app',
  'http://mybreakpoint.pages.dev',
  'https://mybreakpoint.pages.dev',
  'https://api.mybreakpoint.app',
  'http://api.mybreakpoint.app',
  'https://crm.mybreakpoint.net',
  'http://crm.mybreakpoint.net'
])

const ALLOW_METHODS = 'GET, POST, PUT, DELETE, OPTIONS, PATCH'

const ALLOW_HEADERS = [
  'Content-Type',
  'Authorization',
  'X-CSRF-TOKEN',
  'Cookie',
  'X-Requested-With',
  'mode',
  'Access-Control-Request-Headers',
  'Access-Control-Request-Method',
  'Origin',
  'Accept',
  'x-d1-bookmark'
].join(', ')

const EXPOSE_HEADERS = [
  'Content-Type',
  'Authorization',
  'Set-Cookie',
  'Access-Control-Allow-Origin',
  'Access-Control-Allow-Credentials',
  'x-d1-bookmark'
].join(', ')

export function buildCorsHeaders(req: Request): Headers {
  const origin = req.headers.get('Origin') || ''
  const headers = new Headers()

  if (ALLOWED_ORIGINS.has(origin)) {
    headers.set('Access-Control-Allow-Origin', origin)
    headers.set('Access-Control-Allow-Credentials', 'true')
  }

  headers.set('Access-Control-Allow-Methods', ALLOW_METHODS)
  headers.set('Access-Control-Allow-Headers', ALLOW_HEADERS)
  headers.set('Access-Control-Expose-Headers', EXPOSE_HEADERS)

  return headers
}

export function jsonResponse(
  req: Request,
  body: unknown,
  init: ResponseInit = {}
): Response {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')

  const cors = buildCorsHeaders(req)
  cors.forEach((value, key) => headers.set(key, value))

  return new Response(JSON.stringify(body), { ...init, headers })
}

export function emptyCorsResponse(req: Request, status = 204): Response {
  const headers = buildCorsHeaders(req)
  return new Response(null, { status, headers })
}
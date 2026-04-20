/**
 * In-app API docs (Swagger-style). Keep aligned with api/docs/HTTP_API.md and openapi.yaml.
 * Placeholders: __API_BASE__ → production worker origin (`getApiDocsPublicBaseUrl`);
 * `<host>` → that origin’s hostname (for WebSocket examples).
 */

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export type DocParamRow = {
  name: string;
  type: string;
  required: string;
  description: string;
};

export type DocBlock =
  | { type: 'lead'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'p'; text: string }
  | { type: 'bullets'; items: string[] }
  | { type: 'callout'; variant: 'info' | 'warn'; text: string }
  | { type: 'code'; label: string; code: string }
  | { type: 'endpoint'; method: HttpMethod; path: string; description: string }
  | { type: 'paramTable'; title?: string; rows: DocParamRow[] };

export type ApiDocCategory = {
  id: string;
  title: string;
  description: string;
  blocks: DocBlock[];
  searchBlob: string;
};

function cat(
  id: string,
  title: string,
  description: string,
  blocks: DocBlock[],
  extraSearch = ''
): ApiDocCategory {
  const blob = [id, title, description, extraSearch, JSON.stringify(blocks)].join(' ').toLowerCase();
  return { id, title, description, blocks, searchBlob: blob };
}

export const API_DOC_CATEGORIES: ApiDocCategory[] = [
  cat(
    'overview',
    'Overview',
    'REST surface, naming, and how paths map to the Worker.',
    [
      {
        type: 'lead',
        text: 'Boardify’s HTTP API lives on your Cloudflare Worker. The same routes power the mobile and web apps. Tasks in the UI are cards in the API; lists are board columns. URLs in this reference are always the production worker; use API keys and tokens issued for that environment.',
      },
      { type: 'h2', text: 'Base URL' },
      {
        type: 'p',
        text: 'Point clients at your deployed API origin. Many routes accept an optional /api prefix; the Worker strips it for boards, lists, cards, uploads, and WebSockets.',
      },
      {
        type: 'code',
        label: 'Base URL',
        code: '__API_BASE__',
      },
      {
        type: 'callout',
        variant: 'info',
        text: 'JSON request bodies use Content-Type: application/json unless uploading binary attachments.',
      },
    ],
    'rest worker cloudflare'
  ),
  cat(
    'authentication',
    'Authentication',
    'Sessions, API keys (bfk_), scopes, and what each credential can do.',
    [
      {
        type: 'lead',
        text: 'Every request must identify the user. Use either a session token from sign-in or an API key you create in Account → Developer API.',
      },
      { type: 'h2', text: 'Bearer token' },
      {
        type: 'p',
        text: 'Send credentials in the Authorization header. Use a production session JWT or a `bfk_` API key issued against the same production origin as the base URL above (dev or local tokens are rejected by production). When both a Bearer header and a web session cookie exist, the header wins so scripts are not overridden by the browser.',
      },
      {
        type: 'code',
        label: 'Example header',
        code: 'Authorization: Bearer <ACCESS_TOKEN>',
      },
      { type: 'h2', text: 'Session (app sign-in)' },
      {
        type: 'p',
        text: 'After email or social sign-in, the app stores a token. On web, an HttpOnly cookie may also be set. Native clients send Bearer only.',
      },
      { type: 'h2', text: 'API keys' },
      {
        type: 'p',
        text: 'Keys start with bfk_. The full secret is shown once when created; store it like a password. Keys act as the owning user for board membership and roles.',
      },
      {
        type: 'endpoint',
        method: 'GET',
        path: '/user/api-keys',
        description: 'List keys (session only). Returns prefixes and scopes, never the secret.',
      },
      {
        type: 'endpoint',
        method: 'POST',
        path: '/user/api-keys',
        description: 'Create a key. Body: { name, scopeKind: "all" | "boards", boardIds? }. Requires session.',
      },
      {
        type: 'endpoint',
        method: 'DELETE',
        path: '/user/api-keys/:id',
        description: 'Revoke a key (session only).',
      },
      { type: 'h2', text: 'Scopes' },
      {
        type: 'bullets',
        items: [
          'all — Any board you are a member of; you may POST /boards to create boards.',
          'boards — Only selected board IDs; GET /boards is filtered; POST /boards is forbidden.',
        ],
      },
      {
        type: 'callout',
        variant: 'warn',
        text: 'Accepting or declining board invitations requires a real session with a matching email — API keys cannot call those routes.',
      },
    ],
    'bfk oauth cookie session'
  ),
  cat(
    'boards',
    'Boards',
    'List boards, create, read, update, delete, and full snapshots.',
    [
      {
        type: 'lead',
        text: 'Board-scoped routes live under /boards/:boardId. Replace :boardId with a UUID. Admin or owner roles are required for destructive or membership-sensitive operations as noted in responses.',
      },
      {
        type: 'endpoint',
        method: 'GET',
        path: '/boards',
        description: 'List boards for the current principal (filtered when using a boards-scoped API key).',
      },
      {
        type: 'endpoint',
        method: 'POST',
        path: '/boards',
        description: 'Create a board (JSON: name, optional color, settings_json). Forbidden for boards-scoped keys.',
      },
      {
        type: 'endpoint',
        method: 'GET',
        path: '/boards/:boardId',
        description: 'Fetch one board row.',
      },
      {
        type: 'endpoint',
        method: 'PATCH',
        path: '/boards/:boardId',
        description: 'Update board fields (admin+).',
      },
      {
        type: 'endpoint',
        method: 'DELETE',
        path: '/boards/:boardId',
        description: 'Delete board (owner).',
      },
      {
        type: 'endpoint',
        method: 'GET',
        path: '/boards/:boardId/full',
        description: 'Board plus lists and cards (large snapshot).',
      },
      {
        type: 'code',
        label: 'Example',
        code: `curl -sS -H "Authorization: Bearer <token>" \\\n  "__API_BASE__/api/boards"`,
      },
    ],
    'members invitations archive audit dashboard'
  ),
  cat(
    'lists-and-cards',
    'Lists & cards',
    'Columns, cards (tasks), reorder, and move.',
    [
      {
        type: 'lead',
        text: 'Lists belong to a board. Cards belong to a list. IDs are UUIDs.',
      },
      {
        type: 'endpoint',
        method: 'GET',
        path: '/boards/:boardId/lists',
        description: 'List non-archived columns for a board.',
      },
      {
        type: 'endpoint',
        method: 'POST',
        path: '/boards/:boardId/lists',
        description: 'Create a list (body: title, optional position).',
      },
      {
        type: 'endpoint',
        method: 'POST',
        path: '/boards/:boardId/lists/reorder',
        description: 'Reorder lists (body: { orderedIds: string[] }).',
      },
      {
        type: 'endpoint',
        method: 'PATCH',
        path: '/lists/:listId',
        description: 'Rename or reposition a list.',
      },
      {
        type: 'endpoint',
        method: 'DELETE',
        path: '/lists/:listId',
        description: 'Delete list (admin+).',
      },
      {
        type: 'endpoint',
        method: 'GET',
        path: '/lists/:listId/cards',
        description: 'List cards in a column.',
      },
      {
        type: 'endpoint',
        method: 'POST',
        path: '/lists/:listId/cards',
        description: 'Create a card (body includes title and optional payload fields).',
      },
      {
        type: 'endpoint',
        method: 'GET',
        path: '/cards/:cardId',
        description: 'Get one card.',
      },
      {
        type: 'endpoint',
        method: 'PATCH',
        path: '/cards/:cardId',
        description: 'Update card fields and payload (member+).',
      },
      {
        type: 'endpoint',
        method: 'DELETE',
        path: '/cards/:cardId',
        description: 'Delete card (member+).',
      },
      {
        type: 'endpoint',
        method: 'POST',
        path: '/cards/:cardId/move',
        description: 'Move to another list on the same board (body: { listId, position? }).',
      },
      {
        type: 'paramTable',
        title: 'Move card body',
        rows: [
          {
            name: 'listId',
            type: 'string',
            required: 'required',
            description: 'Target list UUID on the same board.',
          },
          {
            name: 'position',
            type: 'number',
            required: 'optional',
            description: '0-based order within the target list.',
          },
        ],
      },
    ],
    'tasks columns reorder'
  ),
  cat(
    'invitations',
    'Invitations',
    'Email invitations and session-only accept/decline routes.',
    [
      {
        type: 'lead',
        text: 'Admins can create invitations from the app; public accept flows may use token links. In-board accept/decline endpoints require a signed-in user.',
      },
      {
        type: 'endpoint',
        method: 'POST',
        path: '/boards/:boardId/invitations/:invitationId/accept',
        description: 'Accept invite (session + email must match invitation).',
      },
      {
        type: 'endpoint',
        method: 'POST',
        path: '/boards/:boardId/invitations/:invitationId/decline',
        description: 'Decline invite (session + email match).',
      },
      {
        type: 'callout',
        variant: 'info',
        text: 'Listing and sending invitations from HTTP uses other board routes; see OpenAPI for full paths.',
      },
    ],
    'email invite member'
  ),
  cat(
    'ai',
    'AI endpoints',
    'Workers AI helpers and daily quotas.',
    [
      {
        type: 'lead',
        text: 'Board-scoped AI routes consume the same per-user daily quota as the app (429 when exceeded).',
      },
      {
        type: 'endpoint',
        method: 'POST',
        path: '/boards/:boardId/ai/prioritize',
        description: 'Suggest card order from current board tasks.',
      },
      {
        type: 'endpoint',
        method: 'POST',
        path: '/boards/:boardId/ai/next-task',
        description: 'Pick a single “next task” with rationale.',
      },
      {
        type: 'endpoint',
        method: 'POST',
        path: '/boards/:boardId/ai/list-insights',
        description: 'Short health summary for lists on the board.',
      },
      {
        type: 'endpoint',
        method: 'POST',
        path: '/cards/:cardId/ai/subtasks',
        description: 'Suggest checklist-style subtasks for one card.',
      },
    ],
    'llm quota'
  ),
  cat(
    'realtime-and-uploads',
    'WebSockets & uploads',
    'Live board sync, attachments, and profile photos.',
    [
      {
        type: 'lead',
        text: 'WebSockets use the same auth as HTTP. Card attachments accept session or API keys with board access; profile photos are session-only.',
      },
      {
        type: 'h2', text: 'WebSocket' },
      {
        type: 'code',
        label: 'Connect',
        code: 'wss://<host>/ws/boards/<boardId>?token=<token>',
      },
      {
        type: 'p',
        text: 'Use Authorization: Bearer, cookie, or ?token= on the upgrade request. The principal must be allowed to access boardId.',
      },
      { type: 'h2', text: 'Uploads' },
      {
        type: 'endpoint',
        method: 'POST',
        path: '/upload/card-attachment?cardId=&filename=',
        description: 'Binary body; Content-Type from file. Requires access to the card’s board.',
      },
      {
        type: 'endpoint',
        method: 'POST',
        path: '/upload/profile-picture',
        description: 'Session only — sets the signed-in user’s avatar.',
      },
      {
        type: 'endpoint',
        method: 'GET',
        path: '/api/images/{key}',
        description: 'Serve stored objects from R2 (public GET).',
      },
    ],
    'r2 websocket attachment'
  ),
  cat(
    'errors-and-metadata',
    'Errors & metadata',
    'Status codes, D1 bookmarks, and the OpenAPI file.',
    [
      {
        type: 'lead',
        text: 'Errors are JSON with an error string (or structured auth errors on some routes).',
      },
      {
        type: 'bullets',
        items: [
          '401 — Missing or invalid credentials.',
          '403 — Authenticated but not allowed (role or API key scope).',
          '404 — Unknown resource.',
          '429 — AI daily limit.',
          '502 — Upstream AI failure.',
        ],
      },
      { type: 'h2', text: 'D1 read-after-write' },
      {
        type: 'p',
        text: 'Successful responses may include x-d1-bookmark. Echo it on subsequent reads as x-d1-bookmark for Cloudflare D1 consistency.',
      },
      { type: 'h2', text: 'OpenAPI' },
      {
        type: 'p',
        text: 'The repo ships api/docs/openapi.yaml for codegen, Postman import, and contract review.',
      },
    ],
    'swagger bookmark status'
  ),
];

export function getApiDocCategory(id: string): ApiDocCategory | undefined {
  return API_DOC_CATEGORIES.find((c) => c.id === id);
}

export function filterApiDocCategories(query: string): ApiDocCategory[] {
  const q = query.trim().toLowerCase();
  if (!q) return API_DOC_CATEGORIES;
  return API_DOC_CATEGORIES.filter((c) => c.searchBlob.includes(q));
}

function docsHostFromPublicBase(apiBase: string): string {
  const base = apiBase.replace(/\/$/, '');
  if (!base.startsWith('http')) return '';
  try {
    return new URL(base).host;
  } catch {
    return '';
  }
}

export function interpolateApiDocs(text: string, apiBase: string): string {
  const base = apiBase.replace(/\/$/, '');
  let out = text.replace(/__API_BASE__/g, base);
  const host = docsHostFromPublicBase(base);
  if (host) out = out.replace(/<host>/g, host);
  return out;
}

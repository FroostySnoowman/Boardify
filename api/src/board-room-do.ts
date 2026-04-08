import type { Env } from './bindings';
import { getBoardBroadcastAuthSecret } from './boardSync';

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let x = 0;
  for (let i = 0; i < a.length; i++) {
    x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return x === 0;
}

export class BoardRoom {
  private sockets = new Set<WebSocket>();

  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env
  ) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/internal/broadcast' && request.method === 'POST') {
      const got = request.headers.get('X-Board-Sync-Secret') ?? '';
      const want = getBoardBroadcastAuthSecret(this.env);
      if (!want || !timingSafeEqual(got, want)) {
        return new Response('Forbidden', { status: 403 });
      }

      let payload: Record<string, unknown>;
      try {
        payload = (await request.json()) as Record<string, unknown>;
      } catch {
        return new Response('Bad JSON', { status: 400 });
      }

      const prev = (await this.state.storage.get<number>('seq')) ?? 0;
      const seq = prev + 1;
      await this.state.storage.put('seq', seq);

      const msg = JSON.stringify({ ...payload, seq });
      const dead: WebSocket[] = [];
      for (const ws of this.sockets) {
        try {
          ws.send(msg);
        } catch {
          dead.push(ws);
        }
      }
      for (const ws of dead) {
        this.sockets.delete(ws);
      }

      return new Response('OK', { status: 200 });
    }

    const upgrade = request.headers.get('Upgrade');
    if (!upgrade || upgrade.toLowerCase() !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    const userIdRaw = request.headers.get('X-Internal-User-Id');
    if (!userIdRaw) {
      return new Response('Unauthorized', { status: 401 });
    }
    const userId = parseInt(userIdRaw, 10);
    if (!Number.isFinite(userId)) {
      return new Response('Unauthorized', { status: 401 });
    }

    const usernameEnc = request.headers.get('X-Internal-Username') || '';
    let username = '';
    try {
      username = decodeURIComponent(usernameEnc);
    } catch {
      username = usernameEnc;
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    server.accept();
    this.sockets.add(server);

    server.addEventListener('message', (evt) => {
      try {
        const data = JSON.parse(evt.data as string) as { type?: string };
        if (data.type === 'ping') {
          server.send(JSON.stringify({ type: 'pong', ts: Date.now() }));
        }
      } catch {
        /* ignore */
      }
    });

    server.addEventListener('close', () => {
      this.sockets.delete(server);
    });

    server.addEventListener('error', () => {
      this.sockets.delete(server);
    });

    const seq = (await this.state.storage.get<number>('seq')) ?? 0;
    server.send(
      JSON.stringify({
        type: 'hello',
        v: 1,
        seq,
        userId,
        username,
      })
    );

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }
}

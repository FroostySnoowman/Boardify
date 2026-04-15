# Boardify (BetterBoardify)

Monorepo for **Boardify**: a collaborative board / task app built with **Expo (React Native)** for iOS, Android, and web, backed by a **Cloudflare Workers** API, **D1**, **R2**, and related Cloudflare primitives.

| Directory | Contents |
|-----------|----------|
| [`app/`](app/) | Expo app — Expo Router, NativeWind, auth, boards UI |
| [`api/`](api/) | Worker API — auth, boards, images, WebSockets, Workers AI, notifications |
| [`db/`](db/) | D1 schema and migrations |

## Requirements

- **Node.js** 18+
- **App:** see [`app/README.md`](app/README.md) for Expo run/build, env vars, and push setup
- **API:** see [`api/README.md`](api/README.md) for Wrangler, D1, queues (production), and secrets

## Quick start

```bash
# Install the mobile/web client
cd app && npm install && npm start

# API (from another terminal), remote dev D1 example:
cd api && npm install && npm run dev
```

Point the app at your API base URL (see `app` README and `app.config.js` / `.env.development`).

## Contributing

Pull requests and issues are welcome. By contributing, you agree that your
contribution is licensed to the project maintainer under the terms described in
[`LICENSE`](LICENSE) (section 3).

## License

**Source-available (not a permissive OSS license).**

Copyright (c) 2026 Jacob Beal. All rights reserved.

You may inspect and clone this code for **personal, non-commercial** use. You may
**not** use it in production, commercially redistribute it, or copy it as a
product or template **without prior written permission** from the copyright
holder.

See **[`LICENSE`](LICENSE)** for the full terms.

If you need a commercial license, redistribution rights, or other arrangements,
contact the copyright holder.

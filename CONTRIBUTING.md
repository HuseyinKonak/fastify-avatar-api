# Contributing

Thank you for considering a contribution.

## Local development

1. Install Node.js 20 or newer.
2. Run `npm ci`.
3. Copy `.env.example` to `.env` if you need local overrides.
4. Run `npm run dev`.

Redis is optional. Leave `REDIS_URL` unset to use only the in-memory cache.

## Before opening a pull request

Run:

```bash
npm run check
npm run build
```

Add or update tests for behavior changes. Keep public API and configuration
changes documented in the README and `.env.example`.

Pull requests should explain the problem, the chosen approach, and any security
or operational impact. Please keep unrelated refactors in separate changes.

## Reporting security issues

Do not open a public issue for a suspected vulnerability. Follow the private
reporting guidance in [SECURITY.md](./SECURITY.md).

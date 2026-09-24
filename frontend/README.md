# ClinicCare frontend

Nuxt 3 + Vue 3 + TypeScript, managed with [pnpm](https://pnpm.io/) — this project never
uses npm, yarn or bun. Project overview and full setup instructions live in the
[root README](../README.md).

```bash
pnpm install                # install dependencies
pnpm dev                    # http://localhost:3000
pnpm build && pnpm preview  # production build, then preview it
pnpm test                   # Vitest
pnpm lint                   # eslint .
pnpm typecheck              # nuxt typecheck (vue-tsc)
```

Open the app at **http://localhost:3000**, not `127.0.0.1`: the backend only allows CORS
requests from `http://localhost:3000`, so on `127.0.0.1` login fails with "Could not
reach the server" even though the backend is running fine.

Configuration comes from `runtimeConfig.public.apiBase` in `nuxt.config.ts`, overridable
via `NUXT_PUBLIC_API_BASE`; copy `.env.example` to `.env` to point at a backend that
isn't on `http://localhost:8000`. Architecture and conventions are documented in
`../CLAUDE.md` and `../.claude/rules/`.

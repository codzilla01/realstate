# Real Estate Platform (Arabic, RTL) — sellable starter

A complete, production-shaped real-estate product for the Arabic market:
a public listings website (dark/gold design, full RTL) plus a full admin
dashboard for properties, clients, contracts, inquiries, reports and staff.

> Arabic documentation is the primary one: [README.md](README.md).
> This file is a short English overview for international buyers.

## Try it without a database

```bash
npm run setup
npm run demo     # in-memory demo API + Vite dev server
```

- Public site: `http://localhost:5173/`
- Admin: `http://localhost:5173/admin/login`
- Logins: `201000000001 / admin1234` (admin), `201000000002 / agent1234`,
  `201000000003 / viewer1234` (read-only)

## What's inside

- **Frontend** — React 19 + Vite + Tailwind, RTL Arabic UI, Leaflet maps,
  Recharts dashboards, role-aware navigation, 404/403 pages.
- **Backend** — Express 4 + Prisma + MySQL, JWT auth (password or OTP),
  Zod validation, in-memory rate limiting, security headers, unified error
  handling, gracefull shutdown, `/api/health` with DB probe.
- **Roles** — ADMIN / MANAGER / AGENT / VIEWER (server-enforced).
- **Ops** — Docker Compose (MySQL + API + nginx), VPS recipes (nginx + systemd),
  env templates, backup commands, deployment guide.
- **Docs** — API reference, data model, admin guide, security checklist,
  roadmap, sales kit and a handover checklist (Arabic).
- **Tests** — `npm test` (node:test) for JWT, validation and rate limiting.

## Production quick start (Docker)

```bash
cp .env.example .env      # set MYSQL_ROOT_PASSWORD, JWT_SECRET, CORS_ORIGIN
docker compose up --build -d
# → http://localhost:8080
```

## Security highlights

- Public sign-up is disabled; staff accounts are created by an admin.
- JWT secret is mandatory (32+ chars) in production.
- OTP: expiry, single active code, max attempts, constant-time comparison,
  never returned in production.
- Rate limits on login/OTP/public forms; CORS allow-list; 1 MB body limit.
- Draft listings hidden from visitors; notification ownership enforced.

## License

Transferable commercial license — see [LICENSE](LICENSE).
Third-party components: [NOTICE.md](NOTICE.md).

## Known limitations

Cloud image uploads (URLs today), real SMS provider for OTP, English UI
translation, E2E tests and payments are not implemented — see
[docs/roadmap.md](docs/roadmap.md).

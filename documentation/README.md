# Zapi Social

Zapi Social is a self-hosted social publishing platform with a customer Portal,
an operational Admin panel, a REST API, background workers, plan enforcement,
AI tools, content boards, files, teams, billing, and provider integrations.

## Start here

Open [`documentation/index.html`](./index.html) in a browser. It contains the
complete English installation, first-run setup, demo, update, backup,
troubleshooting, and safe-support guide.

The short installation flow is:

```bash
cp .env.example .env
chmod 600 .env
docker compose config --quiet
docker compose build --pull
docker compose up -d
```

Open the configured Web URL after every service is healthy. A new installation
redirects to `/setup`, where you create the one-time Platform Admin. Register a
separate Portal owner after setup.

Never commit or share `.env`. PostgreSQL and Redis are private Compose services
and must not be exposed to the public internet.

## Included applications

- `apps/web`: Next.js Admin and Portal.
- `apps/api`: NestJS/Fastify REST API.
- `apps/worker`: BullMQ background processing.
- `packages/database`: PostgreSQL schema and Drizzle migrations.
- `packages/contracts`: shared validation and response contracts.
- `packages/ui`: shared interface primitives.

## Updates

Back up PostgreSQL and uploaded files before replacing application files. Keep
your `.env` and Docker volumes, compare `.env.example`, then rebuild, run the
one-shot migration service, and recreate the stack. The complete procedure is
in [`documentation/index.html`](./index.html#update).

## Support safety

Include the version and source commit from `RELEASE.txt` when requesting
support. Never send passwords, cookies, JWTs, OAuth tokens, provider secrets,
SMTP credentials, customer data, `.env`, or database backups.

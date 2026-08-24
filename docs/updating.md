# Zapi Social update guide

Use this procedure for every release. Read the release notes first; they may
contain version-specific instructions that override this general guide.

## 1. Record the current state

```bash
docker compose ps
docker compose images
```

Confirm the current application works before changing it. Do not start an
update while a migration, import, or publishing job is being investigated.

## 2. Back up durable data

```bash
mkdir -p backups
docker compose exec -T postgres sh -c \
  'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' \
  > "backups/pre-update-database-$(date +%Y%m%d-%H%M%S).sql"

docker compose exec -T api \
  tar -C /app/.data -czf - files \
  > "backups/pre-update-files-$(date +%Y%m%d-%H%M%S).tar.gz"
```

Copy the backups away from the server before continuing.

## 3. Replace application files

Keep these local files and data:

- `.env`
- the `backups/` directory
- Docker volumes (`postgres-data`, `redis-data`, and `files-data`)

Replace the application source with the new release archive. Compare the new
`.env.example` with your existing `.env` and add any newly required variables.
Never overwrite `.env` with the example file.

Validate configuration:

```bash
docker compose config --quiet
```

## 4. Build, migrate, and restart

```bash
docker compose build --pull
docker compose run --rm migrate
docker compose up -d --remove-orphans
```

The migration command must exit successfully. Never edit the Drizzle migration
history or mark a failed migration as applied manually.

## 5. Verify the release

```bash
docker compose ps
docker compose logs --tail=200 migrate api worker web
curl --fail https://api.example.com/v1/health
curl --fail --head https://app.example.com/login
```

Then verify sign-in, Admin, Portal, one queued Worker operation, uploaded file
access, email, billing, and every provider affected by the release notes.

## Rollback policy

Do not automatically reverse database migrations. First stop the application,
preserve logs, and assess whether the previous code is compatible with the
updated schema. If it is not, restore both the pre-update PostgreSQL backup and
the matching uploaded-files backup in a controlled maintenance window.

Never use `docker compose down --volumes` as a rollback command; it deletes the
local database, Redis state, and uploaded files.

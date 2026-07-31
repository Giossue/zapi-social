ALTER TABLE "users" ADD COLUMN "is_platform_admin" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION enforce_platform_admin_workspace_separation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  subject_user_id uuid;
  subject_is_platform_admin boolean;
BEGIN
  subject_user_id := CASE TG_TABLE_NAME
    WHEN 'users' THEN NEW.id
    WHEN 'workspaces' THEN NEW.owner_user_id
    WHEN 'workspace_memberships' THEN NEW.user_id
  END;

  PERFORM pg_advisory_xact_lock(hashtextextended(subject_user_id::text, 0));

  IF TG_TABLE_NAME = 'users' THEN
    IF NEW.is_platform_admin AND NOT OLD.is_platform_admin THEN
      IF EXISTS (
        SELECT 1 FROM workspace_memberships WHERE user_id = NEW.id
      ) OR EXISTS (
        SELECT 1 FROM workspaces WHERE owner_user_id = NEW.id
      ) THEN
        RAISE EXCEPTION 'PlatformAdmin users cannot own workspaces or have workspace memberships';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  SELECT is_platform_admin
  INTO subject_is_platform_admin
  FROM users
  WHERE id = subject_user_id;

  IF subject_is_platform_admin THEN
    RAISE EXCEPTION 'PlatformAdmin users cannot own workspaces or have workspace memberships';
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER users_enforce_platform_admin_workspace_separation
BEFORE UPDATE OF is_platform_admin ON "users"
FOR EACH ROW
EXECUTE FUNCTION enforce_platform_admin_workspace_separation();
--> statement-breakpoint
CREATE TRIGGER workspaces_enforce_platform_admin_workspace_separation
BEFORE INSERT OR UPDATE OF owner_user_id ON "workspaces"
FOR EACH ROW
EXECUTE FUNCTION enforce_platform_admin_workspace_separation();
--> statement-breakpoint
CREATE TRIGGER workspace_memberships_enforce_platform_admin_workspace_separation
BEFORE INSERT OR UPDATE OF user_id ON "workspace_memberships"
FOR EACH ROW
EXECUTE FUNCTION enforce_platform_admin_workspace_separation();
--> statement-breakpoint
UPDATE "auth_sessions"
SET "revoked_at" = NOW(), "updated_at" = NOW()
WHERE "revoked_at" IS NULL;

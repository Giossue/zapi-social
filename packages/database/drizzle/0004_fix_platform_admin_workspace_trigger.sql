CREATE OR REPLACE FUNCTION enforce_platform_admin_workspace_separation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  subject_user_id uuid;
  subject_is_platform_admin boolean;
BEGIN
  IF TG_TABLE_NAME = 'users' THEN
    subject_user_id := NEW.id;
  ELSIF TG_TABLE_NAME = 'workspaces' THEN
    subject_user_id := NEW.owner_user_id;
  ELSIF TG_TABLE_NAME = 'workspace_memberships' THEN
    subject_user_id := NEW.user_id;
  ELSE
    RAISE EXCEPTION 'Unsupported trigger table: %', TG_TABLE_NAME;
  END IF;

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

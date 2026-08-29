UPDATE "workspace_memberships"
SET "permissions" = COALESCE(
  (
    SELECT jsonb_agg(permission ORDER BY ordinal)
    FROM jsonb_array_elements_text("permissions") WITH ORDINALITY AS entries(permission, ordinal)
    WHERE permission NOT IN ('groups.view', 'groups.manage')
  ),
  '[]'::jsonb
)
WHERE "permissions" ?| ARRAY['groups.view', 'groups.manage'];--> statement-breakpoint
UPDATE "plans"
SET "permission_ids" = COALESCE(
  (
    SELECT jsonb_agg(permission ORDER BY ordinal)
    FROM jsonb_array_elements_text("permission_ids") WITH ORDINALITY AS entries(permission, ordinal)
    WHERE permission NOT IN ('groups.view', 'groups.manage')
  ),
  '[]'::jsonb
)
WHERE "permission_ids" ?| ARRAY['groups.view', 'groups.manage'];--> statement-breakpoint
UPDATE "plans"
SET "limits" = jsonb_set(
  "limits",
  '{enabledModules}',
  COALESCE(
    (
      SELECT jsonb_agg(module ORDER BY ordinal)
      FROM jsonb_array_elements_text("limits"->'enabledModules') WITH ORDINALITY AS entries(module, ordinal)
      WHERE module <> 'groups'
    ),
    '[]'::jsonb
  )
)
WHERE "limits"->'enabledModules' ? 'groups';--> statement-breakpoint
DELETE FROM "api_audit_logs"
WHERE "event" LIKE 'group.%'
  OR "subject_type" = 'group'
  OR "http_path" LIKE '/v1/portal/groups%';--> statement-breakpoint
DROP TABLE "account_group_social_accounts" CASCADE;--> statement-breakpoint
DROP TABLE "account_groups" CASCADE;

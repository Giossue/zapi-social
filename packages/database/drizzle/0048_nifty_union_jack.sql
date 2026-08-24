ALTER TABLE "workspace_invitations" ADD COLUMN "account_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace_invitations" ADD COLUMN "permissions" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
UPDATE "workspace_memberships" AS "membership"
SET
  "permissions" = (
    SELECT coalesce(jsonb_agg("permission" ORDER BY "permission"), '[]'::jsonb)
    FROM (
      SELECT DISTINCT jsonb_array_elements_text(
        coalesce("membership"."permissions", '[]'::jsonb) ||
        '["ai-publishing.view","ai-studio.manage","ai-studio.view","bulk-posts.manage","bulk-posts.view","captions.manage","captions.view","channels.view","files.manage","files.view","groups.view","link-bio.view","publishing.manage","publishing.view","rss-schedules.view","watermarks.view"]'::jsonb
      ) AS "permission"
    ) AS "effective_permissions"
  ),
  "updated_at" = now()
WHERE "membership"."role" = 'member' AND "membership"."status" = 'active';--> statement-breakpoint
UPDATE "workspace_invitations"
SET
  "permissions" = '["ai-publishing.view","ai-studio.manage","ai-studio.view","bulk-posts.manage","bulk-posts.view","captions.manage","captions.view","channels.view","files.manage","files.view","groups.view","link-bio.view","publishing.manage","publishing.view","rss-schedules.view","watermarks.view"]'::jsonb,
  "updated_at" = now()
WHERE "role" = 'member' AND "status" = 'pending' AND "permissions" = '[]'::jsonb;

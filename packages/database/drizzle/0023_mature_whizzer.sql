ALTER TABLE "workspace_invitations" ADD COLUMN "delivery_status" varchar(24) DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace_invitations" ADD COLUMN "last_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "member_limit" integer;--> statement-breakpoint
WITH "ranked_pending_invitations" AS (
	SELECT
		"id",
		row_number() OVER (
			PARTITION BY "workspace_id", "email_normalized"
			ORDER BY "created_at" DESC, "id" DESC
		) AS "position"
	FROM "workspace_invitations"
	WHERE "status" = 'pending'
)
UPDATE "workspace_invitations"
SET "status" = 'revoked', "updated_at" = now()
WHERE "id" IN (
	SELECT "id"
	FROM "ranked_pending_invitations"
	WHERE "position" > 1
);--> statement-breakpoint
UPDATE "workspace_invitations"
SET
	"delivery_status" = 'sent',
	"last_sent_at" = COALESCE("last_sent_at", "created_at")
WHERE "status" = 'pending' AND "delivery_status" = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_invitations_pending_email_unique" ON "workspace_invitations" USING btree ("workspace_id","email_normalized") WHERE "workspace_invitations"."status" = 'pending';--> statement-breakpoint
ALTER TABLE "workspace_invitations" ADD CONSTRAINT "workspace_invitations_delivery_status_check" CHECK ("workspace_invitations"."delivery_status" in ('pending', 'sent', 'failed'));--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_member_limit_check" CHECK ("workspaces"."member_limit" is null or "workspaces"."member_limit" > 0);

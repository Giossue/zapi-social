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
WHERE "status" = 'pending' AND "delivery_status" = 'pending';

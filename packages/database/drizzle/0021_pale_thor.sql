ALTER TABLE "publishing_post_attempts" DROP CONSTRAINT "publishing_post_attempts_publishing_post_id_publishing_posts_id_fk";
--> statement-breakpoint
ALTER TABLE "publishing_post_media" DROP CONSTRAINT "publishing_post_media_publishing_post_id_publishing_posts_id_fk";
--> statement-breakpoint
ALTER TABLE "publishing_post_media" DROP CONSTRAINT "publishing_post_media_file_asset_id_file_assets_id_fk";
--> statement-breakpoint
ALTER TABLE "publishing_posts" DROP CONSTRAINT "publishing_posts_social_account_id_social_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "workspace_credit_accounts" ALTER COLUMN "unlimited" SET DEFAULT false;--> statement-breakpoint
UPDATE "workspace_credit_accounts" SET "unlimited" = false WHERE "unlimited" = true;--> statement-breakpoint
ALTER TABLE "publishing_post_media" ADD COLUMN "workspace_id" uuid;--> statement-breakpoint
UPDATE "publishing_post_media" AS "media"
SET "workspace_id" = "posts"."workspace_id"
FROM "publishing_posts" AS "posts"
WHERE "posts"."id" = "media"."publishing_post_id";--> statement-breakpoint
ALTER TABLE "publishing_post_media" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "publishing_posts" ADD CONSTRAINT "publishing_posts_id_workspace_unique" UNIQUE("id","workspace_id");--> statement-breakpoint
ALTER TABLE "publishing_post_attempts" ADD CONSTRAINT "publishing_post_attempts_post_workspace_fk" FOREIGN KEY ("publishing_post_id","workspace_id") REFERENCES "public"."publishing_posts"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publishing_post_media" ADD CONSTRAINT "publishing_post_media_post_workspace_fk" FOREIGN KEY ("publishing_post_id","workspace_id") REFERENCES "public"."publishing_posts"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publishing_post_media" ADD CONSTRAINT "publishing_post_media_file_workspace_fk" FOREIGN KEY ("file_asset_id","workspace_id") REFERENCES "public"."file_assets"("id","workspace_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publishing_posts" ADD CONSTRAINT "publishing_posts_account_workspace_fk" FOREIGN KEY ("social_account_id","workspace_id") REFERENCES "public"."social_accounts"("id","workspace_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce_inventory_levels" ADD CONSTRAINT "commerce_inventory_levels_reserved_available_check" CHECK ("commerce_inventory_levels"."reserved" <= "commerce_inventory_levels"."available");

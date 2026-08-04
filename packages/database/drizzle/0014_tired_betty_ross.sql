ALTER TABLE "file_folders" ADD COLUMN "status" varchar(16) DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "file_folders" ADD COLUMN "trashed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "publishing_posts" ADD COLUMN "social_account_id" uuid;--> statement-breakpoint
ALTER TABLE "publishing_posts" ADD CONSTRAINT "publishing_posts_social_account_id_social_accounts_id_fk" FOREIGN KEY ("social_account_id") REFERENCES "public"."social_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "file_folders_workspace_status_updated_index" ON "file_folders" USING btree ("workspace_id","status","updated_at");--> statement-breakpoint
CREATE INDEX "publishing_posts_workspace_scheduled_index" ON "publishing_posts" USING btree ("workspace_id","scheduled_at");--> statement-breakpoint
CREATE INDEX "publishing_posts_social_account_index" ON "publishing_posts" USING btree ("social_account_id");
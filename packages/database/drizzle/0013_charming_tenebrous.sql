CREATE TABLE "publishing_post_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"publishing_post_id" uuid NOT NULL,
	"file_asset_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "publishing_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"author_user_id" uuid NOT NULL,
	"status" varchar(16) DEFAULT 'draft' NOT NULL,
	"content" varchar(10000) DEFAULT '' NOT NULL,
	"scheduled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "publishing_post_media" ADD CONSTRAINT "publishing_post_media_publishing_post_id_publishing_posts_id_fk" FOREIGN KEY ("publishing_post_id") REFERENCES "public"."publishing_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publishing_post_media" ADD CONSTRAINT "publishing_post_media_file_asset_id_file_assets_id_fk" FOREIGN KEY ("file_asset_id") REFERENCES "public"."file_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publishing_posts" ADD CONSTRAINT "publishing_posts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publishing_posts" ADD CONSTRAINT "publishing_posts_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "publishing_post_media_post_file_unique" ON "publishing_post_media" USING btree ("publishing_post_id","file_asset_id");--> statement-breakpoint
CREATE INDEX "publishing_post_media_file_index" ON "publishing_post_media" USING btree ("file_asset_id");--> statement-breakpoint
CREATE INDEX "publishing_posts_workspace_status_index" ON "publishing_posts" USING btree ("workspace_id","status");
CREATE TABLE "link_bio_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_id" uuid NOT NULL,
	"type" varchar(16) NOT NULL,
	"block_index" integer,
	"item_index" integer,
	"url" text,
	"ip_hash" varchar(64),
	"user_agent" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "link_bio_events_type_check" CHECK ("link_bio_events"."type" in ('view', 'click'))
);
--> statement-breakpoint
CREATE TABLE "link_bio_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"slug" varchar(160) NOT NULL,
	"title" varchar(160) NOT NULL,
	"headline" varchar(190) DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"template_key" varchar(60) DEFAULT 'aurora' NOT NULL,
	"avatar_file_asset_id" uuid,
	"cover_file_asset_id" uuid,
	"status" varchar(16) DEFAULT 'draft' NOT NULL,
	"blocks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"appearance" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "link_bio_pages_status_check" CHECK ("link_bio_pages"."status" in ('draft', 'published'))
);
--> statement-breakpoint
ALTER TABLE "link_bio_events" ADD CONSTRAINT "link_bio_events_page_id_link_bio_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."link_bio_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "link_bio_pages" ADD CONSTRAINT "link_bio_pages_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "link_bio_pages" ADD CONSTRAINT "link_bio_pages_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "link_bio_pages" ADD CONSTRAINT "link_bio_pages_avatar_file_asset_id_file_assets_id_fk" FOREIGN KEY ("avatar_file_asset_id") REFERENCES "public"."file_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "link_bio_pages" ADD CONSTRAINT "link_bio_pages_cover_file_asset_id_file_assets_id_fk" FOREIGN KEY ("cover_file_asset_id") REFERENCES "public"."file_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "link_bio_events_page_type_idx" ON "link_bio_events" USING btree ("page_id","type");--> statement-breakpoint
CREATE INDEX "link_bio_events_page_target_idx" ON "link_bio_events" USING btree ("page_id","block_index","item_index");--> statement-breakpoint
CREATE UNIQUE INDEX "link_bio_pages_slug_unique" ON "link_bio_pages" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "link_bio_pages_workspace_idx" ON "link_bio_pages" USING btree ("workspace_id");
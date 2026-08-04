ALTER TABLE "file_assets" ADD COLUMN "extension" varchar(16);--> statement-breakpoint
ALTER TABLE "file_assets" ADD COLUMN "width" integer;--> statement-breakpoint
ALTER TABLE "file_assets" ADD COLUMN "height" integer;--> statement-breakpoint
ALTER TABLE "file_assets" ADD COLUMN "thumbnail_key" varchar(512);--> statement-breakpoint
ALTER TABLE "file_assets" ADD COLUMN "thumbnail_status" varchar(16) DEFAULT 'not_applicable' NOT NULL;--> statement-breakpoint
ALTER TABLE "file_assets" ADD COLUMN "thumbnail_error_code" varchar(64);--> statement-breakpoint
CREATE INDEX "file_assets_workspace_thumbnail_index" ON "file_assets" USING btree ("workspace_id","thumbnail_status");
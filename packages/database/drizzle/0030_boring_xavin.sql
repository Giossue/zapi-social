CREATE TABLE "file_import_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"requested_by_user_id" uuid NOT NULL,
	"provider_key" varchar(64) NOT NULL,
	"source_context" varchar(24) NOT NULL,
	"destination_folder_id" uuid,
	"status" varchar(24) DEFAULT 'pending' NOT NULL,
	"encrypted_access_token" text,
	"credential_expires_at" timestamp with time zone NOT NULL,
	"idempotency_key" varchar(160) NOT NULL,
	"total_items" integer NOT NULL,
	"completed_items" integer DEFAULT 0 NOT NULL,
	"failed_items" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "file_import_batches_counts_check" CHECK ("file_import_batches"."total_items" > 0 and "file_import_batches"."completed_items" >= 0 and "file_import_batches"."failed_items" >= 0 and "file_import_batches"."completed_items" + "file_import_batches"."failed_items" <= "file_import_batches"."total_items")
);
--> statement-breakpoint
CREATE TABLE "file_import_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"provider_file_id_ciphertext" text,
	"provider_file_id_hash" varchar(64) NOT NULL,
	"resource_key_ciphertext" text,
	"status" varchar(24) DEFAULT 'pending' NOT NULL,
	"file_asset_id" uuid,
	"file_asset_workspace_id" uuid,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"error_code" varchar(96),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "file_import_items_asset_workspace_check" CHECK (("file_import_items"."file_asset_id" is null and "file_import_items"."file_asset_workspace_id" is null) or ("file_import_items"."file_asset_id" is not null and "file_import_items"."file_asset_workspace_id" = "file_import_items"."workspace_id")),
	CONSTRAINT "file_import_items_attempt_count_check" CHECK ("file_import_items"."attempt_count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "file_import_batches" ADD CONSTRAINT "file_import_batches_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_import_batches" ADD CONSTRAINT "file_import_batches_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_import_batches" ADD CONSTRAINT "file_import_batches_destination_folder_id_file_folders_id_fk" FOREIGN KEY ("destination_folder_id") REFERENCES "public"."file_folders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_import_items" ADD CONSTRAINT "file_import_items_batch_id_file_import_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."file_import_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_import_items" ADD CONSTRAINT "file_import_items_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_import_items" ADD CONSTRAINT "file_import_items_asset_workspace_fk" FOREIGN KEY ("file_asset_id","file_asset_workspace_id") REFERENCES "public"."file_assets"("id","workspace_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "file_import_batches_request_idempotency_unique" ON "file_import_batches" USING btree ("workspace_id","requested_by_user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "file_import_batches_workspace_status_updated_index" ON "file_import_batches" USING btree ("workspace_id","status","updated_at");--> statement-breakpoint
CREATE INDEX "file_import_batches_status_expiry_index" ON "file_import_batches" USING btree ("status","credential_expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "file_import_items_batch_provider_file_unique" ON "file_import_items" USING btree ("batch_id","provider_file_id_hash");--> statement-breakpoint
CREATE INDEX "file_import_items_batch_status_index" ON "file_import_items" USING btree ("batch_id","status");
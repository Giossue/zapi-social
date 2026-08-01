CREATE TABLE "channel_connection_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"capability_key" varchar(64) NOT NULL,
	"social_account_id" uuid,
	"user_id" uuid NOT NULL,
	"reconnect_account_id" uuid,
	"status" varchar(24) DEFAULT 'authorizing' NOT NULL,
	"external_connection_id" varchar(255),
	"context_ciphertext" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_connection_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_connection_session_id" uuid NOT NULL,
	"external_id" varchar(512) NOT NULL,
	"display_name" varchar(255) NOT NULL,
	"description" varchar(500) NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "provider_integrations" ADD COLUMN "enabled_capability_keys" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "provider_integrations" ADD COLUMN "config_version" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "provider_integrations" ADD COLUMN "readiness_issues" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "provider_integrations" ADD COLUMN "tested_config_fingerprint" varchar(128);
--> statement-breakpoint
ALTER TABLE "provider_integrations" ADD COLUMN "last_tested_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "provider_integrations" ADD COLUMN "last_tested_by_platform_admin_id" uuid;
--> statement-breakpoint
ALTER TABLE "social_accounts" ADD COLUMN "connected_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "social_accounts" ADD COLUMN "disconnected_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "channel_connection_sessions" ADD CONSTRAINT "channel_connection_sessions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "channel_connection_sessions" ADD CONSTRAINT "channel_connection_sessions_social_account_id_social_accounts_id_fk" FOREIGN KEY ("social_account_id") REFERENCES "public"."social_accounts"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "channel_connection_sessions" ADD CONSTRAINT "channel_connection_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "channel_connection_sessions" ADD CONSTRAINT "channel_connection_sessions_reconnect_account_id_social_accounts_id_fk" FOREIGN KEY ("reconnect_account_id") REFERENCES "public"."social_accounts"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "channel_connection_candidates" ADD CONSTRAINT "channel_connection_candidates_channel_connection_session_id_channel_connection_sessions_id_fk" FOREIGN KEY ("channel_connection_session_id") REFERENCES "public"."channel_connection_sessions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "provider_integrations" ADD CONSTRAINT "provider_integrations_last_tested_by_platform_admin_id_users_id_fk" FOREIGN KEY ("last_tested_by_platform_admin_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "channel_connection_sessions_workspace_status_index" ON "channel_connection_sessions" USING btree ("workspace_id","status");
--> statement-breakpoint
CREATE INDEX "channel_connection_sessions_expiry_index" ON "channel_connection_sessions" USING btree ("expires_at");
--> statement-breakpoint
CREATE INDEX "channel_connection_sessions_social_account_index" ON "channel_connection_sessions" USING btree ("social_account_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "channel_connection_candidates_session_external_unique" ON "channel_connection_candidates" USING btree ("channel_connection_session_id","external_id");
--> statement-breakpoint
CREATE INDEX "channel_connection_candidates_session_index" ON "channel_connection_candidates" USING btree ("channel_connection_session_id");

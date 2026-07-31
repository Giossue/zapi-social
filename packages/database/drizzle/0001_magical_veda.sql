CREATE TABLE "channel_oauth_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"state_hash" varchar(128) NOT NULL,
	"provider_key" varchar(64) NOT NULL,
	"user_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"pkce_verifier_ciphertext" text,
	"reconnect_account_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"social_account_id" uuid NOT NULL,
	"status" varchar(24) DEFAULT 'pending' NOT NULL,
	"job_id" varchar(128),
	"request_id" varchar(128),
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"error_code" varchar(96),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_key" varchar(64) NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"readiness" varchar(24) DEFAULT 'unconfigured' NOT NULL,
	"capabilities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"configuration_ciphertext" text,
	"updated_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_account_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"social_account_id" uuid NOT NULL,
	"access_token_ciphertext" text,
	"refresh_token_ciphertext" text,
	"expires_at" timestamp with time zone,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"encryption_key_version" varchar(64) DEFAULT 'v1' NOT NULL,
	"rotated_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_account_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"social_account_id" uuid NOT NULL,
	"workspace_membership_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"provider_key" varchar(64) NOT NULL,
	"capability_key" varchar(64) NOT NULL,
	"external_id" varchar(255),
	"display_name" varchar(255) NOT NULL,
	"handle" varchar(255),
	"profile_url" text,
	"avatar_url" text,
	"status" varchar(24) DEFAULT 'active' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "channel_oauth_states" ADD CONSTRAINT "channel_oauth_states_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_oauth_states" ADD CONSTRAINT "channel_oauth_states_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_oauth_states" ADD CONSTRAINT "channel_oauth_states_reconnect_account_id_social_accounts_id_fk" FOREIGN KEY ("reconnect_account_id") REFERENCES "public"."social_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_sync_runs" ADD CONSTRAINT "channel_sync_runs_social_account_id_social_accounts_id_fk" FOREIGN KEY ("social_account_id") REFERENCES "public"."social_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_integrations" ADD CONSTRAINT "provider_integrations_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_account_credentials" ADD CONSTRAINT "social_account_credentials_social_account_id_social_accounts_id_fk" FOREIGN KEY ("social_account_id") REFERENCES "public"."social_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_account_memberships" ADD CONSTRAINT "social_account_memberships_social_account_id_social_accounts_id_fk" FOREIGN KEY ("social_account_id") REFERENCES "public"."social_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_account_memberships" ADD CONSTRAINT "social_account_memberships_workspace_membership_id_workspace_memberships_id_fk" FOREIGN KEY ("workspace_membership_id") REFERENCES "public"."workspace_memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "channel_oauth_states_state_hash_unique" ON "channel_oauth_states" USING btree ("state_hash");--> statement-breakpoint
CREATE INDEX "channel_oauth_states_expiry_index" ON "channel_oauth_states" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "channel_oauth_states_workspace_provider_index" ON "channel_oauth_states" USING btree ("workspace_id","provider_key");--> statement-breakpoint
CREATE INDEX "channel_sync_runs_account_created_index" ON "channel_sync_runs" USING btree ("social_account_id","created_at");--> statement-breakpoint
CREATE INDEX "channel_sync_runs_status_created_index" ON "channel_sync_runs" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "channel_sync_runs_job_id_index" ON "channel_sync_runs" USING btree ("job_id");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_integrations_provider_key_unique" ON "provider_integrations" USING btree ("provider_key");--> statement-breakpoint
CREATE INDEX "provider_integrations_enabled_readiness_index" ON "provider_integrations" USING btree ("enabled","readiness");--> statement-breakpoint
CREATE UNIQUE INDEX "social_account_credentials_social_account_unique" ON "social_account_credentials" USING btree ("social_account_id");--> statement-breakpoint
CREATE INDEX "social_account_credentials_expiry_index" ON "social_account_credentials" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "social_account_memberships_account_membership_unique" ON "social_account_memberships" USING btree ("social_account_id","workspace_membership_id");--> statement-breakpoint
CREATE INDEX "social_account_memberships_membership_index" ON "social_account_memberships" USING btree ("workspace_membership_id");--> statement-breakpoint
CREATE UNIQUE INDEX "social_accounts_workspace_provider_capability_external_unique" ON "social_accounts" USING btree ("workspace_id","provider_key","capability_key","external_id") WHERE "social_accounts"."external_id" is not null;--> statement-breakpoint
CREATE INDEX "social_accounts_workspace_status_index" ON "social_accounts" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "social_accounts_workspace_provider_index" ON "social_accounts" USING btree ("workspace_id","provider_key");
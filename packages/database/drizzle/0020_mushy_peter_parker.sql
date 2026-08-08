CREATE TABLE "account_group_social_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"social_account_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"slug" varchar(140) NOT NULL,
	"description" varchar(1000) DEFAULT '' NOT NULL,
	"color" varchar(7) DEFAULT '#2563eb' NOT NULL,
	"status" varchar(16) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_groups_id_workspace_unique" UNIQUE("id","workspace_id"),
	CONSTRAINT "account_groups_status_check" CHECK ("account_groups"."status" in ('active', 'inactive')),
	CONSTRAINT "account_groups_color_check" CHECK ("account_groups"."color" ~ '^#[0-9a-f]{6}$')
);
--> statement-breakpoint
CREATE TABLE "affiliate_commissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"affiliate_profile_id" uuid NOT NULL,
	"referral_id" uuid,
	"commerce_order_id" uuid,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"amount_minor" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"eligible_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "affiliate_commissions_status_check" CHECK ("affiliate_commissions"."status" in ('pending', 'available', 'paid', 'cancelled')),
	CONSTRAINT "affiliate_commissions_amount_check" CHECK ("affiliate_commissions"."amount_minor" > 0)
);
--> statement-breakpoint
CREATE TABLE "affiliate_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"code" varchar(48) NOT NULL,
	"status" varchar(16) DEFAULT 'active' NOT NULL,
	"commission_rate_bps" integer DEFAULT 1000 NOT NULL,
	"payout_currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "affiliate_profiles_status_check" CHECK ("affiliate_profiles"."status" in ('active', 'suspended')),
	CONSTRAINT "affiliate_profiles_rate_check" CHECK ("affiliate_profiles"."commission_rate_bps" >= 0 and "affiliate_profiles"."commission_rate_bps" <= 10000)
);
--> statement-breakpoint
CREATE TABLE "affiliate_referral_visits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"affiliate_profile_id" uuid NOT NULL,
	"referral_id" uuid NOT NULL,
	"fingerprint_hash" varchar(128),
	"referrer" varchar(1000),
	"user_agent" varchar(1000),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "affiliate_referrals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"affiliate_profile_id" uuid NOT NULL,
	"referred_user_id" uuid,
	"status" varchar(16) DEFAULT 'visited' NOT NULL,
	"source" varchar(120),
	"landing_path" varchar(500),
	"converted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "affiliate_referrals_status_check" CHECK ("affiliate_referrals"."status" in ('visited', 'registered', 'converted', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "affiliate_withdrawals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"affiliate_profile_id" uuid NOT NULL,
	"requested_by_user_id" uuid NOT NULL,
	"reviewed_by_user_id" uuid,
	"status" varchar(16) DEFAULT 'requested' NOT NULL,
	"amount_minor" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"payment_reference" varchar(255),
	"notes" varchar(1000),
	"reviewed_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "affiliate_withdrawals_status_check" CHECK ("affiliate_withdrawals"."status" in ('requested', 'approved', 'paid', 'rejected')),
	CONSTRAINT "affiliate_withdrawals_amount_check" CHECK ("affiliate_withdrawals"."amount_minor" > 0)
);
--> statement-breakpoint
CREATE TABLE "ai_publishing_schedule_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"schedule_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"social_account_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_publishing_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"name" varchar(160) NOT NULL,
	"prompt" text NOT NULL,
	"status" varchar(16) DEFAULT 'draft' NOT NULL,
	"frequency" varchar(16) DEFAULT 'daily' NOT NULL,
	"timezone" varchar(64) NOT NULL,
	"preferred_time" varchar(5) NOT NULL,
	"weekdays" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tone" varchar(80) DEFAULT 'cercano' NOT NULL,
	"next_run_at" timestamp with time zone,
	"last_run_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_publishing_schedules_id_workspace_unique" UNIQUE("id","workspace_id"),
	CONSTRAINT "ai_publishing_schedules_status_check" CHECK ("ai_publishing_schedules"."status" in ('draft', 'active', 'paused')),
	CONSTRAINT "ai_publishing_schedules_frequency_check" CHECK ("ai_publishing_schedules"."frequency" in ('daily', 'weekly')),
	CONSTRAINT "ai_publishing_schedules_time_check" CHECK ("ai_publishing_schedules"."preferred_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
);
--> statement-breakpoint
CREATE TABLE "ai_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"requested_by_user_id" uuid NOT NULL,
	"kind" varchar(32) NOT NULL,
	"status" varchar(16) DEFAULT 'queued' NOT NULL,
	"prompt" text NOT NULL,
	"input" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"result" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"provider" varchar(64),
	"model" varchar(160),
	"cost_units" integer DEFAULT 0 NOT NULL,
	"idempotency_key" varchar(160) NOT NULL,
	"job_id" varchar(128),
	"source" varchar(32) DEFAULT 'portal' NOT NULL,
	"error_code" varchar(96),
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_requests_kind_check" CHECK ("ai_requests"."kind" in ('content', 'image', 'repurpose', 'planner', 'review', 'timing', 'search', 'ai_publishing')),
	CONSTRAINT "ai_requests_status_check" CHECK ("ai_requests"."status" in ('queued', 'processing', 'succeeded', 'failed', 'cancelled')),
	CONSTRAINT "ai_requests_cost_check" CHECK ("ai_requests"."cost_units" >= 0)
);
--> statement-breakpoint
CREATE TABLE "ai_user_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"default_tone" varchar(80),
	"language" varchar(16),
	"preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_workspace_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"preferred_provider" varchar(64) DEFAULT 'openai-compatible' NOT NULL,
	"preferred_text_model" varchar(160),
	"preferred_image_model" varchar(160),
	"brand_voice" varchar(5000) DEFAULT '' NOT NULL,
	"default_tone" varchar(80) DEFAULT 'cercano' NOT NULL,
	"language" varchar(16) DEFAULT 'es' NOT NULL,
	"enforce_credits" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automation_api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"token_prefix" varchar(20) NOT NULL,
	"token_hash" varchar(128) NOT NULL,
	"permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" varchar(16) DEFAULT 'active' NOT NULL,
	"last_used_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "automation_api_keys_status_check" CHECK ("automation_api_keys"."status" in ('active', 'revoked'))
);
--> statement-breakpoint
CREATE TABLE "automation_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"api_key_id" uuid,
	"webhook_id" uuid,
	"direction" varchar(16) NOT NULL,
	"event" varchar(96) NOT NULL,
	"request_id" varchar(128),
	"status" varchar(16) NOT NULL,
	"status_code" integer,
	"summary" varchar(500),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "automation_logs_direction_check" CHECK ("automation_logs"."direction" in ('inbound', 'outbound')),
	CONSTRAINT "automation_logs_status_check" CHECK ("automation_logs"."status" in ('accepted', 'succeeded', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "automation_webhook_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"webhook_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"event" varchar(96) NOT NULL,
	"idempotency_key" varchar(160) NOT NULL,
	"payload" jsonb NOT NULL,
	"status" varchar(16) DEFAULT 'queued' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"response_status" integer,
	"error_code" varchar(96),
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automation_webhooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"url" text NOT NULL,
	"signing_secret_ciphertext" text NOT NULL,
	"events" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_sent_at" timestamp with time zone,
	"last_status_code" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "automation_webhooks_id_workspace_unique" UNIQUE("id","workspace_id")
);
--> statement-breakpoint
CREATE TABLE "bulk_post_batch_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"social_account_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bulk_post_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"source_file_asset_id" uuid NOT NULL,
	"status" varchar(16) DEFAULT 'queued' NOT NULL,
	"interval_minutes" integer DEFAULT 60 NOT NULL,
	"timezone" varchar(64) DEFAULT 'UTC' NOT NULL,
	"job_id" varchar(128),
	"total_rows" integer DEFAULT 0 NOT NULL,
	"valid_rows" integer DEFAULT 0 NOT NULL,
	"invalid_rows" integer DEFAULT 0 NOT NULL,
	"created_posts" integer DEFAULT 0 NOT NULL,
	"failed_rows" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"error_code" varchar(96),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bulk_post_batches_id_workspace_unique" UNIQUE("id","workspace_id"),
	CONSTRAINT "bulk_post_batches_status_check" CHECK ("bulk_post_batches"."status" in ('queued', 'processing', 'completed', 'failed', 'cancelled')),
	CONSTRAINT "bulk_post_batches_interval_check" CHECK ("bulk_post_batches"."interval_minutes" between 1 and 10080)
);
--> statement-breakpoint
CREATE TABLE "bulk_post_row_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bulk_post_row_id" uuid NOT NULL,
	"publishing_post_id" uuid NOT NULL,
	"social_account_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bulk_post_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"row_number" integer NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"validation_errors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bulk_post_rows_status_check" CHECK ("bulk_post_rows"."status" in ('pending', 'valid', 'invalid', 'processed', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "commerce_inventory_levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"available" integer DEFAULT 0 NOT NULL,
	"reserved" integer DEFAULT 0 NOT NULL,
	"low_stock_threshold" integer DEFAULT 5 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commerce_inventory_levels_nonnegative_check" CHECK ("commerce_inventory_levels"."available" >= 0 and "commerce_inventory_levels"."reserved" >= 0 and "commerce_inventory_levels"."low_stock_threshold" >= 0)
);
--> statement-breakpoint
CREATE TABLE "commerce_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"commerce_order_id" uuid NOT NULL,
	"product_id" uuid,
	"name" varchar(240) NOT NULL,
	"sku" varchar(96) NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price_minor" integer NOT NULL,
	"total_minor" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commerce_order_items_amount_check" CHECK ("commerce_order_items"."quantity" > 0 and "commerce_order_items"."unit_price_minor" >= 0 and "commerce_order_items"."total_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "commerce_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_by_user_id" uuid,
	"customer_name" varchar(240) NOT NULL,
	"customer_email" varchar(320),
	"channel" varchar(16) NOT NULL,
	"status" varchar(16) DEFAULT 'processing' NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"total_minor" integer DEFAULT 0 NOT NULL,
	"external_reference" varchar(255),
	"ordered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commerce_orders_id_workspace_unique" UNIQUE("id","workspace_id"),
	CONSTRAINT "commerce_orders_channel_check" CHECK ("commerce_orders"."channel" in ('social', 'store', 'marketplace')),
	CONSTRAINT "commerce_orders_status_check" CHECK ("commerce_orders"."status" in ('processing', 'completed', 'attention', 'cancelled')),
	CONSTRAINT "commerce_orders_total_check" CHECK ("commerce_orders"."total_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "commerce_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"name" varchar(240) NOT NULL,
	"sku" varchar(96) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" varchar(16) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commerce_products_id_workspace_unique" UNIQUE("id","workspace_id"),
	CONSTRAINT "commerce_products_status_check" CHECK ("commerce_products"."status" in ('active', 'inactive'))
);
--> statement-breakpoint
CREATE TABLE "commerce_return_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"commerce_order_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"status" varchar(16) DEFAULT 'requested' NOT NULL,
	"amount_minor" integer DEFAULT 0 NOT NULL,
	"reason" varchar(1000) DEFAULT '' NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commerce_return_requests_status_check" CHECK ("commerce_return_requests"."status" in ('requested', 'approved', 'rejected', 'completed')),
	CONSTRAINT "commerce_return_requests_amount_check" CHECK ("commerce_return_requests"."amount_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "credit_ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"ai_request_id" uuid,
	"type" varchar(16) NOT NULL,
	"action" varchar(96) NOT NULL,
	"units" integer NOT NULL,
	"idempotency_key" varchar(200) NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_ledger_entries_type_check" CHECK ("credit_ledger_entries"."type" in ('grant', 'debit', 'refund', 'adjustment')),
	CONSTRAINT "credit_ledger_entries_units_check" CHECK ("credit_ledger_entries"."units" <> 0)
);
--> statement-breakpoint
CREATE TABLE "publishing_post_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"publishing_post_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"attempt_number" integer NOT NULL,
	"status" varchar(16) DEFAULT 'queued' NOT NULL,
	"job_id" varchar(128) NOT NULL,
	"provider_request_id" varchar(512),
	"response" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error_code" varchar(96),
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "publishing_post_attempts_status_check" CHECK ("publishing_post_attempts"."status" in ('queued', 'processing', 'succeeded', 'failed')),
	CONSTRAINT "publishing_post_attempts_number_check" CHECK ("publishing_post_attempts"."attempt_number" > 0)
);
--> statement-breakpoint
CREATE TABLE "workspace_credit_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"balance_units" integer DEFAULT 0 NOT NULL,
	"unlimited" boolean DEFAULT true NOT NULL,
	"cycle_started_at" timestamp with time zone,
	"cycle_ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_credit_accounts_balance_check" CHECK ("workspace_credit_accounts"."balance_units" >= 0)
);
--> statement-breakpoint
ALTER TABLE "file_assets" ADD COLUMN "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "publishing_posts" ADD COLUMN "source" varchar(32) DEFAULT 'portal' NOT NULL;--> statement-breakpoint
ALTER TABLE "publishing_posts" ADD COLUMN "external_reference" varchar(255);--> statement-breakpoint
ALTER TABLE "publishing_posts" ADD COLUMN "network_options" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "publishing_posts" ADD COLUMN "provider_result" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "publishing_posts" ADD COLUMN "failure_code" varchar(96);--> statement-breakpoint
ALTER TABLE "publishing_posts" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "account_group_social_accounts" ADD CONSTRAINT "account_group_social_accounts_group_workspace_fk" FOREIGN KEY ("group_id","workspace_id") REFERENCES "public"."account_groups"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_group_social_accounts" ADD CONSTRAINT "account_group_social_accounts_account_workspace_fk" FOREIGN KEY ("social_account_id","workspace_id") REFERENCES "public"."social_accounts"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_groups" ADD CONSTRAINT "account_groups_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_groups" ADD CONSTRAINT "account_groups_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_commissions" ADD CONSTRAINT "affiliate_commissions_affiliate_profile_id_affiliate_profiles_id_fk" FOREIGN KEY ("affiliate_profile_id") REFERENCES "public"."affiliate_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_commissions" ADD CONSTRAINT "affiliate_commissions_referral_id_affiliate_referrals_id_fk" FOREIGN KEY ("referral_id") REFERENCES "public"."affiliate_referrals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_commissions" ADD CONSTRAINT "affiliate_commissions_commerce_order_id_commerce_orders_id_fk" FOREIGN KEY ("commerce_order_id") REFERENCES "public"."commerce_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_profiles" ADD CONSTRAINT "affiliate_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_referral_visits" ADD CONSTRAINT "affiliate_referral_visits_affiliate_profile_id_affiliate_profiles_id_fk" FOREIGN KEY ("affiliate_profile_id") REFERENCES "public"."affiliate_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_referral_visits" ADD CONSTRAINT "affiliate_referral_visits_referral_id_affiliate_referrals_id_fk" FOREIGN KEY ("referral_id") REFERENCES "public"."affiliate_referrals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_referrals" ADD CONSTRAINT "affiliate_referrals_affiliate_profile_id_affiliate_profiles_id_fk" FOREIGN KEY ("affiliate_profile_id") REFERENCES "public"."affiliate_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_referrals" ADD CONSTRAINT "affiliate_referrals_referred_user_id_users_id_fk" FOREIGN KEY ("referred_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_withdrawals" ADD CONSTRAINT "affiliate_withdrawals_affiliate_profile_id_affiliate_profiles_id_fk" FOREIGN KEY ("affiliate_profile_id") REFERENCES "public"."affiliate_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_withdrawals" ADD CONSTRAINT "affiliate_withdrawals_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_withdrawals" ADD CONSTRAINT "affiliate_withdrawals_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_publishing_schedule_targets" ADD CONSTRAINT "ai_publishing_schedule_targets_schedule_workspace_fk" FOREIGN KEY ("schedule_id","workspace_id") REFERENCES "public"."ai_publishing_schedules"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_publishing_schedule_targets" ADD CONSTRAINT "ai_publishing_schedule_targets_account_workspace_fk" FOREIGN KEY ("social_account_id","workspace_id") REFERENCES "public"."social_accounts"("id","workspace_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_publishing_schedules" ADD CONSTRAINT "ai_publishing_schedules_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_publishing_schedules" ADD CONSTRAINT "ai_publishing_schedules_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_user_settings" ADD CONSTRAINT "ai_user_settings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_user_settings" ADD CONSTRAINT "ai_user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_workspace_settings" ADD CONSTRAINT "ai_workspace_settings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_workspace_settings" ADD CONSTRAINT "ai_workspace_settings_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_api_keys" ADD CONSTRAINT "automation_api_keys_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_api_keys" ADD CONSTRAINT "automation_api_keys_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_logs" ADD CONSTRAINT "automation_logs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_logs" ADD CONSTRAINT "automation_logs_api_key_id_automation_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."automation_api_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_logs" ADD CONSTRAINT "automation_logs_webhook_id_automation_webhooks_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "public"."automation_webhooks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_webhook_deliveries" ADD CONSTRAINT "automation_webhook_deliveries_webhook_workspace_fk" FOREIGN KEY ("webhook_id","workspace_id") REFERENCES "public"."automation_webhooks"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_webhooks" ADD CONSTRAINT "automation_webhooks_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_webhooks" ADD CONSTRAINT "automation_webhooks_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulk_post_batch_targets" ADD CONSTRAINT "bulk_post_batch_targets_batch_workspace_fk" FOREIGN KEY ("batch_id","workspace_id") REFERENCES "public"."bulk_post_batches"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulk_post_batch_targets" ADD CONSTRAINT "bulk_post_batch_targets_account_workspace_fk" FOREIGN KEY ("social_account_id","workspace_id") REFERENCES "public"."social_accounts"("id","workspace_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulk_post_batches" ADD CONSTRAINT "bulk_post_batches_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulk_post_batches" ADD CONSTRAINT "bulk_post_batches_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulk_post_batches" ADD CONSTRAINT "bulk_post_batches_source_file_workspace_fk" FOREIGN KEY ("source_file_asset_id","workspace_id") REFERENCES "public"."file_assets"("id","workspace_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulk_post_row_posts" ADD CONSTRAINT "bulk_post_row_posts_bulk_post_row_id_bulk_post_rows_id_fk" FOREIGN KEY ("bulk_post_row_id") REFERENCES "public"."bulk_post_rows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulk_post_row_posts" ADD CONSTRAINT "bulk_post_row_posts_publishing_post_id_publishing_posts_id_fk" FOREIGN KEY ("publishing_post_id") REFERENCES "public"."publishing_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulk_post_row_posts" ADD CONSTRAINT "bulk_post_row_posts_social_account_id_social_accounts_id_fk" FOREIGN KEY ("social_account_id") REFERENCES "public"."social_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulk_post_rows" ADD CONSTRAINT "bulk_post_rows_batch_workspace_fk" FOREIGN KEY ("batch_id","workspace_id") REFERENCES "public"."bulk_post_batches"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce_inventory_levels" ADD CONSTRAINT "commerce_inventory_levels_product_workspace_fk" FOREIGN KEY ("product_id","workspace_id") REFERENCES "public"."commerce_products"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce_order_items" ADD CONSTRAINT "commerce_order_items_commerce_order_id_commerce_orders_id_fk" FOREIGN KEY ("commerce_order_id") REFERENCES "public"."commerce_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce_order_items" ADD CONSTRAINT "commerce_order_items_product_id_commerce_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."commerce_products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce_orders" ADD CONSTRAINT "commerce_orders_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce_orders" ADD CONSTRAINT "commerce_orders_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce_products" ADD CONSTRAINT "commerce_products_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce_products" ADD CONSTRAINT "commerce_products_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commerce_return_requests" ADD CONSTRAINT "commerce_return_requests_order_workspace_fk" FOREIGN KEY ("commerce_order_id","workspace_id") REFERENCES "public"."commerce_orders"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger_entries" ADD CONSTRAINT "credit_ledger_entries_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger_entries" ADD CONSTRAINT "credit_ledger_entries_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger_entries" ADD CONSTRAINT "credit_ledger_entries_ai_request_id_ai_requests_id_fk" FOREIGN KEY ("ai_request_id") REFERENCES "public"."ai_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publishing_post_attempts" ADD CONSTRAINT "publishing_post_attempts_publishing_post_id_publishing_posts_id_fk" FOREIGN KEY ("publishing_post_id") REFERENCES "public"."publishing_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publishing_post_attempts" ADD CONSTRAINT "publishing_post_attempts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_credit_accounts" ADD CONSTRAINT "workspace_credit_accounts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_group_social_accounts_group_account_unique" ON "account_group_social_accounts" USING btree ("group_id","social_account_id");--> statement-breakpoint
CREATE INDEX "account_group_social_accounts_workspace_account_index" ON "account_group_social_accounts" USING btree ("workspace_id","social_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "account_groups_workspace_slug_unique" ON "account_groups" USING btree ("workspace_id","slug");--> statement-breakpoint
CREATE INDEX "account_groups_workspace_status_updated_index" ON "account_groups" USING btree ("workspace_id","status","updated_at");--> statement-breakpoint
CREATE INDEX "affiliate_commissions_profile_status_created_index" ON "affiliate_commissions" USING btree ("affiliate_profile_id","status","created_at");--> statement-breakpoint
CREATE INDEX "affiliate_commissions_order_index" ON "affiliate_commissions" USING btree ("commerce_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "affiliate_commissions_order_unique" ON "affiliate_commissions" USING btree ("commerce_order_id") WHERE "affiliate_commissions"."commerce_order_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "affiliate_profiles_user_unique" ON "affiliate_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "affiliate_profiles_code_unique" ON "affiliate_profiles" USING btree ("code");--> statement-breakpoint
CREATE INDEX "affiliate_profiles_status_created_index" ON "affiliate_profiles" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "affiliate_referral_visits_profile_created_index" ON "affiliate_referral_visits" USING btree ("affiliate_profile_id","created_at");--> statement-breakpoint
CREATE INDEX "affiliate_referral_visits_referral_created_index" ON "affiliate_referral_visits" USING btree ("referral_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "affiliate_referrals_referred_user_unique" ON "affiliate_referrals" USING btree ("referred_user_id") WHERE "affiliate_referrals"."referred_user_id" is not null;--> statement-breakpoint
CREATE INDEX "affiliate_referrals_profile_status_created_index" ON "affiliate_referrals" USING btree ("affiliate_profile_id","status","created_at");--> statement-breakpoint
CREATE INDEX "affiliate_withdrawals_profile_status_created_index" ON "affiliate_withdrawals" USING btree ("affiliate_profile_id","status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_publishing_schedule_targets_schedule_account_unique" ON "ai_publishing_schedule_targets" USING btree ("schedule_id","social_account_id");--> statement-breakpoint
CREATE INDEX "ai_publishing_schedules_status_next_run_index" ON "ai_publishing_schedules" USING btree ("status","next_run_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_requests_workspace_user_idempotency_unique" ON "ai_requests" USING btree ("workspace_id","requested_by_user_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_requests_id_workspace_unique" ON "ai_requests" USING btree ("id","workspace_id");--> statement-breakpoint
CREATE INDEX "ai_requests_workspace_kind_created_index" ON "ai_requests" USING btree ("workspace_id","kind","created_at");--> statement-breakpoint
CREATE INDEX "ai_requests_workspace_status_created_index" ON "ai_requests" USING btree ("workspace_id","status","created_at");--> statement-breakpoint
CREATE INDEX "ai_requests_job_id_index" ON "ai_requests" USING btree ("job_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_user_settings_workspace_user_unique" ON "ai_user_settings" USING btree ("workspace_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_workspace_settings_workspace_unique" ON "ai_workspace_settings" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "automation_api_keys_token_hash_unique" ON "automation_api_keys" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "automation_api_keys_workspace_status_created_index" ON "automation_api_keys" USING btree ("workspace_id","status","created_at");--> statement-breakpoint
CREATE INDEX "automation_logs_workspace_created_index" ON "automation_logs" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "automation_logs_api_key_created_index" ON "automation_logs" USING btree ("api_key_id","created_at");--> statement-breakpoint
CREATE INDEX "automation_logs_webhook_created_index" ON "automation_logs" USING btree ("webhook_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "automation_webhook_deliveries_webhook_key_unique" ON "automation_webhook_deliveries" USING btree ("webhook_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "automation_webhook_deliveries_status_next_attempt_index" ON "automation_webhook_deliveries" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "automation_webhooks_workspace_enabled_index" ON "automation_webhooks" USING btree ("workspace_id","enabled");--> statement-breakpoint
CREATE UNIQUE INDEX "bulk_post_batch_targets_batch_account_unique" ON "bulk_post_batch_targets" USING btree ("batch_id","social_account_id");--> statement-breakpoint
CREATE INDEX "bulk_post_batches_workspace_status_created_index" ON "bulk_post_batches" USING btree ("workspace_id","status","created_at");--> statement-breakpoint
CREATE INDEX "bulk_post_batches_job_id_index" ON "bulk_post_batches" USING btree ("job_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bulk_post_row_posts_row_account_unique" ON "bulk_post_row_posts" USING btree ("bulk_post_row_id","social_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bulk_post_row_posts_post_unique" ON "bulk_post_row_posts" USING btree ("publishing_post_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bulk_post_rows_batch_row_unique" ON "bulk_post_rows" USING btree ("batch_id","row_number");--> statement-breakpoint
CREATE INDEX "bulk_post_rows_batch_status_index" ON "bulk_post_rows" USING btree ("batch_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "commerce_inventory_levels_product_unique" ON "commerce_inventory_levels" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "commerce_inventory_levels_workspace_available_index" ON "commerce_inventory_levels" USING btree ("workspace_id","available");--> statement-breakpoint
CREATE INDEX "commerce_order_items_order_index" ON "commerce_order_items" USING btree ("commerce_order_id");--> statement-breakpoint
CREATE INDEX "commerce_order_items_product_index" ON "commerce_order_items" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "commerce_orders_workspace_external_reference_unique" ON "commerce_orders" USING btree ("workspace_id","external_reference") WHERE "commerce_orders"."external_reference" is not null;--> statement-breakpoint
CREATE INDEX "commerce_orders_workspace_ordered_index" ON "commerce_orders" USING btree ("workspace_id","ordered_at");--> statement-breakpoint
CREATE INDEX "commerce_orders_workspace_status_ordered_index" ON "commerce_orders" USING btree ("workspace_id","status","ordered_at");--> statement-breakpoint
CREATE UNIQUE INDEX "commerce_products_workspace_sku_unique" ON "commerce_products" USING btree ("workspace_id","sku");--> statement-breakpoint
CREATE INDEX "commerce_products_workspace_status_updated_index" ON "commerce_products" USING btree ("workspace_id","status","updated_at");--> statement-breakpoint
CREATE INDEX "commerce_return_requests_workspace_status_created_index" ON "commerce_return_requests" USING btree ("workspace_id","status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_ledger_entries_workspace_key_unique" ON "credit_ledger_entries" USING btree ("workspace_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "credit_ledger_entries_workspace_created_index" ON "credit_ledger_entries" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "credit_ledger_entries_request_index" ON "credit_ledger_entries" USING btree ("ai_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "publishing_post_attempts_post_number_unique" ON "publishing_post_attempts" USING btree ("publishing_post_id","attempt_number");--> statement-breakpoint
CREATE UNIQUE INDEX "publishing_post_attempts_job_unique" ON "publishing_post_attempts" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "publishing_post_attempts_workspace_status_created_index" ON "publishing_post_attempts" USING btree ("workspace_id","status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_credit_accounts_workspace_unique" ON "workspace_credit_accounts" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "publishing_posts_workspace_source_reference_account_unique" ON "publishing_posts" USING btree ("workspace_id","source","external_reference","social_account_id") WHERE "publishing_posts"."external_reference" is not null;
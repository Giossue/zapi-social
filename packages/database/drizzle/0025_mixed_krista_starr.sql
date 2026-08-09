CREATE TABLE "ai_model_routes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" varchar(32) NOT NULL,
	"primary_model_id" uuid,
	"fallback_model_id" uuid,
	"reasoning_effort" varchar(16) DEFAULT 'medium' NOT NULL,
	"cost_units" integer DEFAULT 1 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"updated_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_model_routes_kind_check" CHECK ("ai_model_routes"."kind" in ('content', 'image', 'video', 'repurpose', 'planner', 'review', 'timing', 'search', 'ai_publishing')),
	CONSTRAINT "ai_model_routes_reasoning_check" CHECK ("ai_model_routes"."reasoning_effort" in ('none', 'low', 'medium', 'high', 'xhigh', 'max')),
	CONSTRAINT "ai_model_routes_cost_check" CHECK ("ai_model_routes"."cost_units" >= 0),
	CONSTRAINT "ai_model_routes_fallback_check" CHECK ("ai_model_routes"."fallback_model_id" is null or "ai_model_routes"."fallback_model_id" <> "ai_model_routes"."primary_model_id")
);
--> statement-breakpoint
CREATE TABLE "ai_models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_key" varchar(64) NOT NULL,
	"model_id" varchar(160) NOT NULL,
	"label" varchar(160) NOT NULL,
	"capability" varchar(16) NOT NULL,
	"tier" varchar(24) NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"deprecated" boolean DEFAULT false NOT NULL,
	"input_price_microusd_per_million" integer,
	"output_price_microusd_per_million" integer,
	"unit_price_microusd" integer,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_models_capability_check" CHECK ("ai_models"."capability" in ('text', 'image', 'video')),
	CONSTRAINT "ai_models_tier_check" CHECK ("ai_models"."tier" in ('quality', 'balanced', 'economy', 'specialized')),
	CONSTRAINT "ai_models_prices_check" CHECK (("ai_models"."input_price_microusd_per_million" is null or "ai_models"."input_price_microusd_per_million" >= 0) and ("ai_models"."output_price_microusd_per_million" is null or "ai_models"."output_price_microusd_per_million" >= 0) and ("ai_models"."unit_price_microusd" is null or "ai_models"."unit_price_microusd" >= 0))
);
--> statement-breakpoint
ALTER TABLE "ai_requests" DROP CONSTRAINT "ai_requests_kind_check";--> statement-breakpoint
ALTER TABLE "ai_requests" ADD COLUMN "title" varchar(160) DEFAULT 'Generación AI' NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_requests" ADD COLUMN "provider_request_id" varchar(255);--> statement-breakpoint
ALTER TABLE "ai_requests" ADD COLUMN "progress" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_requests" ADD COLUMN "schema_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_requests" ADD COLUMN "input_tokens" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_requests" ADD COLUMN "output_tokens" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_requests" ADD COLUMN "estimated_cost_microusd" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_requests" ADD COLUMN "latency_ms" integer;--> statement-breakpoint
ALTER TABLE "ai_requests" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ai_workspace_settings" ADD COLUMN "brand_name" varchar(160) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_workspace_settings" ADD COLUMN "brand_description" varchar(5000) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_workspace_settings" ADD COLUMN "brand_personality" varchar(80) DEFAULT 'cercana' NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_workspace_settings" ADD COLUMN "preferred_words" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_workspace_settings" ADD COLUMN "forbidden_words" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_workspace_settings" ADD COLUMN "require_human_review" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_workspace_settings" ADD COLUMN "warn_sensitive_claims" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_workspace_settings" ADD COLUMN "redact_personal_data" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace_credit_accounts" ADD COLUMN "monthly_budget_microusd" integer;--> statement-breakpoint
ALTER TABLE "workspace_credit_accounts" ADD COLUMN "budget_alert_percent" integer DEFAULT 80 NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace_credit_accounts" ADD COLUMN "budget_alerts_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_model_routes" ADD CONSTRAINT "ai_model_routes_primary_model_id_ai_models_id_fk" FOREIGN KEY ("primary_model_id") REFERENCES "public"."ai_models"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_model_routes" ADD CONSTRAINT "ai_model_routes_fallback_model_id_ai_models_id_fk" FOREIGN KEY ("fallback_model_id") REFERENCES "public"."ai_models"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_model_routes" ADD CONSTRAINT "ai_model_routes_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_models" ADD CONSTRAINT "ai_models_provider_key_provider_integrations_provider_key_fk" FOREIGN KEY ("provider_key") REFERENCES "public"."provider_integrations"("provider_key") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_model_routes_kind_unique" ON "ai_model_routes" USING btree ("kind");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_models_provider_model_unique" ON "ai_models" USING btree ("provider_key","model_id");--> statement-breakpoint
CREATE INDEX "ai_models_capability_enabled_index" ON "ai_models" USING btree ("capability","enabled");--> statement-breakpoint
ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_progress_check" CHECK ("ai_requests"."progress" between 0 and 100);--> statement-breakpoint
ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_usage_check" CHECK ("ai_requests"."input_tokens" >= 0 and "ai_requests"."output_tokens" >= 0 and "ai_requests"."estimated_cost_microusd" >= 0 and ("ai_requests"."latency_ms" is null or "ai_requests"."latency_ms" >= 0));--> statement-breakpoint
ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_kind_check" CHECK ("ai_requests"."kind" in ('content', 'image', 'video', 'repurpose', 'planner', 'review', 'timing', 'search', 'ai_publishing'));--> statement-breakpoint
ALTER TABLE "workspace_credit_accounts" ADD CONSTRAINT "workspace_credit_accounts_budget_check" CHECK ("workspace_credit_accounts"."monthly_budget_microusd" is null or "workspace_credit_accounts"."monthly_budget_microusd" >= 0);--> statement-breakpoint
ALTER TABLE "workspace_credit_accounts" ADD CONSTRAINT "workspace_credit_accounts_alert_percent_check" CHECK ("workspace_credit_accounts"."budget_alert_percent" between 1 and 100);
--> statement-breakpoint
INSERT INTO "provider_integrations" (
	"provider_key", "enabled", "readiness", "capabilities",
	"enabled_capability_keys", "readiness_issues"
) VALUES (
	'openai', false, 'disabled', '["text","image","video"]'::jsonb,
	'[]'::jsonb, '[]'::jsonb
) ON CONFLICT ("provider_key") DO NOTHING;
--> statement-breakpoint
INSERT INTO "ai_models" (
	"provider_key", "model_id", "label", "capability", "tier", "enabled",
	"deprecated", "input_price_microusd_per_million",
	"output_price_microusd_per_million", "unit_price_microusd", "metadata"
) VALUES
	('openai', 'gpt-5.6-sol', 'GPT-5.6 Sol', 'text', 'quality', true, false, 5000000, 30000000, null, '{"source":"openai-docs","catalogDate":"2026-08-09"}'::jsonb),
	('openai', 'gpt-5.6-terra', 'GPT-5.6 Terra', 'text', 'balanced', true, false, 2000000, 12000000, null, '{"source":"openai-docs","catalogDate":"2026-08-09"}'::jsonb),
	('openai', 'gpt-5.6-luna', 'GPT-5.6 Luna', 'text', 'economy', true, false, 200000, 1200000, null, '{"source":"openai-docs","catalogDate":"2026-08-09"}'::jsonb),
	('openai', 'gpt-image-2', 'GPT Image 2', 'image', 'specialized', true, false, null, null, null, '{"source":"openai-docs","catalogDate":"2026-08-09"}'::jsonb),
	('openai', 'sora-2', 'Sora 2 (legado)', 'video', 'specialized', false, true, null, null, 100000, '{"source":"openai-docs","catalogDate":"2026-08-09","unit":"second"}'::jsonb)
ON CONFLICT ("provider_key", "model_id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "ai_model_routes" (
	"kind", "primary_model_id", "fallback_model_id", "reasoning_effort",
	"cost_units", "enabled"
) VALUES
	('content', (SELECT "id" FROM "ai_models" WHERE "provider_key"='openai' AND "model_id"='gpt-5.6-terra'), (SELECT "id" FROM "ai_models" WHERE "provider_key"='openai' AND "model_id"='gpt-5.6-luna'), 'medium', 2, true),
	('image', (SELECT "id" FROM "ai_models" WHERE "provider_key"='openai' AND "model_id"='gpt-image-2'), null, 'none', 4, true),
	('video', (SELECT "id" FROM "ai_models" WHERE "provider_key"='openai' AND "model_id"='sora-2'), null, 'none', 12, false),
	('repurpose', (SELECT "id" FROM "ai_models" WHERE "provider_key"='openai' AND "model_id"='gpt-5.6-terra'), (SELECT "id" FROM "ai_models" WHERE "provider_key"='openai' AND "model_id"='gpt-5.6-luna'), 'low', 2, true),
	('planner', (SELECT "id" FROM "ai_models" WHERE "provider_key"='openai' AND "model_id"='gpt-5.6-sol'), (SELECT "id" FROM "ai_models" WHERE "provider_key"='openai' AND "model_id"='gpt-5.6-terra'), 'medium', 3, true),
	('review', (SELECT "id" FROM "ai_models" WHERE "provider_key"='openai' AND "model_id"='gpt-5.6-terra'), (SELECT "id" FROM "ai_models" WHERE "provider_key"='openai' AND "model_id"='gpt-5.6-luna'), 'medium', 1, true),
	('timing', null, null, 'none', 1, true),
	('search', (SELECT "id" FROM "ai_models" WHERE "provider_key"='openai' AND "model_id"='gpt-5.6-luna'), null, 'low', 1, true),
	('ai_publishing', (SELECT "id" FROM "ai_models" WHERE "provider_key"='openai' AND "model_id"='gpt-5.6-terra'), (SELECT "id" FROM "ai_models" WHERE "provider_key"='openai' AND "model_id"='gpt-5.6-luna'), 'low', 2, true)
ON CONFLICT ("kind") DO NOTHING;

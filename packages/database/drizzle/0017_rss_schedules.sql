CREATE TABLE "rss_schedule_histories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rss_schedule_id" uuid NOT NULL,
	"rss_schedule_target_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"publishing_post_id" uuid,
	"item_guid" varchar(1024),
	"item_url" text,
	"content_hash" varchar(64) NOT NULL,
	"title" varchar(500),
	"result" varchar(16) NOT NULL,
	"error_code" varchar(96),
	"queued_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rss_schedule_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rss_schedule_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"trigger" varchar(16) NOT NULL,
	"triggered_by_user_id" uuid,
	"status" varchar(16) DEFAULT 'queued' NOT NULL,
	"job_id" varchar(128),
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"feed_items_read" integer DEFAULT 0 NOT NULL,
	"queued_count" integer DEFAULT 0 NOT NULL,
	"skipped_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"error_code" varchar(96),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rss_schedule_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rss_schedule_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"social_account_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rss_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"name" varchar(160) NOT NULL,
	"feed_url" text NOT NULL,
	"description" varchar(500) DEFAULT '' NOT NULL,
	"status" varchar(16) DEFAULT 'active' NOT NULL,
	"timezone" varchar(64) NOT NULL,
	"time_slots" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"weekdays" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"start_date" date,
	"end_date" date,
	"content_rules" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_checked_at" timestamp with time zone,
	"last_queued_at" timestamp with time zone,
	"next_run_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "rss_schedules_id_workspace_unique" ON "rss_schedules" USING btree ("id","workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "social_accounts_id_workspace_unique" ON "social_accounts" USING btree ("id","workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rss_schedule_targets_id_schedule_workspace_unique" ON "rss_schedule_targets" USING btree ("id","rss_schedule_id","workspace_id");--> statement-breakpoint
ALTER TABLE "rss_schedule_histories" ADD CONSTRAINT "rss_schedule_histories_publishing_post_id_publishing_posts_id_fk" FOREIGN KEY ("publishing_post_id") REFERENCES "public"."publishing_posts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rss_schedule_histories" ADD CONSTRAINT "rss_schedule_histories_target_schedule_workspace_fk" FOREIGN KEY ("rss_schedule_target_id","rss_schedule_id","workspace_id") REFERENCES "public"."rss_schedule_targets"("id","rss_schedule_id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rss_schedule_runs" ADD CONSTRAINT "rss_schedule_runs_triggered_by_user_id_users_id_fk" FOREIGN KEY ("triggered_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rss_schedule_runs" ADD CONSTRAINT "rss_schedule_runs_schedule_workspace_fk" FOREIGN KEY ("rss_schedule_id","workspace_id") REFERENCES "public"."rss_schedules"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rss_schedule_targets" ADD CONSTRAINT "rss_schedule_targets_schedule_workspace_fk" FOREIGN KEY ("rss_schedule_id","workspace_id") REFERENCES "public"."rss_schedules"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rss_schedule_targets" ADD CONSTRAINT "rss_schedule_targets_social_account_workspace_fk" FOREIGN KEY ("social_account_id","workspace_id") REFERENCES "public"."social_accounts"("id","workspace_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rss_schedules" ADD CONSTRAINT "rss_schedules_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rss_schedules" ADD CONSTRAINT "rss_schedules_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "rss_schedule_histories_schedule_target_hash_unique" ON "rss_schedule_histories" USING btree ("rss_schedule_id","rss_schedule_target_id","content_hash");--> statement-breakpoint
CREATE INDEX "rss_schedule_histories_schedule_created_index" ON "rss_schedule_histories" USING btree ("rss_schedule_id","created_at");--> statement-breakpoint
CREATE INDEX "rss_schedule_histories_target_result_created_index" ON "rss_schedule_histories" USING btree ("rss_schedule_target_id","result","created_at");--> statement-breakpoint
CREATE INDEX "rss_schedule_histories_workspace_created_index" ON "rss_schedule_histories" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "rss_schedule_runs_schedule_created_index" ON "rss_schedule_runs" USING btree ("rss_schedule_id","created_at");--> statement-breakpoint
CREATE INDEX "rss_schedule_runs_workspace_status_created_index" ON "rss_schedule_runs" USING btree ("workspace_id","status","created_at");--> statement-breakpoint
CREATE INDEX "rss_schedule_runs_job_id_index" ON "rss_schedule_runs" USING btree ("job_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rss_schedule_targets_schedule_account_unique" ON "rss_schedule_targets" USING btree ("rss_schedule_id","social_account_id");--> statement-breakpoint
CREATE INDEX "rss_schedule_targets_workspace_account_index" ON "rss_schedule_targets" USING btree ("workspace_id","social_account_id");--> statement-breakpoint
CREATE INDEX "rss_schedules_workspace_status_next_run_index" ON "rss_schedules" USING btree ("workspace_id","status","next_run_at");--> statement-breakpoint
CREATE INDEX "rss_schedules_workspace_updated_index" ON "rss_schedules" USING btree ("workspace_id","updated_at");--> statement-breakpoint

ALTER TABLE "audit_logs" RENAME TO "api_audit_logs";
--> statement-breakpoint
ALTER TABLE "api_audit_logs" RENAME CONSTRAINT "audit_logs_workspace_id_workspaces_id_fk" TO "api_audit_logs_workspace_id_workspaces_id_fk";
--> statement-breakpoint
ALTER TABLE "api_audit_logs" RENAME CONSTRAINT "audit_logs_actor_user_id_users_id_fk" TO "api_audit_logs_actor_user_id_users_id_fk";
--> statement-breakpoint
ALTER INDEX "audit_logs_workspace_created_index" RENAME TO "api_audit_logs_workspace_created_index";
--> statement-breakpoint
ALTER INDEX "audit_logs_actor_created_index" RENAME TO "api_audit_logs_actor_created_index";
--> statement-breakpoint
CREATE TABLE "audit_releases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service" varchar(32) NOT NULL,
	"commit_sha" varchar(64),
	"reference" varchar(255),
	"deployed_at" timestamp with time zone NOT NULL,
	"deployed_by_user_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "web_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"release_id" uuid,
	"workspace_id" uuid,
	"actor_user_id" uuid,
	"event" varchar(160) NOT NULL,
	"severity" varchar(16) DEFAULT 'success' NOT NULL,
	"outcome" varchar(32) DEFAULT 'succeeded' NOT NULL,
	"page_path" varchar(512),
	"request_id" varchar(128),
	"error_code" varchar(96),
	"summary" varchar(500),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "worker_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"release_id" uuid,
	"workspace_id" uuid,
	"actor_user_id" uuid,
	"event" varchar(160) NOT NULL,
	"severity" varchar(16) DEFAULT 'success' NOT NULL,
	"outcome" varchar(32) DEFAULT 'succeeded' NOT NULL,
	"queue_name" varchar(128),
	"job_id" varchar(128),
	"attempt" integer,
	"error_code" varchar(96),
	"summary" varchar(500),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "api_audit_logs" ADD COLUMN "release_id" uuid;
--> statement-breakpoint
ALTER TABLE "api_audit_logs" ADD COLUMN "severity" varchar(16) DEFAULT 'success' NOT NULL;
--> statement-breakpoint
ALTER TABLE "api_audit_logs" ADD COLUMN "outcome" varchar(32) DEFAULT 'succeeded' NOT NULL;
--> statement-breakpoint
ALTER TABLE "api_audit_logs" ADD COLUMN "request_id" varchar(128);
--> statement-breakpoint
ALTER TABLE "api_audit_logs" ADD COLUMN "http_method" varchar(12);
--> statement-breakpoint
ALTER TABLE "api_audit_logs" ADD COLUMN "http_path" varchar(512);
--> statement-breakpoint
ALTER TABLE "api_audit_logs" ADD COLUMN "http_status" integer;
--> statement-breakpoint
ALTER TABLE "api_audit_logs" ADD COLUMN "ip_address" varchar(45);
--> statement-breakpoint
ALTER TABLE "api_audit_logs" ADD COLUMN "user_agent" varchar(512);
--> statement-breakpoint
ALTER TABLE "api_audit_logs" ADD COLUMN "error_code" varchar(96);
--> statement-breakpoint
ALTER TABLE "api_audit_logs" ADD COLUMN "summary" varchar(500);
--> statement-breakpoint
ALTER TABLE "audit_releases" ADD CONSTRAINT "audit_releases_deployed_by_user_id_users_id_fk" FOREIGN KEY ("deployed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "api_audit_logs" ADD CONSTRAINT "api_audit_logs_release_id_audit_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."audit_releases"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "web_audit_logs" ADD CONSTRAINT "web_audit_logs_release_id_audit_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."audit_releases"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "web_audit_logs" ADD CONSTRAINT "web_audit_logs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "web_audit_logs" ADD CONSTRAINT "web_audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "worker_audit_logs" ADD CONSTRAINT "worker_audit_logs_release_id_audit_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."audit_releases"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "worker_audit_logs" ADD CONSTRAINT "worker_audit_logs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "worker_audit_logs" ADD CONSTRAINT "worker_audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "audit_releases_service_commit_unique" ON "audit_releases" USING btree ("service","commit_sha");
--> statement-breakpoint
CREATE INDEX "audit_releases_service_deployed_index" ON "audit_releases" USING btree ("service","deployed_at");
--> statement-breakpoint
CREATE INDEX "api_audit_logs_severity_created_index" ON "api_audit_logs" USING btree ("severity","created_at");
--> statement-breakpoint
CREATE INDEX "api_audit_logs_release_created_index" ON "api_audit_logs" USING btree ("release_id","created_at");
--> statement-breakpoint
CREATE INDEX "web_audit_logs_workspace_created_index" ON "web_audit_logs" USING btree ("workspace_id","created_at");
--> statement-breakpoint
CREATE INDEX "web_audit_logs_actor_created_index" ON "web_audit_logs" USING btree ("actor_user_id","created_at");
--> statement-breakpoint
CREATE INDEX "web_audit_logs_severity_created_index" ON "web_audit_logs" USING btree ("severity","created_at");
--> statement-breakpoint
CREATE INDEX "web_audit_logs_release_created_index" ON "web_audit_logs" USING btree ("release_id","created_at");
--> statement-breakpoint
CREATE INDEX "worker_audit_logs_workspace_created_index" ON "worker_audit_logs" USING btree ("workspace_id","created_at");
--> statement-breakpoint
CREATE INDEX "worker_audit_logs_actor_created_index" ON "worker_audit_logs" USING btree ("actor_user_id","created_at");
--> statement-breakpoint
CREATE INDEX "worker_audit_logs_severity_created_index" ON "worker_audit_logs" USING btree ("severity","created_at");
--> statement-breakpoint
CREATE INDEX "worker_audit_logs_queue_job_index" ON "worker_audit_logs" USING btree ("queue_name","job_id");
--> statement-breakpoint
CREATE INDEX "worker_audit_logs_release_created_index" ON "worker_audit_logs" USING btree ("release_id","created_at");

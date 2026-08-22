CREATE TABLE "platform_announcement_reads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"announcement_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"read_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(200) NOT NULL,
	"body" text NOT NULL,
	"url" varchar(2048),
	"audience" varchar(16) DEFAULT 'all' NOT NULL,
	"target_workspace_id" uuid,
	"target_user_id" uuid,
	"status" varchar(16) DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_announcements_audience_check" CHECK ("platform_announcements"."audience" in ('all', 'workspace', 'user')),
	CONSTRAINT "platform_announcements_status_check" CHECK ("platform_announcements"."status" in ('draft', 'published')),
	CONSTRAINT "platform_announcements_target_check" CHECK (("platform_announcements"."audience" = 'all' and "platform_announcements"."target_workspace_id" is null and "platform_announcements"."target_user_id" is null) or ("platform_announcements"."audience" = 'workspace' and "platform_announcements"."target_workspace_id" is not null and "platform_announcements"."target_user_id" is null) or ("platform_announcements"."audience" = 'user' and "platform_announcements"."target_user_id" is not null and "platform_announcements"."target_workspace_id" is null)),
	CONSTRAINT "platform_announcements_published_check" CHECK ("platform_announcements"."status" = 'draft' or "platform_announcements"."published_at" is not null)
);
--> statement-breakpoint
ALTER TABLE "platform_announcement_reads" ADD CONSTRAINT "platform_announcement_reads_announcement_id_platform_announcements_id_fk" FOREIGN KEY ("announcement_id") REFERENCES "public"."platform_announcements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_announcement_reads" ADD CONSTRAINT "platform_announcement_reads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_announcements" ADD CONSTRAINT "platform_announcements_target_workspace_id_workspaces_id_fk" FOREIGN KEY ("target_workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_announcements" ADD CONSTRAINT "platform_announcements_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_announcements" ADD CONSTRAINT "platform_announcements_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "platform_announcement_reads_unique" ON "platform_announcement_reads" USING btree ("announcement_id","user_id");--> statement-breakpoint
CREATE INDEX "platform_announcement_reads_user_index" ON "platform_announcement_reads" USING btree ("user_id","archived_at");--> statement-breakpoint
CREATE INDEX "platform_announcements_status_published_index" ON "platform_announcements" USING btree ("status","published_at");--> statement-breakpoint
CREATE INDEX "platform_announcements_audience_index" ON "platform_announcements" USING btree ("audience","target_workspace_id","target_user_id");
CREATE TABLE "board_columns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" varchar(60) NOT NULL,
	"position" integer NOT NULL,
	"color" varchar(7) DEFAULT '#2563eb' NOT NULL,
	"is_terminal" boolean DEFAULT false NOT NULL,
	"wip_limit" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "board_columns_id_workspace_unique" UNIQUE("id","workspace_id"),
	CONSTRAINT "board_columns_position_check" CHECK ("board_columns"."position" >= 0),
	CONSTRAINT "board_columns_color_check" CHECK ("board_columns"."color" ~ '^#[0-9a-f]{6}$'),
	CONSTRAINT "board_columns_wip_limit_check" CHECK ("board_columns"."wip_limit" is null or "board_columns"."wip_limit" > 0)
);
--> statement-breakpoint
CREATE TABLE "board_labels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" varchar(40) NOT NULL,
	"color" varchar(7) DEFAULT '#64748b' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "board_labels_id_workspace_unique" UNIQUE("id","workspace_id"),
	CONSTRAINT "board_labels_color_check" CHECK ("board_labels"."color" ~ '^#[0-9a-f]{6}$')
);
--> statement-breakpoint
CREATE TABLE "board_task_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"file_asset_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "board_task_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"author_user_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "board_task_labels" (
	"task_id" uuid NOT NULL,
	"label_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "board_task_labels_task_id_label_id_pk" PRIMARY KEY("task_id","label_id")
);
--> statement-breakpoint
CREATE TABLE "board_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"column_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"assignee_user_id" uuid,
	"title" varchar(200) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"priority" varchar(8) DEFAULT 'medium' NOT NULL,
	"due_date" date,
	"progress" integer DEFAULT 0 NOT NULL,
	"position" integer NOT NULL,
	"completed_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"publishing_post_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "board_tasks_id_workspace_unique" UNIQUE("id","workspace_id"),
	CONSTRAINT "board_tasks_priority_check" CHECK ("board_tasks"."priority" in ('low', 'medium', 'high')),
	CONSTRAINT "board_tasks_progress_check" CHECK ("board_tasks"."progress" between 0 and 100),
	CONSTRAINT "board_tasks_position_check" CHECK ("board_tasks"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "workspace_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" varchar(64) NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"url" varchar(2048),
	"read_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "board_columns" ADD CONSTRAINT "board_columns_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_labels" ADD CONSTRAINT "board_labels_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_task_attachments" ADD CONSTRAINT "board_task_attachments_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_task_attachments" ADD CONSTRAINT "board_task_attachments_task_workspace_fk" FOREIGN KEY ("task_id","workspace_id") REFERENCES "public"."board_tasks"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_task_attachments" ADD CONSTRAINT "board_task_attachments_asset_workspace_fk" FOREIGN KEY ("file_asset_id","workspace_id") REFERENCES "public"."file_assets"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_task_comments" ADD CONSTRAINT "board_task_comments_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_task_comments" ADD CONSTRAINT "board_task_comments_task_workspace_fk" FOREIGN KEY ("task_id","workspace_id") REFERENCES "public"."board_tasks"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_task_labels" ADD CONSTRAINT "board_task_labels_task_workspace_fk" FOREIGN KEY ("task_id","workspace_id") REFERENCES "public"."board_tasks"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_task_labels" ADD CONSTRAINT "board_task_labels_label_workspace_fk" FOREIGN KEY ("label_id","workspace_id") REFERENCES "public"."board_labels"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_tasks" ADD CONSTRAINT "board_tasks_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_tasks" ADD CONSTRAINT "board_tasks_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_tasks" ADD CONSTRAINT "board_tasks_assignee_user_id_users_id_fk" FOREIGN KEY ("assignee_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_tasks" ADD CONSTRAINT "board_tasks_column_workspace_fk" FOREIGN KEY ("column_id","workspace_id") REFERENCES "public"."board_columns"("id","workspace_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_tasks" ADD CONSTRAINT "board_tasks_publishing_post_workspace_fk" FOREIGN KEY ("publishing_post_id","workspace_id") REFERENCES "public"."publishing_posts"("id","workspace_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_notifications" ADD CONSTRAINT "workspace_notifications_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_notifications" ADD CONSTRAINT "workspace_notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "board_columns_workspace_position_index" ON "board_columns" USING btree ("workspace_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "board_labels_workspace_name_unique" ON "board_labels" USING btree ("workspace_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "board_task_attachments_task_asset_unique" ON "board_task_attachments" USING btree ("task_id","file_asset_id");--> statement-breakpoint
CREATE INDEX "board_task_attachments_asset_index" ON "board_task_attachments" USING btree ("file_asset_id");--> statement-breakpoint
CREATE INDEX "board_task_comments_task_created_index" ON "board_task_comments" USING btree ("task_id","created_at");--> statement-breakpoint
CREATE INDEX "board_task_labels_label_index" ON "board_task_labels" USING btree ("label_id");--> statement-breakpoint
CREATE INDEX "board_tasks_workspace_column_position_index" ON "board_tasks" USING btree ("workspace_id","column_id","position");--> statement-breakpoint
CREATE INDEX "board_tasks_workspace_assignee_due_index" ON "board_tasks" USING btree ("workspace_id","assignee_user_id","due_date");--> statement-breakpoint
CREATE INDEX "workspace_notifications_user_feed_index" ON "workspace_notifications" USING btree ("user_id","archived_at","created_at");--> statement-breakpoint
CREATE INDEX "workspace_notifications_workspace_index" ON "workspace_notifications" USING btree ("workspace_id","created_at");
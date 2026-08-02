CREATE TABLE "captions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"slug" varchar(140) NOT NULL,
	"source_type" varchar(16) NOT NULL,
	"status" varchar(16) NOT NULL,
	"content" varchar(10000) NOT NULL,
	"notes" varchar(2000),
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "captions" ADD CONSTRAINT "captions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "captions" ADD CONSTRAINT "captions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "captions_workspace_slug_unique" ON "captions" USING btree ("workspace_id","slug");--> statement-breakpoint
CREATE INDEX "captions_workspace_updated_index" ON "captions" USING btree ("workspace_id","updated_at");--> statement-breakpoint
CREATE INDEX "captions_workspace_status_index" ON "captions" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "captions_workspace_source_type_index" ON "captions" USING btree ("workspace_id","source_type");--> statement-breakpoint

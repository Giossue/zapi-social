CREATE TABLE "publishing_watermarks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"social_account_id" uuid,
	"image_file_asset_id" uuid,
	"type" varchar(16) NOT NULL,
	"text" varchar(1000),
	"position" varchar(16) DEFAULT 'bottom-right' NOT NULL,
	"opacity_percent" integer DEFAULT 72 NOT NULL,
	"scale_percent" integer DEFAULT 24 NOT NULL,
	"text_preset" varchar(24) DEFAULT 'glass' NOT NULL,
	"text_color" varchar(24) DEFAULT 'brand-gradient' NOT NULL,
	"text_weight" varchar(16) DEFAULT 'semibold' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "publishing_watermarks_type_check" CHECK ("publishing_watermarks"."type" in ('image', 'text')),
	CONSTRAINT "publishing_watermarks_content_check" CHECK (("publishing_watermarks"."type" = 'image' and "publishing_watermarks"."image_file_asset_id" is not null and "publishing_watermarks"."text" is null) or ("publishing_watermarks"."type" = 'text' and "publishing_watermarks"."image_file_asset_id" is null and "publishing_watermarks"."text" is not null and length(trim("publishing_watermarks"."text")) > 0)),
	CONSTRAINT "publishing_watermarks_position_check" CHECK ("publishing_watermarks"."position" in ('top-left', 'top-right', 'center', 'bottom-left', 'bottom-right')),
	CONSTRAINT "publishing_watermarks_opacity_check" CHECK ("publishing_watermarks"."opacity_percent" between 5 and 100),
	CONSTRAINT "publishing_watermarks_scale_check" CHECK ("publishing_watermarks"."scale_percent" between 5 and 100)
);
--> statement-breakpoint
CREATE TABLE "support_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"slug" varchar(120) NOT NULL,
	"description" varchar(280) DEFAULT '' NOT NULL,
	"status" varchar(16) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_ticket_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"support_ticket_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"author_user_id" uuid NOT NULL,
	"author_role" varchar(16) DEFAULT 'requester' NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "support_ticket_comments_author_role_check" CHECK ("support_ticket_comments"."author_role" in ('requester', 'support'))
);
--> statement-breakpoint
CREATE TABLE "support_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"requester_user_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"subject" varchar(250) NOT NULL,
	"description" text NOT NULL,
	"status" varchar(16) DEFAULT 'open' NOT NULL,
	"requester_last_read_at" timestamp with time zone,
	"support_last_read_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "support_tickets_status_check" CHECK ("support_tickets"."status" in ('open', 'resolved', 'closed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "file_assets_id_workspace_unique" ON "file_assets" USING btree ("id","workspace_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "support_tickets_id_workspace_unique" ON "support_tickets" USING btree ("id","workspace_id");
--> statement-breakpoint
ALTER TABLE "publishing_watermarks" ADD CONSTRAINT "publishing_watermarks_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publishing_watermarks" ADD CONSTRAINT "publishing_watermarks_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publishing_watermarks" ADD CONSTRAINT "publishing_watermarks_social_account_workspace_fk" FOREIGN KEY ("social_account_id","workspace_id") REFERENCES "public"."social_accounts"("id","workspace_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publishing_watermarks" ADD CONSTRAINT "publishing_watermarks_image_file_workspace_fk" FOREIGN KEY ("image_file_asset_id","workspace_id") REFERENCES "public"."file_assets"("id","workspace_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_ticket_comments" ADD CONSTRAINT "support_ticket_comments_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_ticket_comments" ADD CONSTRAINT "support_ticket_comments_ticket_workspace_fk" FOREIGN KEY ("support_ticket_id","workspace_id") REFERENCES "public"."support_tickets"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_requester_user_id_users_id_fk" FOREIGN KEY ("requester_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_category_id_support_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."support_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "publishing_watermarks_workspace_target_unique" ON "publishing_watermarks" USING btree ("workspace_id",coalesce("social_account_id", '00000000-0000-0000-0000-000000000000'::uuid));--> statement-breakpoint
CREATE INDEX "publishing_watermarks_workspace_updated_index" ON "publishing_watermarks" USING btree ("workspace_id","updated_at");--> statement-breakpoint
CREATE INDEX "publishing_watermarks_image_file_index" ON "publishing_watermarks" USING btree ("image_file_asset_id");--> statement-breakpoint
CREATE UNIQUE INDEX "support_categories_slug_unique" ON "support_categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "support_categories_status_name_index" ON "support_categories" USING btree ("status","name");--> statement-breakpoint
CREATE INDEX "support_ticket_comments_ticket_created_index" ON "support_ticket_comments" USING btree ("support_ticket_id","created_at");--> statement-breakpoint
CREATE INDEX "support_tickets_workspace_requester_activity_index" ON "support_tickets" USING btree ("workspace_id","requester_user_id","last_activity_at");--> statement-breakpoint
CREATE INDEX "support_tickets_workspace_status_activity_index" ON "support_tickets" USING btree ("workspace_id","status","last_activity_at");--> statement-breakpoint
INSERT INTO "support_categories" ("name", "slug", "description") VALUES
  ('General', 'general', 'Consultas generales sobre Zapi Social.'),
  ('Problema técnico', 'problema-tecnico', 'Errores, comportamiento inesperado o dificultades técnicas.'),
  ('Cuenta y facturación', 'cuenta-y-facturacion', 'Consultas sobre acceso, suscripción o facturación.'),
  ('Sugerencia', 'sugerencia', 'Ideas para mejorar Zapi Social.')
ON CONFLICT ("slug") DO NOTHING;

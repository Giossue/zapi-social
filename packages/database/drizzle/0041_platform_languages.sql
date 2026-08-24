CREATE TABLE "platform_languages" (
	"code" varchar(12) PRIMARY KEY NOT NULL,
	"name" varchar(80) NOT NULL,
	"native_name" varchar(80) NOT NULL,
	"direction" varchar(3) DEFAULT 'ltr' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_languages_direction_check" CHECK ("platform_languages"."direction" in ('ltr', 'rtl'))
);
--> statement-breakpoint
CREATE TABLE "platform_translations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"language_code" varchar(12) NOT NULL,
	"key" varchar(512) NOT NULL,
	"value" text NOT NULL,
	"updated_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "platform_translations" ADD CONSTRAINT "platform_translations_language_code_platform_languages_code_fk" FOREIGN KEY ("language_code") REFERENCES "public"."platform_languages"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_translations" ADD CONSTRAINT "platform_translations_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "platform_languages_active_sort_index" ON "platform_languages" USING btree ("is_active","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_translations_language_key_unique" ON "platform_translations" USING btree ("language_code","key");--> statement-breakpoint
CREATE INDEX "platform_translations_language_index" ON "platform_translations" USING btree ("language_code");--> statement-breakpoint
INSERT INTO "platform_languages" ("code", "name", "native_name", "direction", "is_default", "is_active", "sort_order")
VALUES
  ('es', 'Spanish', 'Español', 'ltr', true, true, 0),
  ('en', 'English', 'English', 'ltr', false, true, 1);

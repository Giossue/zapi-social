ALTER TABLE "platform_languages" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "platform_languages" CASCADE;--> statement-breakpoint
ALTER TABLE "platform_translations" ADD CONSTRAINT "platform_translations_language_code_languages_code_fk" FOREIGN KEY ("language_code") REFERENCES "public"."languages"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
INSERT INTO "languages" ("code", "name", "native_name", "direction", "is_default", "is_active", "sort_order")
VALUES
  ('es', 'Spanish', 'Español', 'ltr', true, true, 0),
  ('en', 'English', 'English', 'ltr', false, true, 1)
ON CONFLICT ("code") DO NOTHING;

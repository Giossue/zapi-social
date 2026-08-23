DROP INDEX "email_templates_key_unique";--> statement-breakpoint
ALTER TABLE "email_templates" ADD COLUMN "locale" varchar(8) DEFAULT 'es' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "email_templates_key_locale_unique" ON "email_templates" USING btree ("key","locale");
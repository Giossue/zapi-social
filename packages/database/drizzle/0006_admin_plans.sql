CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(160) NOT NULL,
	"slug" varchar(96) NOT NULL,
	"status" varchar(24) DEFAULT 'active' NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"price" numeric(12, 2) DEFAULT '0' NOT NULL,
	"billing_type" varchar(24) DEFAULT 'monthly' NOT NULL,
	"is_free" boolean DEFAULT false NOT NULL,
	"is_default_signup" boolean DEFAULT false NOT NULL,
	"trial_days" integer DEFAULT 0 NOT NULL,
	"position" integer DEFAULT 1 NOT NULL,
	"description" varchar(500) DEFAULT '' NOT NULL,
	"permission_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plans_status_check" CHECK ("status" IN ('active', 'inactive')),
	CONSTRAINT "plans_currency_check" CHECK ("currency" IN ('USD', 'EUR')),
	CONSTRAINT "plans_billing_type_check" CHECK ("billing_type" IN ('monthly', 'yearly')),
	CONSTRAINT "plans_price_nonnegative_check" CHECK ("price" >= 0),
	CONSTRAINT "plans_free_price_check" CHECK (NOT "is_free" OR "price" = 0),
	CONSTRAINT "plans_default_signup_check" CHECK (NOT "is_default_signup" OR ("status" = 'active' AND "is_free")),
	CONSTRAINT "plans_trial_days_nonnegative_check" CHECK ("trial_days" >= 0),
	CONSTRAINT "plans_position_positive_check" CHECK ("position" > 0)
);
--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "plans_name_unique" ON "plans" USING btree ("name");
--> statement-breakpoint
CREATE UNIQUE INDEX "plans_slug_unique" ON "plans" USING btree ("slug");
--> statement-breakpoint
CREATE UNIQUE INDEX "plans_default_signup_unique" ON "plans" USING btree ("is_default_signup") WHERE "plans"."is_default_signup" = true;
--> statement-breakpoint
CREATE INDEX "plans_status_position_index" ON "plans" USING btree ("status", "position");

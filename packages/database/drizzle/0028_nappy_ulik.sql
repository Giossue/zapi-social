CREATE TABLE "billing_coupons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_discount_id" varchar(160),
	"name" varchar(160) NOT NULL,
	"code" varchar(64) NOT NULL,
	"type" varchar(16) NOT NULL,
	"value" integer NOT NULL,
	"currency" varchar(3),
	"duration" varchar(16) DEFAULT 'once' NOT NULL,
	"eligible_plan_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"max_redemptions" integer,
	"redemption_count" integer DEFAULT 0 NOT NULL,
	"status" varchar(16) DEFAULT 'active' NOT NULL,
	"sync_status" varchar(16) DEFAULT 'pending' NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_coupons_value_check" CHECK ("billing_coupons"."value" > 0),
	CONSTRAINT "billing_coupons_max_redemptions_check" CHECK ("billing_coupons"."max_redemptions" is null or "billing_coupons"."max_redemptions" > 0),
	CONSTRAINT "billing_coupons_redemption_count_check" CHECK ("billing_coupons"."redemption_count" >= 0),
	CONSTRAINT "billing_coupons_type_check" CHECK ("billing_coupons"."type" in ('percentage', 'fixed')),
	CONSTRAINT "billing_coupons_percentage_check" CHECK ("billing_coupons"."type" <> 'percentage' or "billing_coupons"."value" <= 10000),
	CONSTRAINT "billing_coupons_fixed_currency_check" CHECK ("billing_coupons"."type" <> 'fixed' or "billing_coupons"."currency" is not null),
	CONSTRAINT "billing_coupons_dates_check" CHECK ("billing_coupons"."ends_at" is null or "billing_coupons"."starts_at" is null or "billing_coupons"."ends_at" > "billing_coupons"."starts_at"),
	CONSTRAINT "billing_coupons_status_check" CHECK ("billing_coupons"."status" in ('active', 'inactive')),
	CONSTRAINT "billing_coupons_sync_status_check" CHECK ("billing_coupons"."sync_status" in ('pending', 'synced', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "billing_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_order_id" varchar(160) NOT NULL,
	"external_checkout_id" varchar(160),
	"invoice_number" varchar(96),
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"plan_id" uuid,
	"credit_package_id" uuid,
	"subscription_id" uuid,
	"product_type" varchar(16) NOT NULL,
	"product_label" varchar(200) NOT NULL,
	"status" varchar(24) DEFAULT 'pending' NOT NULL,
	"amount_minor" integer NOT NULL,
	"refunded_amount_minor" integer DEFAULT 0 NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"paid_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_payments_amount_check" CHECK ("billing_payments"."amount_minor" >= 0),
	CONSTRAINT "billing_payments_refunded_amount_check" CHECK ("billing_payments"."refunded_amount_minor" >= 0 and "billing_payments"."refunded_amount_minor" <= "billing_payments"."amount_minor"),
	CONSTRAINT "billing_payments_product_reference_check" CHECK (("billing_payments"."product_type" = 'plan' and "billing_payments"."plan_id" is not null and "billing_payments"."credit_package_id" is null) or ("billing_payments"."product_type" = 'credits' and "billing_payments"."plan_id" is null and "billing_payments"."credit_package_id" is not null)),
	CONSTRAINT "billing_payments_product_type_check" CHECK ("billing_payments"."product_type" in ('plan', 'credits')),
	CONSTRAINT "billing_payments_status_check" CHECK ("billing_payments"."status" in ('pending', 'paid', 'partially_refunded', 'refunded', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "billing_refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_refund_id" varchar(160) NOT NULL,
	"payment_id" uuid NOT NULL,
	"requested_by_user_id" uuid NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"amount_minor" integer NOT NULL,
	"reason" varchar(32) DEFAULT 'other' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_refunds_amount_check" CHECK ("billing_refunds"."amount_minor" > 0),
	CONSTRAINT "billing_refunds_status_check" CHECK ("billing_refunds"."status" in ('pending', 'succeeded', 'failed', 'canceled'))
);
--> statement-breakpoint
CREATE TABLE "billing_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_subscription_id" varchar(160) NOT NULL,
	"external_customer_id" varchar(160),
	"external_product_id" varchar(160),
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"status" varchar(24) NOT NULL,
	"amount_minor" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"interval" varchar(16) NOT NULL,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"current_period_starts_at" timestamp with time zone,
	"current_period_ends_at" timestamp with time zone,
	"canceled_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_subscriptions_amount_check" CHECK ("billing_subscriptions"."amount_minor" >= 0),
	CONSTRAINT "billing_subscriptions_interval_check" CHECK ("billing_subscriptions"."interval" in ('month', 'year')),
	CONSTRAINT "billing_subscriptions_status_check" CHECK ("billing_subscriptions"."status" in ('incomplete', 'trialing', 'active', 'past_due', 'canceled', 'unpaid'))
);
--> statement-breakpoint
CREATE TABLE "billing_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_event_id" varchar(200) NOT NULL,
	"event_type" varchar(96) NOT NULL,
	"payload_hash" varchar(64) NOT NULL,
	"status" varchar(16) DEFAULT 'processing' NOT NULL,
	"processed_at" timestamp with time zone,
	"error_code" varchar(96),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_webhook_events_status_check" CHECK ("billing_webhook_events"."status" in ('processing', 'processed', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "credit_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(160) NOT NULL,
	"slug" varchar(96) NOT NULL,
	"description" varchar(500) DEFAULT '' NOT NULL,
	"units" integer NOT NULL,
	"price_minor" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"status" varchar(16) DEFAULT 'active' NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 1 NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_packages_units_check" CHECK ("credit_packages"."units" > 0),
	CONSTRAINT "credit_packages_price_check" CHECK ("credit_packages"."price_minor" >= 0),
	CONSTRAINT "credit_packages_position_check" CHECK ("credit_packages"."position" > 0),
	CONSTRAINT "credit_packages_status_check" CHECK ("credit_packages"."status" in ('active', 'hidden'))
);
--> statement-breakpoint
CREATE TABLE "workspace_plan_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"source" varchar(24) DEFAULT 'admin' NOT NULL,
	"updated_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_plan_assignments_source_check" CHECK ("workspace_plan_assignments"."source" in ('signup', 'admin', 'subscription'))
);
--> statement-breakpoint
ALTER TABLE "billing_coupons" ADD CONSTRAINT "billing_coupons_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_coupons" ADD CONSTRAINT "billing_coupons_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_payments" ADD CONSTRAINT "billing_payments_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_payments" ADD CONSTRAINT "billing_payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_payments" ADD CONSTRAINT "billing_payments_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_payments" ADD CONSTRAINT "billing_payments_credit_package_id_credit_packages_id_fk" FOREIGN KEY ("credit_package_id") REFERENCES "public"."credit_packages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_payments" ADD CONSTRAINT "billing_payments_subscription_id_billing_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."billing_subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_refunds" ADD CONSTRAINT "billing_refunds_payment_id_billing_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."billing_payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_refunds" ADD CONSTRAINT "billing_refunds_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_subscriptions" ADD CONSTRAINT "billing_subscriptions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_subscriptions" ADD CONSTRAINT "billing_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_subscriptions" ADD CONSTRAINT "billing_subscriptions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_packages" ADD CONSTRAINT "credit_packages_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_packages" ADD CONSTRAINT "credit_packages_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_plan_assignments" ADD CONSTRAINT "workspace_plan_assignments_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_plan_assignments" ADD CONSTRAINT "workspace_plan_assignments_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_plan_assignments" ADD CONSTRAINT "workspace_plan_assignments_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "billing_coupons_code_unique" ON "billing_coupons" USING btree (upper("code"));--> statement-breakpoint
CREATE UNIQUE INDEX "billing_coupons_external_discount_unique" ON "billing_coupons" USING btree ("external_discount_id") WHERE "billing_coupons"."external_discount_id" is not null;--> statement-breakpoint
CREATE INDEX "billing_coupons_status_created_index" ON "billing_coupons" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_payments_external_order_unique" ON "billing_payments" USING btree ("external_order_id");--> statement-breakpoint
CREATE INDEX "billing_payments_workspace_created_index" ON "billing_payments" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "billing_payments_user_created_index" ON "billing_payments" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_refunds_external_unique" ON "billing_refunds" USING btree ("external_refund_id");--> statement-breakpoint
CREATE INDEX "billing_refunds_payment_created_index" ON "billing_refunds" USING btree ("payment_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_subscriptions_external_unique" ON "billing_subscriptions" USING btree ("external_subscription_id");--> statement-breakpoint
CREATE INDEX "billing_subscriptions_workspace_status_index" ON "billing_subscriptions" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "billing_subscriptions_user_created_index" ON "billing_subscriptions" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_webhook_events_external_unique" ON "billing_webhook_events" USING btree ("external_event_id");--> statement-breakpoint
CREATE INDEX "billing_webhook_events_status_created_index" ON "billing_webhook_events" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_packages_name_unique" ON "credit_packages" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_packages_slug_unique" ON "credit_packages" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "credit_packages_status_position_index" ON "credit_packages" USING btree ("status","position");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_plan_assignments_workspace_unique" ON "workspace_plan_assignments" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "workspace_plan_assignments_plan_index" ON "workspace_plan_assignments" USING btree ("plan_id");
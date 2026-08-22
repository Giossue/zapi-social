CREATE TABLE "manual_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"plan_id" uuid,
	"credit_package_id" uuid,
	"product_type" varchar(16) NOT NULL,
	"reference" varchar(190) NOT NULL,
	"payment_info" varchar(2000) DEFAULT '' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"amount_minor" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"billing_payment_id" uuid,
	"reviewed_by_user_id" uuid,
	"reviewed_at" timestamp with time zone,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "manual_payments_amount_check" CHECK ("manual_payments"."amount_minor" > 0),
	CONSTRAINT "manual_payments_status_check" CHECK ("manual_payments"."status" in ('pending', 'approved', 'rejected')),
	CONSTRAINT "manual_payments_product_reference_check" CHECK (("manual_payments"."product_type" = 'plan' and "manual_payments"."plan_id" is not null and "manual_payments"."credit_package_id" is null) or ("manual_payments"."product_type" = 'credits' and "manual_payments"."plan_id" is null and "manual_payments"."credit_package_id" is not null))
);
--> statement-breakpoint
ALTER TABLE "manual_payments" ADD CONSTRAINT "manual_payments_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_payments" ADD CONSTRAINT "manual_payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_payments" ADD CONSTRAINT "manual_payments_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_payments" ADD CONSTRAINT "manual_payments_credit_package_id_credit_packages_id_fk" FOREIGN KEY ("credit_package_id") REFERENCES "public"."credit_packages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_payments" ADD CONSTRAINT "manual_payments_billing_payment_id_billing_payments_id_fk" FOREIGN KEY ("billing_payment_id") REFERENCES "public"."billing_payments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_payments" ADD CONSTRAINT "manual_payments_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_payments" ADD CONSTRAINT "manual_payments_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "manual_payments_reference_unique" ON "manual_payments" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "manual_payments_status_created_index" ON "manual_payments" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "manual_payments_workspace_index" ON "manual_payments" USING btree ("workspace_id");
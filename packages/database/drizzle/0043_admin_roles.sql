CREATE TABLE "admin_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" varchar(500) DEFAULT '' NOT NULL,
	"permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "admin_role_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "admin_roles_name_unique" ON "admin_roles" USING btree ("name");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_admin_role_id_admin_roles_id_fk" FOREIGN KEY ("admin_role_id") REFERENCES "public"."admin_roles"("id") ON DELETE set null ON UPDATE no action;
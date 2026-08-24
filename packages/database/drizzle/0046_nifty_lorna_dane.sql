UPDATE "ai_workspace_settings" SET "enforce_credits" = true WHERE "enforce_credits" = false;--> statement-breakpoint
ALTER TABLE "ai_workspace_settings" ALTER COLUMN "enforce_credits" SET DEFAULT true;--> statement-breakpoint
ALTER TABLE "workspaces" ALTER COLUMN "enabled_modules" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "workspaces" ALTER COLUMN "enabled_modules" DROP NOT NULL;--> statement-breakpoint
UPDATE "workspaces" SET "enabled_modules" = NULL WHERE "enabled_modules" = '[]'::jsonb;

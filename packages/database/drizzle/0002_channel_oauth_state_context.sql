ALTER TABLE "channel_oauth_states" ADD COLUMN "capability_key" varchar(64);
--> statement-breakpoint
UPDATE "channel_oauth_states" SET "capability_key" = 'legacy' WHERE "capability_key" IS NULL;
--> statement-breakpoint
ALTER TABLE "channel_oauth_states" ALTER COLUMN "capability_key" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "channel_oauth_states" ADD COLUMN "context_ciphertext" text;
--> statement-breakpoint
CREATE INDEX "channel_oauth_states_workspace_provider_capability_index" ON "channel_oauth_states" USING btree ("workspace_id", "provider_key", "capability_key");

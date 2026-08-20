UPDATE "plans" SET "currency" = 'USD' WHERE "currency" <> 'USD';--> statement-breakpoint
ALTER TABLE "plans" DROP CONSTRAINT IF EXISTS "plans_currency_check";--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_currency_check" CHECK ("currency" = 'USD');

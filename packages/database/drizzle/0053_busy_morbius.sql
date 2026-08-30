ALTER TABLE "ai_model_routes" DROP CONSTRAINT "ai_model_routes_kind_check";--> statement-breakpoint
ALTER TABLE "ai_requests" DROP CONSTRAINT "ai_requests_kind_check";--> statement-breakpoint
ALTER TABLE "ai_model_routes" ADD CONSTRAINT "ai_model_routes_kind_check" CHECK ("ai_model_routes"."kind" in ('agent', 'content', 'image', 'video', 'repurpose', 'planner', 'review', 'timing', 'search', 'ai_publishing'));--> statement-breakpoint
ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_kind_check" CHECK ("ai_requests"."kind" in ('agent', 'content', 'image', 'video', 'repurpose', 'planner', 'review', 'timing', 'search', 'ai_publishing'));--> statement-breakpoint
INSERT INTO "ai_model_routes" (
	"kind", "primary_model_id", "fallback_model_id", "reasoning_effort",
	"cost_units", "enabled"
) VALUES ('agent', null, null, 'none', 3, true)
ON CONFLICT ("kind") DO NOTHING;

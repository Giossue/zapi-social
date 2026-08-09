UPDATE "ai_models"
SET
	"input_price_microusd_per_million" = CASE "model_id"
		WHEN 'gpt-5.6-sol' THEN 5000000
		WHEN 'gpt-5.6-terra' THEN 2500000
		WHEN 'gpt-5.6-luna' THEN 1000000
		ELSE "input_price_microusd_per_million"
	END,
	"output_price_microusd_per_million" = CASE "model_id"
		WHEN 'gpt-5.6-sol' THEN 30000000
		WHEN 'gpt-5.6-terra' THEN 15000000
		WHEN 'gpt-5.6-luna' THEN 6000000
		ELSE "output_price_microusd_per_million"
	END,
	"updated_at" = now()
WHERE "provider_key" = 'openai'
	AND "model_id" IN ('gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna');
--> statement-breakpoint
UPDATE "ai_model_routes"
SET
	"primary_model_id" = null,
	"fallback_model_id" = null,
	"reasoning_effort" = 'none',
	"updated_at" = now()
WHERE "kind" = 'search';

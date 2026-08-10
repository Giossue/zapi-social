ALTER TABLE "ai_model_routes" ADD COLUMN "reference_model_id" uuid;--> statement-breakpoint
ALTER TABLE "ai_model_routes" ADD COLUMN "reference_fallback_model_id" uuid;--> statement-breakpoint
ALTER TABLE "ai_model_routes" ADD CONSTRAINT "ai_model_routes_reference_model_id_ai_models_id_fk" FOREIGN KEY ("reference_model_id") REFERENCES "public"."ai_models"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_model_routes" ADD CONSTRAINT "ai_model_routes_reference_fallback_model_id_ai_models_id_fk" FOREIGN KEY ("reference_fallback_model_id") REFERENCES "public"."ai_models"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_model_routes" ADD CONSTRAINT "ai_model_routes_reference_fallback_check" CHECK ("ai_model_routes"."reference_fallback_model_id" is null or "ai_model_routes"."reference_fallback_model_id" <> "ai_model_routes"."reference_model_id");
--> statement-breakpoint
INSERT INTO "provider_integrations" (
	"provider_key", "enabled", "readiness", "capabilities",
	"enabled_capability_keys", "readiness_issues"
) VALUES (
	'atlascloud', false, 'disabled', '["image","video"]'::jsonb,
	'[]'::jsonb, '[]'::jsonb
) ON CONFLICT ("provider_key") DO UPDATE SET
	"capabilities" = excluded."capabilities",
	"enabled_capability_keys" = CASE
		WHEN "provider_integrations"."enabled" THEN excluded."capabilities"
		ELSE '[]'::jsonb
	END,
	"updated_at" = now();
--> statement-breakpoint
UPDATE "provider_integrations"
SET
	"capabilities" = '["text"]'::jsonb,
	"enabled_capability_keys" = CASE WHEN "enabled" THEN '["text"]'::jsonb ELSE '[]'::jsonb END,
	"updated_at" = now()
WHERE "provider_key" = 'openai';
--> statement-breakpoint
INSERT INTO "ai_models" (
	"provider_key", "model_id", "label", "capability", "tier", "enabled",
	"deprecated", "input_price_microusd_per_million",
	"output_price_microusd_per_million", "unit_price_microusd", "metadata"
) VALUES
	('atlascloud', 'openai/gpt-image-2/text-to-image', 'GPT Image 2 · Texto a imagen', 'image', 'quality', true, false, null, null, null, '{"source":"atlascloud-docs","catalogDate":"2026-08-09","modes":["text-to-image"]}'::jsonb),
	('atlascloud', 'openai/gpt-image-2/edit', 'GPT Image 2 · Edición', 'image', 'quality', true, false, null, null, null, '{"source":"atlascloud-docs","catalogDate":"2026-08-09","modes":["image-to-image"]}'::jsonb),
	('atlascloud', 'google/nano-banana-2/text-to-image', 'Nano Banana 2 · Texto a imagen', 'image', 'balanced', true, false, null, null, null, '{"source":"atlascloud-docs","catalogDate":"2026-08-09","modes":["text-to-image"]}'::jsonb),
	('atlascloud', 'google/nano-banana-2/edit', 'Nano Banana 2 · Edición', 'image', 'balanced', true, false, null, null, null, '{"source":"atlascloud-docs","catalogDate":"2026-08-09","modes":["image-to-image"]}'::jsonb),
	('atlascloud', 'google/nano-banana-pro/text-to-image', 'Nano Banana Pro · Texto a imagen', 'image', 'quality', true, false, null, null, null, '{"source":"atlascloud-docs","catalogDate":"2026-08-09","modes":["text-to-image"]}'::jsonb),
	('atlascloud', 'google/nano-banana-pro/edit', 'Nano Banana Pro · Edición', 'image', 'quality', true, false, null, null, null, '{"source":"atlascloud-docs","catalogDate":"2026-08-09","modes":["image-to-image"]}'::jsonb),
	('atlascloud', 'google/nano-banana-pro/text-to-image-ultra', 'Nano Banana Pro Ultra · Texto a imagen', 'image', 'specialized', true, false, null, null, null, '{"source":"atlascloud-docs","catalogDate":"2026-08-09","modes":["text-to-image"]}'::jsonb),
	('atlascloud', 'google/nano-banana-pro/edit-ultra', 'Nano Banana Pro Ultra · Edición', 'image', 'specialized', true, false, null, null, null, '{"source":"atlascloud-docs","catalogDate":"2026-08-09","modes":["image-to-image"]}'::jsonb),
	('atlascloud', 'bytedance/seedance-2.0/text-to-video', 'Seedance 2.0 · Texto a video', 'video', 'quality', true, false, null, null, null, '{"source":"atlascloud-docs","catalogDate":"2026-08-09","modes":["text-to-video"]}'::jsonb),
	('atlascloud', 'bytedance/seedance-2.0/image-to-video', 'Seedance 2.0 · Imagen a video', 'video', 'quality', true, false, null, null, null, '{"source":"atlascloud-docs","catalogDate":"2026-08-09","modes":["image-to-video"]}'::jsonb),
	('atlascloud', 'bytedance/seedance-2.0/reference-to-video', 'Seedance 2.0 · Referencias a video', 'video', 'quality', true, false, null, null, null, '{"source":"atlascloud-docs","catalogDate":"2026-08-09","modes":["reference-to-video"]}'::jsonb)
ON CONFLICT ("provider_key", "model_id") DO UPDATE SET
	"label" = excluded."label",
	"capability" = excluded."capability",
	"tier" = excluded."tier",
	"metadata" = excluded."metadata",
	"updated_at" = now();
--> statement-breakpoint
UPDATE "ai_models"
SET
	"enabled" = false,
	"deprecated" = true,
	"metadata" = "metadata" || '{"directMediaDisabled":true,"replacementProvider":"atlascloud"}'::jsonb,
	"updated_at" = now()
WHERE "provider_key" = 'openai' AND "capability" IN ('image', 'video');
--> statement-breakpoint
UPDATE "ai_model_routes"
SET
	"primary_model_id" = (SELECT "id" FROM "ai_models" WHERE "provider_key" = 'atlascloud' AND "model_id" = 'openai/gpt-image-2/text-to-image'),
	"fallback_model_id" = (SELECT "id" FROM "ai_models" WHERE "provider_key" = 'atlascloud' AND "model_id" = 'google/nano-banana-2/text-to-image'),
	"reference_model_id" = (SELECT "id" FROM "ai_models" WHERE "provider_key" = 'atlascloud' AND "model_id" = 'openai/gpt-image-2/edit'),
	"reference_fallback_model_id" = (SELECT "id" FROM "ai_models" WHERE "provider_key" = 'atlascloud' AND "model_id" = 'google/nano-banana-2/edit'),
	"reasoning_effort" = 'none',
	"enabled" = true,
	"updated_at" = now()
WHERE "kind" = 'image';
--> statement-breakpoint
UPDATE "ai_model_routes"
SET
	"primary_model_id" = (SELECT "id" FROM "ai_models" WHERE "provider_key" = 'atlascloud' AND "model_id" = 'bytedance/seedance-2.0/text-to-video'),
	"fallback_model_id" = null,
	"reference_model_id" = (SELECT "id" FROM "ai_models" WHERE "provider_key" = 'atlascloud' AND "model_id" = 'bytedance/seedance-2.0/reference-to-video'),
	"reference_fallback_model_id" = (SELECT "id" FROM "ai_models" WHERE "provider_key" = 'atlascloud' AND "model_id" = 'bytedance/seedance-2.0/image-to-video'),
	"reasoning_effort" = 'none',
	"enabled" = true,
	"updated_at" = now()
WHERE "kind" = 'video';

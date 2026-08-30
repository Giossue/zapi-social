CREATE TABLE "ai_agent_edges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_agent_id" uuid NOT NULL,
	"target_agent_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_agent_edges_no_self_check" CHECK ("ai_agent_edges"."source_agent_id" <> "ai_agent_edges"."target_agent_id")
);
--> statement-breakpoint
CREATE TABLE "ai_agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" varchar(500) DEFAULT '' NOT NULL,
	"system_prompt" text DEFAULT '' NOT NULL,
	"kind" varchar(16) DEFAULT 'specialist' NOT NULL,
	"model_id" uuid,
	"tools" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"canvas_position" jsonb DEFAULT '{"x":0,"y":0}'::jsonb NOT NULL,
	"updated_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_agents_kind_check" CHECK ("ai_agents"."kind" in ('orchestrator', 'specialist'))
);
--> statement-breakpoint
ALTER TABLE "ai_agent_edges" ADD CONSTRAINT "ai_agent_edges_source_agent_id_ai_agents_id_fk" FOREIGN KEY ("source_agent_id") REFERENCES "public"."ai_agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_agent_edges" ADD CONSTRAINT "ai_agent_edges_target_agent_id_ai_agents_id_fk" FOREIGN KEY ("target_agent_id") REFERENCES "public"."ai_agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_agents" ADD CONSTRAINT "ai_agents_model_id_ai_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."ai_models"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_agents" ADD CONSTRAINT "ai_agents_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_agent_edges_source_target_unique" ON "ai_agent_edges" USING btree ("source_agent_id","target_agent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_agents_name_unique" ON "ai_agents" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_agents_orchestrator_unique" ON "ai_agents" USING btree ("kind") WHERE "ai_agents"."kind" = 'orchestrator';--> statement-breakpoint
INSERT INTO "provider_integrations" (
	"provider_key", "enabled", "readiness", "capabilities",
	"enabled_capability_keys", "readiness_issues"
) VALUES
	('deepseek', false, 'disabled', '["text"]'::jsonb, '[]'::jsonb, '[]'::jsonb),
	('qwen', false, 'disabled', '["text"]'::jsonb, '[]'::jsonb, '[]'::jsonb),
	('anthropic', false, 'disabled', '["text"]'::jsonb, '[]'::jsonb, '[]'::jsonb)
ON CONFLICT ("provider_key") DO NOTHING;
--> statement-breakpoint
INSERT INTO "ai_models" (
	"provider_key", "model_id", "label", "capability", "tier", "enabled",
	"deprecated", "input_price_microusd_per_million",
	"output_price_microusd_per_million", "unit_price_microusd", "metadata"
) VALUES
	('deepseek', 'deepseek-v4-pro', 'DeepSeek V4 Pro', 'text', 'quality', true, false, 1320000, 3960000, null, '{"source":"deepseek-docs","catalogDate":"2026-08-30","toolCalls":true,"openAiCompatible":true}'::jsonb),
	('deepseek', 'deepseek-v4-flash', 'DeepSeek V4 Flash', 'text', 'economy', true, false, 440000, 1320000, null, '{"source":"deepseek-docs","catalogDate":"2026-08-30","toolCalls":true,"openAiCompatible":true}'::jsonb),
	('qwen', 'qwen3.8-max', 'Qwen3.8 Max', 'text', 'quality', true, false, 2000000, 6000000, null, '{"source":"alibabacloud-model-studio","catalogDate":"2026-08-30","toolCalls":true,"openAiCompatible":true}'::jsonb),
	('qwen', 'qwen3.8-flash', 'Qwen3.8 Flash', 'text', 'economy', true, false, null, null, null, '{"source":"alibabacloud-model-studio","catalogDate":"2026-08-30","toolCalls":true,"openAiCompatible":true}'::jsonb),
	('anthropic', 'claude-opus-5', 'Claude Opus 5', 'text', 'quality', true, false, 5000000, 25000000, null, '{"source":"anthropic-docs","catalogDate":"2026-08-30","toolCalls":true,"openAiCompatible":false}'::jsonb),
	('anthropic', 'claude-sonnet-5', 'Claude Sonnet 5', 'text', 'balanced', true, false, 3000000, 15000000, null, '{"source":"anthropic-docs","catalogDate":"2026-08-30","toolCalls":true,"openAiCompatible":false}'::jsonb),
	('anthropic', 'claude-haiku-4-5', 'Claude Haiku 4.5', 'text', 'economy', true, false, 1000000, 5000000, null, '{"source":"anthropic-docs","catalogDate":"2026-08-30","toolCalls":true,"openAiCompatible":false}'::jsonb)
ON CONFLICT ("provider_key", "model_id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "ai_agents" (
	"name", "description", "system_prompt", "kind", "model_id", "tools",
	"enabled", "canvas_position"
) VALUES
	('Orquestador', 'Analiza la petición y decide qué agente responde', 'Eres el orquestador de la marca. Tu único trabajo es entender la petición del usuario, elegir el agente especialista adecuado y pasarle una orden clara y completa. Nunca ejecutas la tarea tú mismo.', 'orchestrator', (SELECT "id" FROM "ai_models" WHERE "provider_key"='openai' AND "model_id"='gpt-5.6-luna'), '["search_content","best_times"]'::jsonb, true, '{"x":480,"y":180}'::jsonb),
	('Agente de contenido', 'Redacta captions por plataforma con la voz de la marca', 'Eres un copywriter experto en redes sociales. Escribes captions con la voz de la marca, adaptados a las reglas y límites de cada plataforma.', 'specialist', (SELECT "id" FROM "ai_models" WHERE "provider_key"='openai' AND "model_id"='gpt-5.6-sol'), '["save_caption","search_captions"]'::jsonb, true, '{"x":1000,"y":0}'::jsonb),
	('Agente de media', 'Genera imágenes y videos promocionales', 'Eres un director de arte. Conviertes peticiones en prompts visuales detallados y generas imágenes y videos consistentes con la identidad de la marca.', 'specialist', (SELECT "id" FROM "ai_models" WHERE "provider_key"='openai' AND "model_id"='gpt-5.6-sol'), '["generate_image","generate_video","save_file"]'::jsonb, true, '{"x":1000,"y":260}'::jsonb),
	('Agente de publicación', 'Convierte el resultado en borrador de publicación', 'Preparas borradores de publicación y los programas en los mejores horarios. Eres preciso con fechas, zonas horarias y límites de cada red.', 'specialist', (SELECT "id" FROM "ai_models" WHERE "provider_key"='openai' AND "model_id"='gpt-5.6-luna'), '["create_draft","schedule_post"]'::jsonb, true, '{"x":1000,"y":520}'::jsonb)
ON CONFLICT ("name") DO NOTHING;
--> statement-breakpoint
INSERT INTO "ai_agent_edges" ("source_agent_id", "target_agent_id")
SELECT o."id", s."id"
FROM "ai_agents" o
JOIN "ai_agents" s ON s."name" IN ('Agente de contenido', 'Agente de media', 'Agente de publicación')
WHERE o."name" = 'Orquestador'
ON CONFLICT ("source_agent_id", "target_agent_id") DO NOTHING;

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'MERGE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "password" TEXT,
    "name" TEXT,
    "image" TEXT,
    "role" TEXT NOT NULL DEFAULT 'participant',
    "locale" VARCHAR(10),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "form_flows" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "form_flows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_screens" (
    "id" TEXT NOT NULL,
    "flowKey" TEXT NOT NULL,
    "screenId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "inputType" TEXT NOT NULL,
    "renderKind" TEXT NOT NULL,
    "primaryActionLabel" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "atlasDomain" TEXT,
    "mvpPhase" TEXT NOT NULL DEFAULT 'MVP',
    "status" TEXT NOT NULL DEFAULT 'Locked',
    "visibilityRule" JSONB,

    CONSTRAINT "form_screens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_questions" (
    "id" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "registryFieldId" TEXT,
    "screenId" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "fieldType" TEXT NOT NULL,
    "required" TEXT NOT NULL DEFAULT 'Optional',
    "validation" TEXT,
    "notes" TEXT,
    "targetTable" TEXT NOT NULL,
    "targetColumn" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "form_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_answer_options" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "isExclusive" BOOLEAN NOT NULL DEFAULT false,
    "signalTag" TEXT,

    CONSTRAINT "form_answer_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "narrative_prompts" (
    "id" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "screenId" TEXT NOT NULL,
    "promptText" TEXT NOT NULL,
    "captureType" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "narrative_prompts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_translations" (
    "id" TEXT NOT NULL,
    "key" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "form_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_translation_data" (
    "id" TEXT NOT NULL,
    "translationId" TEXT NOT NULL,
    "locale" VARCHAR(10) NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "form_translation_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "screen_routes" (
    "id" TEXT NOT NULL,
    "fromScreenId" TEXT NOT NULL,
    "toScreenId" TEXT NOT NULL,
    "condition" JSONB,
    "priority" INTEGER NOT NULL,
    "note" TEXT,

    CONSTRAINT "screen_routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signal_rules" (
    "id" TEXT NOT NULL,
    "signalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "sourceScreen" TEXT NOT NULL,
    "condition" JSONB NOT NULL,
    "severity" TEXT NOT NULL,
    "note" TEXT,

    CONSTRAINT "signal_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reflection_rules" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "condition" JSONB NOT NULL,
    "reflectionType" TEXT NOT NULL,
    "templateCopy" TEXT NOT NULL,
    "targetScreen" TEXT NOT NULL,
    "priority" INTEGER NOT NULL,
    "note" TEXT,

    CONSTRAINT "reflection_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "observations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "flowKey" TEXT NOT NULL DEFAULT 'first_observation',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "currentScreenId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "observation_responses" (
    "id" TEXT NOT NULL,
    "observationId" TEXT NOT NULL,
    "screenId" TEXT,
    "fieldId" TEXT NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "observation_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "observation_consents" (
    "id" TEXT NOT NULL,
    "observationId" TEXT NOT NULL,
    "consent_acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "consent_timestamp" TIMESTAMP(3),

    CONSTRAINT "observation_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "observation_safety" (
    "id" TEXT NOT NULL,
    "observationId" TEXT NOT NULL,
    "safety_flags" JSONB,
    "urgent_symptom_flags" JSONB,

    CONSTRAINT "observation_safety_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participant_context" (
    "id" TEXT NOT NULL,
    "observationId" TEXT NOT NULL,
    "age_range" TEXT,
    "reproductive_state" TEXT,
    "hormonal_contraception_status" TEXT,
    "cultural_background" JSONB,
    "current_country" TEXT,
    "birth_country" TEXT,
    "preferred_language" TEXT,
    "family_health_history" JSONB,

    CONSTRAINT "participant_context_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reproductive_history" (
    "id" TEXT NOT NULL,
    "observationId" TEXT NOT NULL,
    "ever_pregnant" TEXT,
    "pregnancy_count" TEXT,
    "pregnancy_loss_history" TEXT,
    "trying_to_conceive" TEXT,

    CONSTRAINT "reproductive_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bleeding_patterns" (
    "id" TEXT NOT NULL,
    "observationId" TEXT NOT NULL,
    "product_change_frequency" TEXT,
    "bleeding_duration" TEXT,
    "clot_size" TEXT,
    "interperiod_bleeding" TEXT,
    "bleeding_progression" JSONB,
    "bleeding_impact" JSONB,

    CONSTRAINT "bleeding_patterns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pain_patterns" (
    "id" TEXT NOT NULL,
    "observationId" TEXT NOT NULL,
    "pain_pattern" TEXT,
    "pain_timing" JSONB,
    "pain_location" JSONB,
    "pain_triggers" JSONB,
    "pain_predictability" TEXT,
    "pain_severity_change" TEXT,
    "pelvic_symptoms" JSONB,

    CONSTRAINT "pain_patterns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cycle_patterns" (
    "id" TEXT NOT NULL,
    "observationId" TEXT NOT NULL,
    "cycle_predictability" TEXT,
    "skipped_periods" TEXT,
    "hormonal_signs" JSONB,
    "cycle_changes" TEXT,
    "symptoms_related_to" TEXT,

    CONSTRAINT "cycle_patterns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_life" (
    "id" TEXT NOT NULL,
    "observationId" TEXT NOT NULL,
    "function_impact" JSONB,
    "missed_activities" TEXT,
    "fatigue_frequency" TEXT,
    "sleep_disruption" TEXT,
    "dizziness_frequency" TEXT,
    "life_disruption" TEXT,
    "life_areas_affected" JSONB,
    "normalcy_perception" TEXT,
    "symptom_duration" TEXT,
    "symptom_predictability" TEXT,
    "symptom_severity" TEXT,
    "body_changes" JSONB,

    CONSTRAINT "daily_life_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_access" (
    "id" TEXT NOT NULL,
    "observationId" TEXT NOT NULL,
    "spoken_to_provider" TEXT,
    "care_response" JSONB,
    "care_dismissal" TEXT,
    "access_to_care" TEXT,

    CONSTRAINT "care_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sensitive_topics" (
    "id" TEXT NOT NULL,
    "observationId" TEXT NOT NULL,
    "pain_during_sex" TEXT,
    "bowel_symptoms" TEXT,
    "bladder_symptoms" TEXT,

    CONSTRAINT "sensitive_topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "narratives" (
    "id" TEXT NOT NULL,
    "observationId" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "textResponse" TEXT,
    "audioUrl" TEXT,
    "transcription" TEXT,
    "language" TEXT,
    "status" TEXT NOT NULL DEFAULT 'completed',

    CONSTRAINT "narratives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signals" (
    "id" TEXT NOT NULL,
    "observationId" TEXT NOT NULL,
    "signalId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "evidence" JSONB,

    CONSTRAINT "signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atlas_records" (
    "id" TEXT NOT NULL,
    "observationId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "burdenLevel" TEXT,
    "reflection_summary" JSONB,
    "constellation_scores" JSONB,
    "observed_patterns" JSONB,
    "record_payload" JSONB,
    "download_url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "atlas_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkin_drafts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "previousObservationId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checkin_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atlas_checkins" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "previousAtlasRecordId" TEXT,
    "checkin_payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "atlas_checkins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atlas_intelligence_runs" (
    "id" TEXT NOT NULL,
    "traceId" TEXT NOT NULL,
    "observationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pipelineVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "governancePassed" BOOLEAN NOT NULL DEFAULT true,
    "timings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "atlas_intelligence_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atlas_observations" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "displayText" TEXT NOT NULL,
    "screenId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "atlas_observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atlas_signals" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "signalType" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "observationBusinessIds" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "atlas_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atlas_patterns" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "observationConfidence" DOUBLE PRECISION NOT NULL,
    "meaning" TEXT NOT NULL,
    "atlasNote" TEXT NOT NULL,
    "watchOverTime" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "atlas_patterns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atlas_indices" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "patternBusinessIds" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "atlas_indices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atlas_reflection_plans" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "traceId" TEXT NOT NULL,
    "archetypeId" TEXT NOT NULL,
    "archetypeName" TEXT NOT NULL,
    "tone" TEXT NOT NULL,
    "plan" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "atlas_reflection_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atlas_reflections" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "traceId" TEXT NOT NULL,
    "reflection" JSONB NOT NULL,
    "atlasRecord" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "atlas_reflections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atlas_explainability" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "traceId" TEXT NOT NULL,
    "steps" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "atlas_explainability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atlas_trajectory" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "patternBusinessId" TEXT NOT NULL,
    "watchArea" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "atlas_trajectory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atlas_governance" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "violations" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "atlas_governance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_graph_runs" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "context" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_graph_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "steward_reviews" (
    "id" TEXT NOT NULL,
    "observationId" TEXT NOT NULL,
    "stewardId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "clinicalNotes" TEXT,
    "flagReason" TEXT,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "steward_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL DEFAULT '',
    "entityType" TEXT NOT NULL DEFAULT '',
    "actionType" "ActionType" NOT NULL DEFAULT 'CREATE',
    "dataBefore" JSONB,
    "dataAfter" JSONB,
    "userId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_conversations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "audioUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "form_flows_key_key" ON "form_flows"("key");

-- CreateIndex
CREATE UNIQUE INDEX "form_screens_screenId_key" ON "form_screens"("screenId");

-- CreateIndex
CREATE UNIQUE INDEX "form_questions_fieldId_key" ON "form_questions"("fieldId");

-- CreateIndex
CREATE INDEX "form_questions_screenId_idx" ON "form_questions"("screenId");

-- CreateIndex
CREATE INDEX "form_answer_options_questionId_idx" ON "form_answer_options"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "narrative_prompts_promptId_key" ON "narrative_prompts"("promptId");

-- CreateIndex
CREATE INDEX "narrative_prompts_screenId_idx" ON "narrative_prompts"("screenId");

-- CreateIndex
CREATE UNIQUE INDEX "form_translations_key_key" ON "form_translations"("key");

-- CreateIndex
CREATE UNIQUE INDEX "form_translation_data_translationId_locale_key" ON "form_translation_data"("translationId", "locale");

-- CreateIndex
CREATE INDEX "screen_routes_fromScreenId_idx" ON "screen_routes"("fromScreenId");

-- CreateIndex
CREATE UNIQUE INDEX "signal_rules_signalId_key" ON "signal_rules"("signalId");

-- CreateIndex
CREATE UNIQUE INDEX "reflection_rules_ruleId_key" ON "reflection_rules"("ruleId");

-- CreateIndex
CREATE INDEX "observations_userId_idx" ON "observations"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "observation_responses_observationId_fieldId_key" ON "observation_responses"("observationId", "fieldId");

-- CreateIndex
CREATE UNIQUE INDEX "observation_consents_observationId_key" ON "observation_consents"("observationId");

-- CreateIndex
CREATE UNIQUE INDEX "observation_safety_observationId_key" ON "observation_safety"("observationId");

-- CreateIndex
CREATE UNIQUE INDEX "participant_context_observationId_key" ON "participant_context"("observationId");

-- CreateIndex
CREATE UNIQUE INDEX "reproductive_history_observationId_key" ON "reproductive_history"("observationId");

-- CreateIndex
CREATE UNIQUE INDEX "bleeding_patterns_observationId_key" ON "bleeding_patterns"("observationId");

-- CreateIndex
CREATE UNIQUE INDEX "pain_patterns_observationId_key" ON "pain_patterns"("observationId");

-- CreateIndex
CREATE UNIQUE INDEX "cycle_patterns_observationId_key" ON "cycle_patterns"("observationId");

-- CreateIndex
CREATE UNIQUE INDEX "daily_life_observationId_key" ON "daily_life"("observationId");

-- CreateIndex
CREATE UNIQUE INDEX "care_access_observationId_key" ON "care_access"("observationId");

-- CreateIndex
CREATE UNIQUE INDEX "sensitive_topics_observationId_key" ON "sensitive_topics"("observationId");

-- CreateIndex
CREATE UNIQUE INDEX "narratives_observationId_promptId_key" ON "narratives"("observationId", "promptId");

-- CreateIndex
CREATE INDEX "signals_observationId_idx" ON "signals"("observationId");

-- CreateIndex
CREATE UNIQUE INDEX "atlas_records_observationId_key" ON "atlas_records"("observationId");

-- CreateIndex
CREATE UNIQUE INDEX "checkin_drafts_userId_key" ON "checkin_drafts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "atlas_intelligence_runs_traceId_key" ON "atlas_intelligence_runs"("traceId");

-- CreateIndex
CREATE INDEX "atlas_intelligence_runs_observationId_idx" ON "atlas_intelligence_runs"("observationId");

-- CreateIndex
CREATE INDEX "atlas_intelligence_runs_traceId_idx" ON "atlas_intelligence_runs"("traceId");

-- CreateIndex
CREATE INDEX "atlas_observations_runId_idx" ON "atlas_observations"("runId");

-- CreateIndex
CREATE INDEX "atlas_signals_runId_idx" ON "atlas_signals"("runId");

-- CreateIndex
CREATE INDEX "atlas_patterns_runId_idx" ON "atlas_patterns"("runId");

-- CreateIndex
CREATE INDEX "atlas_indices_runId_idx" ON "atlas_indices"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "atlas_reflection_plans_runId_key" ON "atlas_reflection_plans"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "atlas_reflections_runId_key" ON "atlas_reflections"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "atlas_explainability_runId_key" ON "atlas_explainability"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "atlas_explainability_traceId_key" ON "atlas_explainability"("traceId");

-- CreateIndex
CREATE INDEX "atlas_trajectory_runId_idx" ON "atlas_trajectory"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "atlas_governance_runId_key" ON "atlas_governance"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_graph_runs_runId_key" ON "knowledge_graph_runs"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "steward_reviews_observationId_key" ON "steward_reviews"("observationId");

-- CreateIndex
CREATE INDEX "chat_conversations_userId_idx" ON "chat_conversations"("userId");

-- CreateIndex
CREATE INDEX "chat_messages_conversationId_idx" ON "chat_messages"("conversationId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_screens" ADD CONSTRAINT "form_screens_flowKey_fkey" FOREIGN KEY ("flowKey") REFERENCES "form_flows"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_questions" ADD CONSTRAINT "form_questions_screenId_fkey" FOREIGN KEY ("screenId") REFERENCES "form_screens"("screenId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_answer_options" ADD CONSTRAINT "form_answer_options_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "form_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "narrative_prompts" ADD CONSTRAINT "narrative_prompts_screenId_fkey" FOREIGN KEY ("screenId") REFERENCES "form_screens"("screenId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_translation_data" ADD CONSTRAINT "form_translation_data_translationId_fkey" FOREIGN KEY ("translationId") REFERENCES "form_translations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "screen_routes" ADD CONSTRAINT "screen_routes_fromScreenId_fkey" FOREIGN KEY ("fromScreenId") REFERENCES "form_screens"("screenId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observations" ADD CONSTRAINT "observations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observation_responses" ADD CONSTRAINT "observation_responses_observationId_fkey" FOREIGN KEY ("observationId") REFERENCES "observations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observation_consents" ADD CONSTRAINT "observation_consents_observationId_fkey" FOREIGN KEY ("observationId") REFERENCES "observations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observation_safety" ADD CONSTRAINT "observation_safety_observationId_fkey" FOREIGN KEY ("observationId") REFERENCES "observations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participant_context" ADD CONSTRAINT "participant_context_observationId_fkey" FOREIGN KEY ("observationId") REFERENCES "observations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reproductive_history" ADD CONSTRAINT "reproductive_history_observationId_fkey" FOREIGN KEY ("observationId") REFERENCES "observations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bleeding_patterns" ADD CONSTRAINT "bleeding_patterns_observationId_fkey" FOREIGN KEY ("observationId") REFERENCES "observations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pain_patterns" ADD CONSTRAINT "pain_patterns_observationId_fkey" FOREIGN KEY ("observationId") REFERENCES "observations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle_patterns" ADD CONSTRAINT "cycle_patterns_observationId_fkey" FOREIGN KEY ("observationId") REFERENCES "observations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_life" ADD CONSTRAINT "daily_life_observationId_fkey" FOREIGN KEY ("observationId") REFERENCES "observations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_access" ADD CONSTRAINT "care_access_observationId_fkey" FOREIGN KEY ("observationId") REFERENCES "observations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sensitive_topics" ADD CONSTRAINT "sensitive_topics_observationId_fkey" FOREIGN KEY ("observationId") REFERENCES "observations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "narratives" ADD CONSTRAINT "narratives_observationId_fkey" FOREIGN KEY ("observationId") REFERENCES "observations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signals" ADD CONSTRAINT "signals_observationId_fkey" FOREIGN KEY ("observationId") REFERENCES "observations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atlas_records" ADD CONSTRAINT "atlas_records_observationId_fkey" FOREIGN KEY ("observationId") REFERENCES "observations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkin_drafts" ADD CONSTRAINT "checkin_drafts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atlas_checkins" ADD CONSTRAINT "atlas_checkins_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atlas_intelligence_runs" ADD CONSTRAINT "atlas_intelligence_runs_observationId_fkey" FOREIGN KEY ("observationId") REFERENCES "observations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atlas_observations" ADD CONSTRAINT "atlas_observations_runId_fkey" FOREIGN KEY ("runId") REFERENCES "atlas_intelligence_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atlas_signals" ADD CONSTRAINT "atlas_signals_runId_fkey" FOREIGN KEY ("runId") REFERENCES "atlas_intelligence_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atlas_patterns" ADD CONSTRAINT "atlas_patterns_runId_fkey" FOREIGN KEY ("runId") REFERENCES "atlas_intelligence_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atlas_indices" ADD CONSTRAINT "atlas_indices_runId_fkey" FOREIGN KEY ("runId") REFERENCES "atlas_intelligence_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atlas_reflection_plans" ADD CONSTRAINT "atlas_reflection_plans_runId_fkey" FOREIGN KEY ("runId") REFERENCES "atlas_intelligence_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atlas_reflections" ADD CONSTRAINT "atlas_reflections_runId_fkey" FOREIGN KEY ("runId") REFERENCES "atlas_intelligence_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atlas_explainability" ADD CONSTRAINT "atlas_explainability_runId_fkey" FOREIGN KEY ("runId") REFERENCES "atlas_intelligence_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atlas_trajectory" ADD CONSTRAINT "atlas_trajectory_runId_fkey" FOREIGN KEY ("runId") REFERENCES "atlas_intelligence_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atlas_governance" ADD CONSTRAINT "atlas_governance_runId_fkey" FOREIGN KEY ("runId") REFERENCES "atlas_intelligence_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_graph_runs" ADD CONSTRAINT "knowledge_graph_runs_runId_fkey" FOREIGN KEY ("runId") REFERENCES "atlas_intelligence_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "steward_reviews" ADD CONSTRAINT "steward_reviews_observationId_fkey" FOREIGN KEY ("observationId") REFERENCES "observations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "steward_reviews" ADD CONSTRAINT "steward_reviews_stewardId_fkey" FOREIGN KEY ("stewardId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "chat_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

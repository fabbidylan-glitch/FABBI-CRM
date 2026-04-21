-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'SALES', 'MANAGER', 'REVIEWER', 'MARKETING', 'READ_ONLY');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'MERGED');

-- CreateEnum
CREATE TYPE "PipelineStage" AS ENUM ('NEW_LEAD', 'CONTACTED', 'QUALIFIED', 'CONSULT_BOOKED', 'CONSULT_COMPLETED', 'PROPOSAL_DRAFTING', 'PROPOSAL_SENT', 'FOLLOW_UP_NEGOTIATION', 'WON', 'LOST', 'COLD_NURTURE');

-- CreateEnum
CREATE TYPE "QualificationStatus" AS ENUM ('UNREVIEWED', 'QUALIFIED', 'MANUAL_REVIEW', 'NURTURE_ONLY', 'DISQUALIFIED');

-- CreateEnum
CREATE TYPE "LeadGrade" AS ENUM ('A', 'B', 'C', 'D');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('WEBSITE', 'LANDING_PAGE', 'GOOGLE_ADS', 'META_ADS', 'LINKEDIN_ADS', 'ORGANIC_SEARCH', 'ORGANIC_BRANDED', 'REFERRAL', 'PARTNER_REFERRAL', 'CALENDLY', 'MANUAL', 'CSV_IMPORT', 'EVENT', 'PODCAST', 'OTHER');

-- CreateEnum
CREATE TYPE "Niche" AS ENUM ('STR_OWNER', 'AIRBNB_VRBO_OPERATOR', 'REAL_ESTATE_INVESTOR', 'HIGH_INCOME_STR_STRATEGY', 'MULTI_SERVICE_CLIENT', 'GENERAL_SMB', 'OTHER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "FitType" AS ENUM ('ICP_PREMIUM', 'ICP', 'STRETCH', 'NON_FIT', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ServiceInterest" AS ENUM ('TAX_PREP', 'BOOKKEEPING', 'TAX_STRATEGY', 'BOOKKEEPING_AND_TAX', 'CFO', 'FULL_SERVICE', 'UNSURE');

-- CreateEnum
CREATE TYPE "AnnualRevenueRange" AS ENUM ('UNDER_250K', 'FROM_250K_TO_500K', 'FROM_500K_TO_1M', 'OVER_1M', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "AnnualProfitRange" AS ENUM ('UNDER_50K', 'FROM_50K_TO_150K', 'FROM_150K_TO_500K', 'OVER_500K', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "TaxesPaidRange" AS ENUM ('UNDER_10K', 'FROM_10K_TO_25K', 'FROM_25K_TO_50K', 'FROM_50K_TO_100K', 'OVER_100K', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "PropertyCountBucket" AS ENUM ('NONE', 'ONE', 'TWO_TO_FOUR', 'FIVE_TO_NINE', 'TEN_PLUS', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "UrgencyLevel" AS ENUM ('RESEARCHING', 'NEXT_30_DAYS', 'NOW', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "PreferredContactMethod" AS ENUM ('EMAIL', 'PHONE', 'SMS', 'WHATSAPP', 'ANY');

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('CALL', 'EMAIL', 'SMS', 'WHATSAPP', 'MEETING', 'REVIEW', 'INTERNAL', 'OTHER');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "CommunicationChannel" AS ENUM ('EMAIL', 'SMS', 'WHATSAPP', 'CALL', 'OTHER');

-- CreateEnum
CREATE TYPE "CommunicationDirection" AS ENUM ('OUTBOUND', 'INBOUND');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'OPENED', 'CLICKED', 'REPLIED', 'FAILED', 'BOUNCED', 'UNDELIVERED');

-- CreateEnum
CREATE TYPE "SequenceStatus" AS ENUM ('ENROLLED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'EXITED');

-- CreateEnum
CREATE TYPE "SequenceExitReason" AS ENUM ('COMPLETED', 'REPLIED', 'PROPOSAL_ACCEPTED', 'PROPOSAL_DECLINED', 'MANUAL_STOP', 'DISQUALIFIED', 'ERROR');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'DECLINED', 'WITHDRAWN', 'EXPIRED');

-- CreateEnum
CREATE TYPE "HandoffStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'SYNCED', 'FAILED', 'MANUAL_OVERRIDE');

-- CreateEnum
CREATE TYPE "DestinationSystem" AS ENUM ('DOUBLE', 'KEEPER', 'OTHER');

-- CreateEnum
CREATE TYPE "NoteType" AS ENUM ('GENERAL', 'CALL_SUMMARY', 'MEETING_SUMMARY', 'DISCOVERY', 'INTERNAL');

-- CreateEnum
CREATE TYPE "PipelineEventType" AS ENUM ('LEAD_CREATED', 'SUBMISSION_RECEIVED', 'STAGE_CHANGED', 'OWNER_CHANGED', 'SCORE_UPDATED', 'QUALIFICATION_UPDATED', 'NOTE_ADDED', 'TASK_CREATED', 'TASK_COMPLETED', 'COMMUNICATION_SENT', 'COMMUNICATION_RECEIVED', 'CONSULT_BOOKED', 'CONSULT_COMPLETED', 'CONSULT_NO_SHOW', 'PROPOSAL_DRAFTED', 'PROPOSAL_SENT', 'PROPOSAL_VIEWED', 'PROPOSAL_ACCEPTED', 'PROPOSAL_DECLINED', 'HANDOFF_STARTED', 'HANDOFF_COMPLETED', 'SEQUENCE_ENROLLED', 'SEQUENCE_EXITED', 'ARCHIVED', 'OTHER');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'SALES',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "external_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "full_name" TEXT,
    "email" TEXT,
    "email_normalized" TEXT,
    "phone" TEXT,
    "phone_e164" TEXT,
    "company_name" TEXT,
    "website_url" TEXT,
    "airbnb_or_listing_url" TEXT,
    "preferred_contact_method" "PreferredContactMethod" NOT NULL DEFAULT 'ANY',
    "source" "LeadSource" NOT NULL DEFAULT 'WEBSITE',
    "source_detail" TEXT,
    "referral_source" TEXT,
    "campaign_name" TEXT,
    "ad_group" TEXT,
    "keyword" TEXT,
    "utm_source" TEXT,
    "utm_medium" TEXT,
    "utm_campaign" TEXT,
    "utm_term" TEXT,
    "utm_content" TEXT,
    "niche" "Niche" NOT NULL DEFAULT 'UNKNOWN',
    "fit_type" "FitType" NOT NULL DEFAULT 'UNKNOWN',
    "service_interest" "ServiceInterest" NOT NULL DEFAULT 'UNSURE',
    "annual_revenue_range" "AnnualRevenueRange" NOT NULL DEFAULT 'UNKNOWN',
    "annual_profit_range" "AnnualProfitRange" NOT NULL DEFAULT 'UNKNOWN',
    "taxes_paid_last_year_range" "TaxesPaidRange" NOT NULL DEFAULT 'UNKNOWN',
    "payroll_flag" BOOLEAN NOT NULL DEFAULT false,
    "w2_income_flag" BOOLEAN NOT NULL DEFAULT false,
    "other_business_income_flag" BOOLEAN NOT NULL DEFAULT false,
    "property_count" "PropertyCountBucket" NOT NULL DEFAULT 'UNKNOWN',
    "states_of_operation" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "urgency" "UrgencyLevel" NOT NULL DEFAULT 'UNKNOWN',
    "current_advisor_flag" BOOLEAN NOT NULL DEFAULT false,
    "pain_point" TEXT,
    "desired_start_date" TIMESTAMP(3),
    "notes" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'ACTIVE',
    "pipeline_stage" "PipelineStage" NOT NULL DEFAULT 'NEW_LEAD',
    "owner_user_id" TEXT,
    "lead_score" INTEGER NOT NULL DEFAULT 0,
    "lead_grade" "LeadGrade",
    "qualification_status" "QualificationStatus" NOT NULL DEFAULT 'UNREVIEWED',
    "estimated_annual_value" DECIMAL(12,2),
    "disqualification_reason" TEXT,
    "lost_reason_id" TEXT,
    "last_contacted_at" TIMESTAMP(3),
    "next_action_at" TIMESTAMP(3),
    "next_action_type" "TaskType",
    "last_source_touch_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_submissions" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "source_type" "LeadSource" NOT NULL,
    "payload_json" JSONB NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "referer" TEXT,
    "landing_page_url" TEXT,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_score_breakdowns" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "revenue_score" INTEGER NOT NULL DEFAULT 0,
    "tax_score" INTEGER NOT NULL DEFAULT 0,
    "service_score" INTEGER NOT NULL DEFAULT 0,
    "fit_score" INTEGER NOT NULL DEFAULT 0,
    "urgency_score" INTEGER NOT NULL DEFAULT 0,
    "source_score" INTEGER NOT NULL DEFAULT 0,
    "complexity_score" INTEGER NOT NULL DEFAULT 0,
    "booked_consult_score" INTEGER NOT NULL DEFAULT 0,
    "total_score" INTEGER NOT NULL DEFAULT 0,
    "rules_version" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_score_breakdowns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_events" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "event_type" "PipelineEventType" NOT NULL,
    "from_stage" "PipelineStage",
    "to_stage" "PipelineStage",
    "note" TEXT,
    "metadata_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pipeline_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_notes" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "author_user_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "note_type" "NoteType" NOT NULL DEFAULT 'GENERAL',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "assigned_user_id" TEXT,
    "task_type" "TaskType" NOT NULL DEFAULT 'CALL',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "due_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "status" "TaskStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "metadata_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communications" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "channel" "CommunicationChannel" NOT NULL,
    "direction" "CommunicationDirection" NOT NULL,
    "template_key" TEXT,
    "subject" TEXT,
    "body_text" TEXT NOT NULL,
    "external_message_id" TEXT,
    "delivery_status" "DeliveryStatus" NOT NULL DEFAULT 'QUEUED',
    "sent_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "opened_at" TIMESTAMP(3),
    "clicked_at" TIMESTAMP(3),
    "replied_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "metadata_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "communications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_templates" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" "CommunicationChannel" NOT NULL,
    "category" TEXT NOT NULL,
    "subject" TEXT,
    "body_text" TEXT NOT NULL,
    "variables" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sequence_enrollments" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "sequence_key" TEXT NOT NULL,
    "status" "SequenceStatus" NOT NULL DEFAULT 'ENROLLED',
    "enrolled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exited_at" TIMESTAMP(3),
    "exit_reason" "SequenceExitReason",
    "current_step_index" INTEGER NOT NULL DEFAULT 0,
    "next_step_at" TIMESTAMP(3),
    "metadata_json" JSONB,

    CONSTRAINT "sequence_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposals" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "external_proposal_id" TEXT,
    "proposal_status" "ProposalStatus" NOT NULL DEFAULT 'DRAFT',
    "service_package" TEXT,
    "monthly_value" DECIMAL(12,2),
    "annual_value" DECIMAL(12,2),
    "sent_at" TIMESTAMP(3),
    "viewed_at" TIMESTAMP(3),
    "accepted_at" TIMESTAMP(3),
    "declined_at" TIMESTAMP(3),
    "external_payload_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_handoffs" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "proposal_id" TEXT,
    "destination_system" "DestinationSystem" NOT NULL,
    "handoff_status" "HandoffStatus" NOT NULL DEFAULT 'PENDING',
    "payload_json" JSONB NOT NULL,
    "external_client_id" TEXT,
    "synced_at" TIMESTAMP(3),
    "error_message" TEXT,
    "retries" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_handoffs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lost_reasons" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "lost_reasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_spend" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "source" "LeadSource" NOT NULL,
    "campaign_name" TEXT,
    "spend_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "leads_count" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketing_spend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rule_configs" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value_json" JSONB NOT NULL,
    "description" TEXT,
    "updated_by_user_id" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rule_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_merges" (
    "id" TEXT NOT NULL,
    "source_lead_id" TEXT NOT NULL,
    "target_lead_id" TEXT NOT NULL,
    "reason" TEXT,
    "merged_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_merges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_external_id_key" ON "users"("external_id");

-- CreateIndex
CREATE INDEX "users_role_is_active_idx" ON "users"("role", "is_active");

-- CreateIndex
CREATE INDEX "leads_pipeline_stage_status_idx" ON "leads"("pipeline_stage", "status");

-- CreateIndex
CREATE INDEX "leads_qualification_status_lead_score_idx" ON "leads"("qualification_status", "lead_score");

-- CreateIndex
CREATE INDEX "leads_owner_user_id_pipeline_stage_idx" ON "leads"("owner_user_id", "pipeline_stage");

-- CreateIndex
CREATE INDEX "leads_source_created_at_idx" ON "leads"("source", "created_at");

-- CreateIndex
CREATE INDEX "leads_email_normalized_idx" ON "leads"("email_normalized");

-- CreateIndex
CREATE INDEX "leads_phone_e164_idx" ON "leads"("phone_e164");

-- CreateIndex
CREATE INDEX "leads_created_at_idx" ON "leads"("created_at");

-- CreateIndex
CREATE INDEX "lead_submissions_lead_id_submitted_at_idx" ON "lead_submissions"("lead_id", "submitted_at");

-- CreateIndex
CREATE INDEX "lead_submissions_source_type_submitted_at_idx" ON "lead_submissions"("source_type", "submitted_at");

-- CreateIndex
CREATE INDEX "lead_score_breakdowns_lead_id_created_at_idx" ON "lead_score_breakdowns"("lead_id", "created_at");

-- CreateIndex
CREATE INDEX "pipeline_events_lead_id_created_at_idx" ON "pipeline_events"("lead_id", "created_at");

-- CreateIndex
CREATE INDEX "pipeline_events_event_type_created_at_idx" ON "pipeline_events"("event_type", "created_at");

-- CreateIndex
CREATE INDEX "lead_notes_lead_id_created_at_idx" ON "lead_notes"("lead_id", "created_at");

-- CreateIndex
CREATE INDEX "tasks_lead_id_status_idx" ON "tasks"("lead_id", "status");

-- CreateIndex
CREATE INDEX "tasks_assigned_user_id_status_due_at_idx" ON "tasks"("assigned_user_id", "status", "due_at");

-- CreateIndex
CREATE INDEX "tasks_due_at_status_idx" ON "tasks"("due_at", "status");

-- CreateIndex
CREATE INDEX "communications_lead_id_created_at_idx" ON "communications"("lead_id", "created_at");

-- CreateIndex
CREATE INDEX "communications_channel_delivery_status_idx" ON "communications"("channel", "delivery_status");

-- CreateIndex
CREATE INDEX "communications_external_message_id_idx" ON "communications"("external_message_id");

-- CreateIndex
CREATE UNIQUE INDEX "message_templates_key_key" ON "message_templates"("key");

-- CreateIndex
CREATE INDEX "message_templates_channel_is_active_idx" ON "message_templates"("channel", "is_active");

-- CreateIndex
CREATE INDEX "sequence_enrollments_status_next_step_at_idx" ON "sequence_enrollments"("status", "next_step_at");

-- CreateIndex
CREATE INDEX "sequence_enrollments_sequence_key_status_idx" ON "sequence_enrollments"("sequence_key", "status");

-- CreateIndex
CREATE UNIQUE INDEX "sequence_enrollments_lead_id_sequence_key_key" ON "sequence_enrollments"("lead_id", "sequence_key");

-- CreateIndex
CREATE UNIQUE INDEX "proposals_external_proposal_id_key" ON "proposals"("external_proposal_id");

-- CreateIndex
CREATE INDEX "proposals_lead_id_proposal_status_idx" ON "proposals"("lead_id", "proposal_status");

-- CreateIndex
CREATE INDEX "proposals_proposal_status_sent_at_idx" ON "proposals"("proposal_status", "sent_at");

-- CreateIndex
CREATE INDEX "client_handoffs_lead_id_handoff_status_idx" ON "client_handoffs"("lead_id", "handoff_status");

-- CreateIndex
CREATE INDEX "client_handoffs_destination_system_handoff_status_idx" ON "client_handoffs"("destination_system", "handoff_status");

-- CreateIndex
CREATE UNIQUE INDEX "lost_reasons_code_key" ON "lost_reasons"("code");

-- CreateIndex
CREATE INDEX "marketing_spend_source_date_idx" ON "marketing_spend"("source", "date");

-- CreateIndex
CREATE UNIQUE INDEX "marketing_spend_date_source_campaign_name_key" ON "marketing_spend"("date", "source", "campaign_name");

-- CreateIndex
CREATE UNIQUE INDEX "rule_configs_key_key" ON "rule_configs"("key");

-- CreateIndex
CREATE INDEX "lead_merges_target_lead_id_idx" ON "lead_merges"("target_lead_id");

-- CreateIndex
CREATE UNIQUE INDEX "lead_merges_source_lead_id_key" ON "lead_merges"("source_lead_id");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_lost_reason_id_fkey" FOREIGN KEY ("lost_reason_id") REFERENCES "lost_reasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_submissions" ADD CONSTRAINT "lead_submissions_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_score_breakdowns" ADD CONSTRAINT "lead_score_breakdowns_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_events" ADD CONSTRAINT "pipeline_events_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_events" ADD CONSTRAINT "pipeline_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_notes" ADD CONSTRAINT "lead_notes_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_notes" ADD CONSTRAINT "lead_notes_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_user_id_fkey" FOREIGN KEY ("assigned_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communications" ADD CONSTRAINT "communications_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sequence_enrollments" ADD CONSTRAINT "sequence_enrollments_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_handoffs" ADD CONSTRAINT "client_handoffs_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_handoffs" ADD CONSTRAINT "client_handoffs_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_spend" ADD CONSTRAINT "marketing_spend_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rule_configs" ADD CONSTRAINT "rule_configs_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_merges" ADD CONSTRAINT "lead_merges_source_lead_id_fkey" FOREIGN KEY ("source_lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_merges" ADD CONSTRAINT "lead_merges_target_lead_id_fkey" FOREIGN KEY ("target_lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Make `external_message_id` unique so inbound WhatsApp webhooks (which Meta
-- retries on non-200 responses) can be deduped via upsert.
-- Drops the old non-unique index because the unique constraint replaces it.

DROP INDEX IF EXISTS "communications_external_message_id_idx";

CREATE UNIQUE INDEX "communications_external_message_id_key"
  ON "communications" ("external_message_id");

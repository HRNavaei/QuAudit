-- Migration: 20231121010000_remove_questionnaire_self_reference
-- Drop self-referencing foreign key and column on questionnaires
ALTER TABLE "questionnaires" DROP CONSTRAINT IF EXISTS "questionnaires_parent_id_fkey";
ALTER TABLE "questionnaires" DROP COLUMN IF EXISTS "parent_id";

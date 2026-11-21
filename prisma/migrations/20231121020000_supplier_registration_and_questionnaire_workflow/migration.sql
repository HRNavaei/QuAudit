-- Migration: 20231121020000_supplier_registration_and_questionnaire_workflow

-- 1. Pre-checks for duplicate titles
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM questionnaires
    GROUP BY title
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot apply unique index: duplicate questionnaire titles detected in existing data';
  END IF;
END $$;

-- 2. Add is_approved column to suppliers and approve existing suppliers
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "is_approved" BOOLEAN NOT NULL DEFAULT false;
UPDATE "suppliers" SET "is_approved" = true;

-- 3. Drop version and parent_id columns from questionnaires if still present
ALTER TABLE "questionnaires" DROP CONSTRAINT IF EXISTS "questionnaires_parent_id_fkey";
ALTER TABLE "questionnaires" DROP COLUMN IF EXISTS "parent_id";
ALTER TABLE "questionnaires" DROP COLUMN IF EXISTS "version";

-- 4. Create unique index on questionnaire title
CREATE UNIQUE INDEX IF NOT EXISTS "questionnaires_title_key" ON "questionnaires"("title");

-- 5. Migrate questionnaire status to (DRAFT, ASSIGNED)
ALTER TABLE "questionnaires" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "questionnaires" ALTER COLUMN "status" TYPE TEXT USING "status"::text;

UPDATE "questionnaires"
SET "status" = CASE
  WHEN "status" = 'PUBLISHED' THEN 'ASSIGNED'
  WHEN "status" = 'ARCHIVED' THEN 'ASSIGNED'
  ELSE "status"
END;

DROP TYPE IF EXISTS "QuestionnaireStatus";
CREATE TYPE "QuestionnaireStatus" AS ENUM ('DRAFT', 'ASSIGNED');

ALTER TABLE "questionnaires" ALTER COLUMN "status" TYPE "QuestionnaireStatus" USING "status"::"QuestionnaireStatus";
ALTER TABLE "questionnaires" ALTER COLUMN "status" SET DEFAULT 'DRAFT'::"QuestionnaireStatus";

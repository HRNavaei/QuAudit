-- Migration: 20231121000000_add_integrity_enhancements
-- 1. Pre-checks for existing duplicates and orphaned records
DO $$
BEGIN
  -- Check for existing duplicate answers before creating unique index
  IF EXISTS (
    SELECT 1 FROM answers
    GROUP BY assignment_id, question_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot apply unique constraint: duplicate answers detected in existing data';
  END IF;

  -- Check for existing duplicate product-specific assignments
  IF EXISTS (
    SELECT 1 FROM questionnaire_assignments
    WHERE product_id IS NOT NULL
    GROUP BY questionnaire_id, supplier_id, product_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot apply unique index: duplicate product-specific assignments detected in existing data';
  END IF;

  -- Check for existing duplicate supplier-level assignments
  IF EXISTS (
    SELECT 1 FROM questionnaire_assignments
    WHERE product_id IS NULL
    GROUP BY questionnaire_id, supplier_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot apply unique index: duplicate supplier-level assignments detected in existing data';
  END IF;

  -- Check for orphaned created_by_id in questionnaires before creating foreign key
  IF EXISTS (
    SELECT 1 FROM questionnaires q
    LEFT JOIN users u ON u.id = q.created_by_id
    WHERE u.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot apply foreign key: questionnaires contain created_by_id referencing non-existent users';
  END IF;
END $$;

-- 2. Foreign Key: Questionnaire created_by_id -> users(id)
ALTER TABLE "questionnaires"
  ADD CONSTRAINT "questionnaires_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 3. Unique constraint: Answer (assignment_id, question_id)
CREATE UNIQUE INDEX "answers_assignment_id_question_id_key"
  ON "answers"("assignment_id", "question_id");

-- 4. Foreign Key: Change QuestionnaireAssignment product_id to ON DELETE RESTRICT
ALTER TABLE "questionnaire_assignments"
  DROP CONSTRAINT IF EXISTS "questionnaire_assignments_product_id_fkey";

ALTER TABLE "questionnaire_assignments"
  ADD CONSTRAINT "questionnaire_assignments_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 5. Partial Unique Indexes for QuestionnaireAssignment
-- Product-specific assignments
CREATE UNIQUE INDEX "idx_assignment_unique_product"
  ON "questionnaire_assignments"("questionnaire_id", "supplier_id", "product_id")
  WHERE "product_id" IS NOT NULL;

-- Supplier-level assignments (where product_id is NULL)
CREATE UNIQUE INDEX "idx_assignment_unique_supplier"
  ON "questionnaire_assignments"("questionnaire_id", "supplier_id")
  WHERE "product_id" IS NULL;

-- 6. Trigger Enhancements: Enforce constraints when referenced records are updated

-- 6.1 Check when product.supplier_id is updated
CREATE OR REPLACE FUNCTION check_product_supplier_update()
RETURNS trigger AS $$
BEGIN
  IF NEW.supplier_id <> OLD.supplier_id THEN
    IF EXISTS (
      SELECT 1 FROM questionnaire_assignments qa
      WHERE qa.product_id = NEW.id AND qa.supplier_id <> NEW.supplier_id
    ) THEN
      RAISE EXCEPTION 'Cannot transfer product to another supplier while assignments exist for the previous supplier';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_product_supplier_update ON products;
CREATE CONSTRAINT TRIGGER trg_check_product_supplier_update
AFTER UPDATE OF supplier_id ON products
FOR EACH ROW EXECUTE FUNCTION check_product_supplier_update();

-- 6.2 Check when question.questionnaire_id is updated
CREATE OR REPLACE FUNCTION check_question_questionnaire_update()
RETURNS trigger AS $$
BEGIN
  IF NEW.questionnaire_id <> OLD.questionnaire_id THEN
    -- Check if this question owns options whose follow-up belongs to another questionnaire
    IF EXISTS (
      SELECT 1 FROM question_options qo
      JOIN questions q_fu ON q_fu.id = qo.follow_up_question_id
      WHERE qo.question_id = NEW.id AND q_fu.questionnaire_id <> NEW.questionnaire_id
    ) THEN
      RAISE EXCEPTION 'Cannot move question: options contain follow-up questions from the original questionnaire';
    END IF;

    -- Check if this question is a follow-up for options belonging to another questionnaire
    IF EXISTS (
      SELECT 1 FROM question_options qo
      JOIN questions q_parent ON q_parent.id = qo.question_id
      WHERE qo.follow_up_question_id = NEW.id AND q_parent.questionnaire_id <> NEW.questionnaire_id
    ) THEN
      RAISE EXCEPTION 'Cannot move question: it is a follow-up question for options in the original questionnaire';
    END IF;

    -- Check if this question has answers belonging to assignments of the original questionnaire
    IF EXISTS (
      SELECT 1 FROM answers a
      JOIN questionnaire_assignments qa ON qa.id = a.assignment_id
      WHERE a.question_id = NEW.id AND qa.questionnaire_id <> NEW.questionnaire_id
    ) THEN
      RAISE EXCEPTION 'Cannot move question: question has answers associated with assignments of the original questionnaire';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_question_questionnaire_update ON questions;
CREATE CONSTRAINT TRIGGER trg_check_question_questionnaire_update
AFTER UPDATE OF questionnaire_id ON questions
FOR EACH ROW EXECUTE FUNCTION check_question_questionnaire_update();

-- 6.3 Check when questionnaire_assignments.questionnaire_id is updated
CREATE OR REPLACE FUNCTION check_assignment_questionnaire_update()
RETURNS trigger AS $$
BEGIN
  IF NEW.questionnaire_id <> OLD.questionnaire_id THEN
    IF EXISTS (
      SELECT 1 FROM answers a
      JOIN questions q ON q.id = a.question_id
      WHERE a.assignment_id = NEW.id AND q.questionnaire_id <> NEW.questionnaire_id
    ) THEN
      RAISE EXCEPTION 'Cannot change assignment questionnaire: answers already exist for questions of the original questionnaire';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_assignment_questionnaire_update ON questionnaire_assignments;
CREATE CONSTRAINT TRIGGER trg_check_assignment_questionnaire_update
AFTER UPDATE OF questionnaire_id ON questionnaire_assignments
FOR EACH ROW EXECUTE FUNCTION check_assignment_questionnaire_update();

-- 6.4 Check when question_options.question_id is updated
CREATE OR REPLACE FUNCTION check_option_question_update()
RETURNS trigger AS $$
BEGIN
  IF NEW.question_id <> OLD.question_id THEN
    IF EXISTS (
      SELECT 1 FROM answers a
      WHERE a.selected_option_id = NEW.id AND a.question_id <> NEW.question_id
    ) THEN
      RAISE EXCEPTION 'Cannot reassign option to another question: existing answers select this option for the original question';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_option_question_update ON question_options;
CREATE CONSTRAINT TRIGGER trg_check_option_question_update
AFTER UPDATE OF question_id ON question_options
FOR EACH ROW EXECUTE FUNCTION check_option_question_update();

-- Migration: add_business_triggers
-- This migration adds PostgreSQL constraint triggers that enforce the four mandatory business rules.

-- 1. Assignment–Product–Supplier consistency
CREATE OR REPLACE FUNCTION check_assignment_product_supplier()
RETURNS trigger AS $$
BEGIN
  IF NEW.product_id IS NOT NULL THEN
    PERFORM 1 FROM products p WHERE p.id = NEW.product_id AND p.supplier_id = NEW.supplier_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product does not belong to the assigned supplier';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_assignment_product_supplier ON questionnaire_assignments;
CREATE CONSTRAINT TRIGGER trg_check_assignment_product_supplier
AFTER INSERT OR UPDATE ON questionnaire_assignments
FOR EACH ROW EXECUTE FUNCTION check_assignment_product_supplier();

-- 2. Conditional question consistency (follow‑up question must belong to same questionnaire)
CREATE OR REPLACE FUNCTION check_option_followup_questionnaire()
RETURNS trigger AS $$
BEGIN
  IF NEW.follow_up_question_id IS NOT NULL THEN
    PERFORM 1 FROM questions q1
    JOIN questions q2 ON q1.id = NEW.question_id AND q2.id = NEW.follow_up_question_id
    WHERE q1.questionnaire_id = q2.questionnaire_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Follow‑up question must belong to the same questionnaire';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_option_followup_questionnaire ON question_options;
CREATE CONSTRAINT TRIGGER trg_check_option_followup_questionnaire
AFTER INSERT OR UPDATE ON question_options
FOR EACH ROW EXECUTE FUNCTION check_option_followup_questionnaire();

-- 3. Answer–Questionnaire consistency (answer's question must belong to the assignment's questionnaire)
CREATE OR REPLACE FUNCTION check_answer_questionnaire()
RETURNS trigger AS $$
BEGIN
  PERFORM 1 FROM questions q
  JOIN questionnaire_assignments qa ON qa.id = NEW.assignment_id
  WHERE q.id = NEW.question_id AND q.questionnaire_id = qa.questionnaire_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Answer question does not belong to the assignment questionnaire';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_answer_questionnaire ON answers;
CREATE CONSTRAINT TRIGGER trg_check_answer_questionnaire
AFTER INSERT OR UPDATE ON answers
FOR EACH ROW EXECUTE FUNCTION check_answer_questionnaire();

-- 4. Answer–QuestionOption consistency (selected option must belong to the same question)
CREATE OR REPLACE FUNCTION check_answer_option_question()
RETURNS trigger AS $$
BEGIN
  IF NEW.selected_option_id IS NOT NULL THEN
    PERFORM 1 FROM question_options qo
    WHERE qo.id = NEW.selected_option_id AND qo.question_id = NEW.question_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Selected option does not belong to the answer question';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_answer_option_question ON answers;
CREATE CONSTRAINT TRIGGER trg_check_answer_option_question
AFTER INSERT OR UPDATE ON answers
FOR EACH ROW EXECUTE FUNCTION check_answer_option_question();

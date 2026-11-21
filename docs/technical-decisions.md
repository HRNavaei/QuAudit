# Technical Decisions

## TD-001: Supervisor Entity Representation

**Decision:** The ER diagram lists 9 entities and does not include a separate `Supervisor` entity table. The functional requirements describe a SUPERVISOR role. We model supervisors as Users with `role = SUPERVISOR`. The ER diagram's `User` entity covers all three roles (ADMIN, SUPERVISOR, SUPPLIER). Only SUPPLIER role users have an associated `Supplier` record (1:0..1 relationship).

**Rationale:** The ER diagram explicitly shows only User–Supplier as a 1:0..1 relationship. There is no Supervisor entity in the diagram. The simplest correct design is to use the User table with a role enum.

## TD-002: Question Types and Answer Normalization

**Decision:** The system strictly supports four question types: `TEXT`, `YES_NO`, `SINGLE_CHOICE`, and `NUMBER`. `MULTIPLE_CHOICE` is excluded from the initial scope to preserve 1:1 question-answer cardinality. Each Answer record maps to exactly one Question within an Assignment, optionally referencing one selected QuestionOption via `selectedOptionId`.

**Rationale:** This design enforces database-level referential integrity without requiring an auxiliary AnswerOption junction entity.

**Uniqueness:** A unique constraint on `(assignment_id, question_id)` guarantees at most one answer per question within an assignment.

## TD-003: Questionnaire Versioning Strategy

**Decision:** Questionnaires follow the lifecycle `DRAFT` → `PUBLISHED` → `ARCHIVED`. Questionnaires are versioned using an integer `version` field (default 1) incremented upon cloning via `POST /api/questionnaires/:id/versions`, adhering strictly to the agreed 9-entity ER diagram without unnecessary self-referencing relationship overhead.

**Rationale:** Modifying published questionnaires with existing responses would compromise audit integrity. Cloning into an incremented version preserves historical audits while enabling iterative questionnaire authoring.

## TD-004: Response Editability Policy

**Decision:** Answers belong directly to a QuestionnaireAssignment. The assignment has a `status` field: PENDING → IN_PROGRESS → SUBMITTED. Once SUBMITTED, the supplier cannot edit or resubmit answers. A supervisor can optionally re-open an assignment (set back to IN_PROGRESS) to allow resubmission.

**Rationale:** Preventing post-submission edits ensures auditability. Allowing supervisors to re-open provides flexibility without compromising data integrity. When re-opened, previous answers are soft-deleted (or cleared) and new answers replace them.

## TD-005: Notification System Design

**Decision:** Notifications are stored in-database with sender, receiver, type, title, message, and read status. They are created as side-effects of business operations (e.g., questionnaire assignment). No external notification service (email, push) is implemented; the system provides an API for querying notifications.

**Rationale:** The ER diagram includes Notification with sender/receiver User relationships. A database-backed notification system satisfies the requirements without external service dependencies.

## TD-006: Business Constraint Enforcement Strategy

**Decision:** All four mandatory business constraints are enforced at the PostgreSQL level using CHECK constraints with custom functions or triggers in a custom migration, in addition to application-level validation.

1. **Assignment–Product–Supplier consistency**: Trigger on QuestionnaireAssignment INSERT/UPDATE.
2. **Conditional question consistency**: Trigger on QuestionOption INSERT/UPDATE of followUpQuestionId.
3. **Answer–Questionnaire consistency**: Trigger on Answer INSERT/UPDATE.
4. **Answer–QuestionOption consistency**: Trigger on Answer INSERT/UPDATE.

**Rationale:** The requirement explicitly states "Do not rely exclusively on application-level validation." Database triggers provide guaranteed enforcement regardless of how data is inserted.

## TD-007: Circular Dependency Detection for Conditional Questions

**Decision:** Circular conditional dependencies are prevented at the application level using graph traversal (DFS cycle detection) when configuring follow-up questions. A database trigger would be complex and expensive for cycle detection, so we enforce this in the service layer with clear error messages.

**Rationale:** Cycle detection in a directed graph is fundamentally an application-level concern. The database enforces that follow-up questions belong to the same questionnaire (TD-006 constraint #2), which limits the graph scope.

## TD-008: Answer Value Storage

**Decision:** The Answer entity stores values in a `textValue` (String), `numberValue` (Float), and `booleanValue` (Boolean) columns. The applicable column depends on the question type. `selectedOptionId` is used for SINGLE_CHOICE, YES_NO (mapped to options), and MULTIPLE_CHOICE questions.

**Rationale:** Typed columns allow PostgreSQL-level type safety. Using separate nullable columns is cleaner than a single polymorphic text field and allows database-level constraints.

## TD-009: Question Ordering

**Decision:** Questions have an `order` integer field within their questionnaire to define display sequence. QuestionOptions also have an `order` field.

**Rationale:** Without ordering, questions would display in arbitrary order. An explicit order field gives supervisors control over question sequence.

## TD-010: Assignment Duplicate Prevention

**Decision:** A unique constraint on (questionnaire_id, supplier_id, product_id) prevents duplicate assignments. Since product_id is nullable, we use a partial unique index: one for assignments with a product, and one for assignments without (product_id IS NULL uses questionnaire_id + supplier_id).

**Rationale:** The requirement says "Prevent unintended duplicate assignments." A database-level unique constraint is the most reliable approach. PostgreSQL treats NULL as distinct in unique constraints, so two partial indexes handle the nullable product case.

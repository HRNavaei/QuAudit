# Frontend Hand-off Guide: Supplier Monitoring & Questionnaire System

This document outlines the architecture, user roles, core workflows, and integration specifications needed to build the frontend application for the Supplier Monitoring and Questionnaire System.

---

## 1. API Specification & Server Details

- **Base URL:** `http://localhost:3000`
- **Swagger UI:** `http://localhost:3000/api/docs`
- **OpenAPI 3.0 JSON:** Located at `docs/openapi.json` or live at `http://localhost:3000/api/docs-json`
- **Authentication Scheme:** Standard HTTP Bearer JWT:
  ```http
  Authorization: Bearer <access_token>
  ```
- **Default Seeded Admin Credentials:**
  - **Email:** `admin@quaudit.com`
  - **Password:** `Admin@123456`

> **Tip for the Frontend Agent:** You can generate 100% type-safe API clients and TypeScript interfaces automatically using:
> `npx openapi-typescript docs/openapi.json -o src/api/schema.d.ts` or with `@hey-api/openapi-ts` / Orval.

---

## 2. User Roles & Permission Matrix

The application has three distinct user roles (`Role` enum):

| Role | Access Scope & Responsibilities |
|---|---|
| **ADMIN** | Full system administration. Can manage users, suppliers, products, questionnaires, assignments, view all submitted responses, and oversee audit data. |
| **SUPERVISOR** | Operations & Audit Manager. Can review and approve pending supplier registrations, create and clone questionnaires, manage questions and conditional follow-up branching, assign questionnaires to suppliers/products, review submitted responses, re-open assignments for revision, and request AI assessments. |
| **SUPPLIER** | External Vendor Portal. Strictly isolated to their own company profile and products. Can register their account and company profile (pending supervisor approval). Once approved, can view assigned questionnaires, answer questions interactively (with dynamic follow-up logic), submit final audits, and receive notifications. |

---

## 3. Recommended Frontend Views & Navigation

### A. Authentication & Onboarding
1. **Login Page (`/login`):** Email and password input. Calls `POST /api/auth/login`, stores JWT token (localStorage or HTTP-only cookie), and calls `GET /api/users/me` to determine role and redirect.
2. **Supplier Self-Registration Page (`/register`):** Single-step public registration (`POST /api/auth/register`) submitting:
   - Credentials: `email`, `password`, `firstName`, `lastName`
   - Company details: `companyName`, optional `description`, `phone`, `address`
   - Automatically creates both User and Supplier records with `isApproved = false`.
   - Directs the user to a "Pending Supervisor Approval" banner/page.
3. **Pending Approval State:** Pending suppliers attempting to access protected supplier endpoints receive `403 Forbidden` (`"Supplier account is pending supervisor approval"`). The UI should display a friendly waiting screen until a supervisor approves their registration.

### B. Supervisor & Admin Views
1. **Dashboard:** Overview of active questionnaires, total suppliers, pending registrations needing approval, and assignment progress (Pending, In Progress, Submitted).
2. **Pending Supplier Approvals (`/suppliers/pending` - Supervisor Only):**
   - Retrieves list of pending supplier registrations via `GET /api/suppliers/pending`.
   - Displays applicant information (Company Name, Contact Person, Email, Phone, Address, Description).
   - Action: **Approve Registration** (`PATCH /api/suppliers/:id/approve`). Once approved, the supplier gains normal dashboard access.
3. **Questionnaires Management (`/questionnaires`):**
   - List questionnaires with filter by status (`DRAFT`, `ASSIGNED`).
   - Create new questionnaire (`POST /api/questionnaires`) - starts in `DRAFT` status.
   - Questionnaire names must be strictly unique across the system (enforced by backend validation and DB constraint).
   - Once a questionnaire is assigned to at least one supplier, its status transitions to `ASSIGNED` and its content becomes **immutable** (cannot edit title, description, questions, options, or conditional branching).
   - Action: **Clone Questionnaire** (`POST /api/questionnaires/:id/clone`) - Clones an `ASSIGNED` questionnaire into an independent new `DRAFT` questionnaire copying all questions, options, and conditional logic. Automatically generates a unique title by appending `(1)`, `(2)`, etc.
4. **Questionnaire Builder (`/questionnaires/:id/edit` - DRAFT Only):**
   - Editable only while in `DRAFT` status.
   - Add/edit/delete questions: Types `TEXT`, `NUMBER`, `YES_NO`, `SINGLE_CHOICE`.
   - Option builder for `SINGLE_CHOICE`: Add options and configure conditional branching (`followUpQuestionId`).
5. **Assignments Management (`/assignments`):**
   - Table of all questionnaire assignments with filter by questionnaire, supplier, product, or status.
   - Modal to create assignment: Select questionnaire, select supplier, optionally select supplier's product (`POST /api/assignments`).
   - Note: Questionnaire must contain at least 1 question before it can be assigned. First assignment automatically transitions status from `DRAFT` to `ASSIGNED`.
6. **Audit Response Inspector (`/questionnaires/:id/responses` or `/assignments/:id`):**
   - Calls `GET /api/assignments/questionnaire/:id/responses`.
   - Displays submitted answers, supplier details, and product info.
   - Button to **Request AI Assessment** (`POST /api/assignments/:id/ai-assessment`):
     - Displays an indicative compliance card with score (0-100), rating label, summary, concerns, recommendations, and standard disclaimer.
   - Button to **Re-open Assignment** (`POST /api/assignments/:id/reopen`) if revision is requested.
7. **Suppliers & Products Directory (`/suppliers`, `/products`):**
   - View supplier profiles and product catalogs.

### C. Supplier Portal Views
1. **Supplier Dashboard:** Displays assigned questionnaires grouped by status (`PENDING`, `IN_PROGRESS`, `SUBMITTED`), and unread notifications count.
2. **My Products (`/supplier/products`):** CRUD interface for the supplier to manage their products (`name`, `description`, `category`).
3. **Questionnaire Form Runner (`/assignments/:id`):**
   - Interactive questionnaire answering interface.
   - Form runner logic (see Section 4).
4. **Notifications Bell/Drawer:**
   - Calls `GET /api/notifications`.
   - Mark as read (`PATCH /api/notifications/:id/read` or `PATCH /api/notifications/read-all`).

---

## 4. Critical Frontend Business Logic

### A. Conditional Question Branching
- Questions of type `SINGLE_CHOICE` have options in `options[]`.
- Each option may contain an optional `followUpQuestionId`.
- **UI Behavior:** When the user selects an option with `followUpQuestionId`:
  - Dynamically reveal the targeted follow-up question.
  - If the user changes their selection to an option without a follow-up, hide the previously revealed follow-up question (and clear its answer value).

### B. Answer Saving & Submission Lifecycle
1. **Drafting / Autosave:**
   - As the supplier answers questions (or on a "Save Draft" button), call:
     `POST /api/assignments/:id/answers` with body:
     ```json
     {
       "answers": [
         { "questionId": "...", "textValue": "..." },
         { "questionId": "...", "booleanValue": true },
         { "questionId": "...", "numberValue": 42 },
         { "questionId": "...", "selectedOptionId": "..." }
       ]
     }
     ```
   - This automatically transitions assignment status from `PENDING` to `IN_PROGRESS`.
2. **Submitting Final Audit:**
   - User clicks **"Submit Questionnaire"**:
   - Call `POST /api/assignments/:id/submit`.
   - Backend enforces that all required questions (`isRequired: true`) are answered.
   - On success: Status changes to `SUBMITTED` and backend **locks** the answers.
   - UI switches to read-only review mode with a banner: *"Submitted on [date]. Answers are locked."*
3. **Re-opened Audits:**
   - If an Admin/Supervisor re-opens the assignment (`POST /api/assignments/:id/reopen`), status reverts to `IN_PROGRESS` and the supplier can edit and resubmit answers.

### C. AI Supplier Assessment
- **Endpoint:** `POST /api/assignments/:id/ai-assessment`
- **Access:** Only `ADMIN` and `SUPERVISOR` roles.
- **Pre-requisite:** Assignment must be in `SUBMITTED` status.
- **Response Format:**
  ```json
  {
    "score": 82,
    "label": "Good",
    "summary": "The supplier demonstrates generally good compliance with documented quality procedures.",
    "concerns": [
      "Quality-control procedures are insufficiently documented."
    ],
    "recommendations": [
      "Establish and publish documented quality-control standard operating procedures."
    ],
    "disclaimer": "This is an AI-generated assessment and should not be treated as a verified compliance rating."
  }
  ```
- **Error Handling:**
  - `400 Bad Request`: If assignment is still `PENDING` or `IN_PROGRESS`.
  - `502 Bad Gateway`: If AI provider times out or returns malformed response.
  - `503 Service Unavailable`: If `AI_API_KEY` is not configured on the backend.

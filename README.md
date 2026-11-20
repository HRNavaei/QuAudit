# Supplier Monitoring and Questionnaire Management System

A production-ready NestJS and Prisma backend designed to manage suppliers, product-based questionnaire distribution, responses, and audit compliance with PostgreSQL-level integrity constraints.

## Tech Stack

- **Backend Framework:** NestJS (Express)
- **Language:** TypeScript
- **Database:** PostgreSQL 16
- **ORM:** Prisma 6.0.0
- **Containerization:** Docker & Docker Compose
- **Security:** Argon2 password hashing, JWT authentication, Passport, Helmet
- **API Documentation:** Swagger / OpenAPI 3.0 (`/api/docs`)

---

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/)
- [Node.js](https://nodejs.org/) v20+
- `npm` v10+

---

## Quick Start (with Docker Compose)

```bash
# 1. Environment configuration
cp .env.example .env

# 2. Build and start services
docker compose up -d --build
```

The stack automatically starts:
1. `quaudit-db`: Primary PostgreSQL on port `5432`
2. `quaudit-db-test`: Test PostgreSQL on port `5433`
3. `quaudit-app`: NestJS application on port `3000` (auto-deploys Prisma migrations on startup)

Interactive Swagger API documentation:
👉 **[http://localhost:3000/api/docs](http://localhost:3000/api/docs)**

---

## API Endpoints Reference

### 1. Authentication & Users (`/api/auth`, `/api/users`)
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `POST` | `/api/auth/register` | Register new user (strictly defaults to `SUPPLIER` role) | Public |
| `POST` | `/api/auth/login` | Authenticate with email & password, returns JWT | Public |
| `GET` | `/api/users/me` | Retrieve profile of authenticated user (excludes password hash) | Authenticated |

### 2. Suppliers (`/api/suppliers`)
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `POST` | `/api/suppliers` | Create supplier profile (auto-binds for `SUPPLIER`) | Authenticated |
| `GET` | `/api/suppliers` | List all suppliers | `ADMIN`, `SUPERVISOR` |
| `GET` | `/api/suppliers/me` | Get own supplier profile | `SUPPLIER` |
| `GET` | `/api/suppliers/:id` | Get supplier profile by ID | `ADMIN`, `SUPERVISOR` |
| `PATCH` | `/api/suppliers/:id` | Update supplier profile | `ADMIN`, `SUPERVISOR`, Owner `SUPPLIER` |
| `DELETE` | `/api/suppliers/:id` | Delete supplier profile | `ADMIN`, `SUPERVISOR` |

### 3. Products (`/api/products`)
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `POST` | `/api/products` | Create product (auto-binds to supplier) | Authenticated |
| `GET` | `/api/products` | List products (filterable by `supplierId`) | Authenticated |
| `GET` | `/api/products/:id` | Get product details by ID | Authenticated |
| `PATCH` | `/api/products/:id` | Update product details | `ADMIN`, `SUPERVISOR`, Owner `SUPPLIER` |
| `DELETE` | `/api/products/:id` | Delete product | `ADMIN`, `SUPERVISOR`, Owner `SUPPLIER` |

### 4. Questionnaires, Questions & Options (`/api/questionnaires`)
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `POST` | `/api/questionnaires` | Create questionnaire (`DRAFT`) | `ADMIN`, `SUPERVISOR` |
| `GET` | `/api/questionnaires` | List questionnaires (filterable by `status`) | Authenticated |
| `GET` | `/api/questionnaires/:id` | Get questionnaire with questions and options | Authenticated |
| `PATCH` | `/api/questionnaires/:id` | Update questionnaire metadata or status (`DRAFT`, `PUBLISHED`, `ARCHIVED`) | `ADMIN`, `SUPERVISOR` |
| `DELETE` | `/api/questionnaires/:id` | Delete questionnaire | `ADMIN`, `SUPERVISOR` |
| `POST` | `/api/questionnaires/:id/versions` | Clone questionnaire into new version (`parentId` set, incremented version) | `ADMIN`, `SUPERVISOR` |
| `POST` | `/api/questionnaires/:id/questions` | Add question (`TEXT`, `YES_NO`, `SINGLE_CHOICE`, `NUMBER`) | `ADMIN`, `SUPERVISOR` |
| `PATCH` | `/api/questionnaires/:id/questions/:questionId` | Update question text, type, order, or required status | `ADMIN`, `SUPERVISOR` |
| `DELETE` | `/api/questionnaires/:id/questions/:questionId` | Delete question and its options | `ADMIN`, `SUPERVISOR` |
| `POST` | `/api/questionnaires/:id/questions/:questionId/options` | Add option (with optional same-questionnaire `followUpQuestionId`) | `ADMIN`, `SUPERVISOR` |
| `PATCH` | `/api/questionnaires/:id/questions/:questionId/options/:optionId` | Update option label, value, or follow-up question | `ADMIN`, `SUPERVISOR` |
| `DELETE` | `/api/questionnaires/:id/questions/:questionId/options/:optionId` | Delete question option | `ADMIN`, `SUPERVISOR` |

### 5. Assignments & Responses (`/api/assignments`)
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `POST` | `/api/assignments` | Assign questionnaire to supplier & product (triggers notification) | `ADMIN`, `SUPERVISOR` |
| `GET` | `/api/assignments` | List assignments (Suppliers see own; Admins/Supervisors filter by supplier/product/status) | Authenticated |
| `GET` | `/api/assignments/:id` | Get assignment with full questionnaire and existing answers | Authenticated |
| `PATCH` | `/api/assignments/:id/status` | Update assignment status | `ADMIN`, `SUPERVISOR` |
| `POST` | `/api/assignments/:id/answers` | Save/update answers (sets status to `IN_PROGRESS`) | Authenticated (`SUPPLIER` owner, `ADMIN`, `SUPERVISOR`) |
| `POST` | `/api/assignments/:id/submit` | Submit response (locks answers against modification) | Authenticated |
| `POST` | `/api/assignments/:id/reopen` | Re-open submitted assignment for resubmission | `ADMIN`, `SUPERVISOR` |
| `DELETE` | `/api/assignments/:id` | Delete assignment | `ADMIN`, `SUPERVISOR` |
| `GET` | `/api/assignments/questionnaire/:questionnaireId/responses` | **Option B Essential Response Retrieval**: Inspect all submitted answers, suppliers, and product information for a questionnaire | `ADMIN`, `SUPERVISOR` |

### 6. Notifications (`/api/notifications`)
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/api/notifications` | Get in-app notifications for authenticated user (optional `unreadOnly=true`) | Authenticated |
| `PATCH` | `/api/notifications/:id/read` | Mark a notification as read | Authenticated |
| `PATCH` | `/api/notifications/read-all` | Mark all unread notifications as read | Authenticated |

---

## Database Integrity & Enforced Constraints

All four business rules are enforced directly by PostgreSQL triggers:
1. **Assignment–Product–Supplier consistency (`trg_check_assignment_product_supplier`)**: Product assigned must belong to the assigned supplier.
2. **Conditional question consistency (`trg_check_option_followup_questionnaire`)**: Option follow-up question must belong to the same questionnaire.
3. **Answer–Questionnaire consistency (`trg_check_answer_questionnaire`)**: Answers must reference questions from the assigned questionnaire.
4. **Answer–QuestionOption consistency (`trg_check_answer_option_question`)**: Selected option must belong to the question being answered.

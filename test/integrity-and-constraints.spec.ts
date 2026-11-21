import { PrismaClient, Role, QuestionnaireStatus, QuestionType, AssignmentStatus } from "@prisma/client";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  "postgresql://quaudit:quaudit_secret@localhost:5432/quaudit_test?schema=public";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: TEST_DATABASE_URL,
    },
  },
});

describe("Integrity Enhancements and Business Constraints Verification", () => {
  let adminUser: any;
  let supplierUser1: any;
  let supplierUser2: any;
  let supplier1: any;
  let supplier2: any;
  let product1: any;
  let product2: any;
  let questionnaire1: any;
  let questionnaire2: any;
  let question1: any;
  let question2: any;
  let questionQ2: any;
  let option1A: any;
  let option1B: any;

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean database in reverse dependency order
    await prisma.answer.deleteMany();
    await prisma.questionOption.deleteMany();
    await prisma.question.deleteMany();
    await prisma.questionnaireAssignment.deleteMany();
    await prisma.questionnaire.deleteMany();
    await prisma.product.deleteMany();
    await prisma.supplier.deleteMany();
    await prisma.notification.deleteMany();
    await prisma.user.deleteMany();

    // Setup base fixtures
    adminUser = await prisma.user.create({
      data: {
        email: "admin-test@example.com",
        password: "hashedpassword",
        firstName: "Admin",
        lastName: "User",
        role: Role.ADMIN,
      },
    });

    supplierUser1 = await prisma.user.create({
      data: {
        email: "supplier1-test@example.com",
        password: "hashedpassword",
        firstName: "Supplier",
        lastName: "One",
        role: Role.SUPPLIER,
      },
    });

    supplierUser2 = await prisma.user.create({
      data: {
        email: "supplier2-test@example.com",
        password: "hashedpassword",
        firstName: "Supplier",
        lastName: "Two",
        role: Role.SUPPLIER,
      },
    });

    supplier1 = await prisma.supplier.create({
      data: {
        userId: supplierUser1.id,
        companyName: "Acme Corp",
      },
    });

    supplier2 = await prisma.supplier.create({
      data: {
        userId: supplierUser2.id,
        companyName: "Beta Logistics",
      },
    });

    product1 = await prisma.product.create({
      data: {
        name: "Acme Widget A",
        supplierId: supplier1.id,
      },
    });

    product2 = await prisma.product.create({
      data: {
        name: "Beta Gadget B",
        supplierId: supplier2.id,
      },
    });

    questionnaire1 = await prisma.questionnaire.create({
      data: {
        title: "Quality Audit Q1",
        status: QuestionnaireStatus.PUBLISHED,
        createdById: adminUser.id,
      },
    });

    questionnaire2 = await prisma.questionnaire.create({
      data: {
        title: "Security Audit Q2",
        status: QuestionnaireStatus.PUBLISHED,
        createdById: adminUser.id,
      },
    });

    question1 = await prisma.question.create({
      data: {
        questionnaireId: questionnaire1.id,
        text: "Do you comply with ISO 9001?",
        type: QuestionType.YES_NO,
        order: 1,
      },
    });

    question2 = await prisma.question.create({
      data: {
        questionnaireId: questionnaire1.id,
        text: "Please provide certificate number:",
        type: QuestionType.TEXT,
        order: 2,
      },
    });

    questionQ2 = await prisma.question.create({
      data: {
        questionnaireId: questionnaire2.id,
        text: "Do you have SOC2 compliance?",
        type: QuestionType.YES_NO,
        order: 1,
      },
    });

    option1A = await prisma.questionOption.create({
      data: {
        questionId: question1.id,
        label: "Yes",
        value: "yes",
        order: 1,
      },
    });

    option1B = await prisma.questionOption.create({
      data: {
        questionId: question1.id,
        label: "No",
        value: "no",
        order: 2,
      },
    });
  });

  // =========================================================================
  // ENHANCEMENT 1: Questionnaire.createdBy foreign key relationship to User
  // =========================================================================
  describe("Enhancement 1: Questionnaire.createdBy relation to User", () => {
    it("should allow creating a questionnaire with a valid existing user", async () => {
      const q = await prisma.questionnaire.create({
        data: {
          title: "Test Questionnaire",
          createdById: adminUser.id,
        },
        include: { createdBy: true },
      });

      expect(q).toBeDefined();
      expect(q.createdBy.id).toBe(adminUser.id);
      expect(q.createdBy.email).toBe(adminUser.email);
    });

    it("should reject creating a questionnaire with a non-existent createdById (foreign key constraint)", async () => {
      const fakeUserId = "00000000-0000-0000-0000-000000000099";

      await expect(
        prisma.questionnaire.create({
          data: {
            title: "Invalid Creator Questionnaire",
            createdById: fakeUserId,
          },
        }),
      ).rejects.toThrow();
    });

    it("should fetch created questionnaires through the reverse relation User.createdQuestionnaires", async () => {
      const userWithQ = await prisma.user.findUnique({
        where: { id: adminUser.id },
        include: { createdQuestionnaires: true },
      });

      expect(userWithQ?.createdQuestionnaires.length).toBeGreaterThanOrEqual(2);
    });
  });

  // =========================================================================
  // ENHANCEMENT 2: Unique constraint on Answer (assignmentId, questionId)
  // =========================================================================
  describe("Enhancement 2: Answer duplicate prevention @@unique([assignmentId, questionId])", () => {
    it("should allow a single answer for a question within an assignment", async () => {
      const assignment = await prisma.questionnaireAssignment.create({
        data: {
          questionnaireId: questionnaire1.id,
          supplierId: supplier1.id,
        },
      });

      const answer = await prisma.answer.create({
        data: {
          assignmentId: assignment.id,
          questionId: question1.id,
          booleanValue: true,
        },
      });

      expect(answer.id).toBeDefined();
    });

    it("should reject duplicate answers for the same question within the same assignment", async () => {
      const assignment = await prisma.questionnaireAssignment.create({
        data: {
          questionnaireId: questionnaire1.id,
          supplierId: supplier1.id,
        },
      });

      await prisma.answer.create({
        data: {
          assignmentId: assignment.id,
          questionId: question1.id,
          booleanValue: true,
        },
      });

      // Attempt second answer for same assignment and same question
      await expect(
        prisma.answer.create({
          data: {
            assignmentId: assignment.id,
            questionId: question1.id,
            booleanValue: false,
          },
        }),
      ).rejects.toThrow();
    });
  });

  // =========================================================================
  // ENHANCEMENT 3: Partial unique indexes on QuestionnaireAssignment
  // =========================================================================
  describe("Enhancement 3: Assignment uniqueness partial indexes", () => {
    it("should prevent duplicate product-specific assignments (questionnaire, supplier, product)", async () => {
      // First assignment succeeds
      await prisma.questionnaireAssignment.create({
        data: {
          questionnaireId: questionnaire1.id,
          supplierId: supplier1.id,
          productId: product1.id,
        },
      });

      // Duplicate product-specific assignment must fail
      await expect(
        prisma.questionnaireAssignment.create({
          data: {
            questionnaireId: questionnaire1.id,
            supplierId: supplier1.id,
            productId: product1.id,
          },
        }),
      ).rejects.toThrow();
    });

    it("should prevent duplicate supplier-level assignments (questionnaire, supplier, product IS NULL)", async () => {
      // First supplier-level assignment succeeds
      await prisma.questionnaireAssignment.create({
        data: {
          questionnaireId: questionnaire1.id,
          supplierId: supplier1.id,
          productId: null,
        },
      });

      // Duplicate supplier-level assignment must fail
      await expect(
        prisma.questionnaireAssignment.create({
          data: {
            questionnaireId: questionnaire1.id,
            supplierId: supplier1.id,
            productId: null,
          },
        }),
      ).rejects.toThrow();
    });

    it("should allow co-existence of product-specific and supplier-level assignments for same supplier/questionnaire", async () => {
      const supplierLevel = await prisma.questionnaireAssignment.create({
        data: {
          questionnaireId: questionnaire1.id,
          supplierId: supplier1.id,
          productId: null,
        },
      });

      const productSpecific = await prisma.questionnaireAssignment.create({
        data: {
          questionnaireId: questionnaire1.id,
          supplierId: supplier1.id,
          productId: product1.id,
        },
      });

      expect(supplierLevel.id).toBeDefined();
      expect(productSpecific.id).toBeDefined();
    });

    it("should enforce uniqueness safely under concurrent insertion requests", async () => {
      // Create a new product for concurrency test
      const productConcurrent = await prisma.product.create({
        data: {
          name: "Concurrent Test Product",
          supplierId: supplier1.id,
        },
      });

      // Execute 5 concurrent insert attempts with identical (questionnaire, supplier, product)
      const attempts = Array.from({ length: 5 }).map(() =>
        prisma.questionnaireAssignment
          .create({
            data: {
              questionnaireId: questionnaire1.id,
              supplierId: supplier1.id,
              productId: productConcurrent.id,
            },
          })
          .then(() => "SUCCESS")
          .catch(() => "REJECTED"),
      );

      const results = await Promise.all(attempts);
      const successes = results.filter((r) => r === "SUCCESS").length;
      const rejections = results.filter((r) => r === "REJECTED").length;

      // Exactly 1 must succeed, exactly 4 must be rejected by PostgreSQL unique index
      expect(successes).toBe(1);
      expect(rejections).toBe(4);
    });
  });

  // =========================================================================
  // ENHANCEMENT 4: Product deletion behavior RESTRICT
  // =========================================================================
  describe("Enhancement 4: QuestionnaireAssignment.product onDelete: Restrict", () => {
    it("should allow deleting a product with no assignments", async () => {
      const isolatedProduct = await prisma.product.create({
        data: {
          name: "Disposable Product",
          supplierId: supplier1.id,
        },
      });

      await expect(
        prisma.product.delete({ where: { id: isolatedProduct.id } }),
      ).resolves.toBeDefined();
    });

    it("should reject deleting a product that has an active questionnaire assignment (Restrict)", async () => {
      await prisma.questionnaireAssignment.create({
        data: {
          questionnaireId: questionnaire1.id,
          supplierId: supplier1.id,
          productId: product1.id,
        },
      });

      // Product deletion must be rejected by foreign key RESTRICT constraint
      await expect(
        prisma.product.delete({ where: { id: product1.id } }),
      ).rejects.toThrow();
    });
  });

  // =========================================================================
  // CONSTRAINT 1: Assignment–Product–Supplier consistency
  // =========================================================================
  describe("Constraint 1: Assignment–Product–Supplier consistency", () => {
    it("should accept an assignment when product belongs to the assigned supplier", async () => {
      const assignment = await prisma.questionnaireAssignment.create({
        data: {
          questionnaireId: questionnaire1.id,
          supplierId: supplier1.id,
          productId: product1.id,
        },
      });

      expect(assignment.id).toBeDefined();
    });

    it("should reject an assignment when product belongs to a different supplier", async () => {
      // product2 belongs to supplier2, but assignment references supplier1
      await expect(
        prisma.questionnaireAssignment.create({
          data: {
            questionnaireId: questionnaire1.id,
            supplierId: supplier1.id,
            productId: product2.id,
          },
        }),
      ).rejects.toThrow(/Product does not belong to the assigned supplier/);
    });

    it("should reject updating a product's supplier when active assignments exist for previous supplier", async () => {
      await prisma.questionnaireAssignment.create({
        data: {
          questionnaireId: questionnaire1.id,
          supplierId: supplier1.id,
          productId: product1.id,
        },
      });

      // Attempt to reassign product1 to supplier2 while an assignment exists for supplier1
      await expect(
        prisma.product.update({
          where: { id: product1.id },
          data: { supplierId: supplier2.id },
        }),
      ).rejects.toThrow(/Cannot transfer product to another supplier while assignments exist/);
    });
  });

  // =========================================================================
  // CONSTRAINT 2: QuestionOption–Follow-up Question consistency
  // =========================================================================
  describe("Constraint 2: QuestionOption–Follow-up Question consistency", () => {
    it("should accept a follow-up question belonging to the same questionnaire", async () => {
      const updatedOption = await prisma.questionOption.update({
        where: { id: option1A.id },
        data: { followUpQuestionId: question2.id },
      });

      expect(updatedOption.followUpQuestionId).toBe(question2.id);
    });

    it("should reject a follow-up question belonging to a different questionnaire", async () => {
      // questionQ2 belongs to questionnaire2, option1A belongs to question1 in questionnaire1
      await expect(
        prisma.questionOption.update({
          where: { id: option1A.id },
          data: { followUpQuestionId: questionQ2.id },
        }),
      ).rejects.toThrow(/Follow‑up question must belong to the same questionnaire/);
    });

    it("should reject moving a question to another questionnaire if referenced by a follow-up option", async () => {
      await prisma.questionOption.update({
        where: { id: option1A.id },
        data: { followUpQuestionId: question2.id },
      });

      // Attempt to move question2 to questionnaire2
      await expect(
        prisma.question.update({
          where: { id: question2.id },
          data: { questionnaireId: questionnaire2.id },
        }),
      ).rejects.toThrow(/Cannot move question: it is a follow-up question for options in the original questionnaire/);
    });
  });

  // =========================================================================
  // CONSTRAINT 3: Answer–Questionnaire consistency
  // =========================================================================
  describe("Constraint 3: Answer–Questionnaire consistency", () => {
    it("should accept an answer referencing a question from the assigned questionnaire", async () => {
      const assignment = await prisma.questionnaireAssignment.create({
        data: {
          questionnaireId: questionnaire1.id,
          supplierId: supplier1.id,
        },
      });

      const answer = await prisma.answer.create({
        data: {
          assignmentId: assignment.id,
          questionId: question1.id,
          booleanValue: true,
        },
      });

      expect(answer.id).toBeDefined();
    });

    it("should reject an answer referencing a question from a different questionnaire", async () => {
      const assignment = await prisma.questionnaireAssignment.create({
        data: {
          questionnaireId: questionnaire1.id,
          supplierId: supplier1.id,
        },
      });

      // questionQ2 belongs to questionnaire2, but assignment is for questionnaire1
      await expect(
        prisma.answer.create({
          data: {
            assignmentId: assignment.id,
            questionId: questionQ2.id,
            booleanValue: true,
          },
        }),
      ).rejects.toThrow(/Answer question does not belong to the assignment questionnaire/);
    });

    it("should reject changing an assignment's questionnaire if answers already exist", async () => {
      const assignment = await prisma.questionnaireAssignment.create({
        data: {
          questionnaireId: questionnaire1.id,
          supplierId: supplier1.id,
        },
      });

      await prisma.answer.create({
        data: {
          assignmentId: assignment.id,
          questionId: question1.id,
          booleanValue: true,
        },
      });

      // Attempt to switch assignment to questionnaire2 while answer references question1 (questionnaire1)
      await expect(
        prisma.questionnaireAssignment.update({
          where: { id: assignment.id },
          data: { questionnaireId: questionnaire2.id },
        }),
      ).rejects.toThrow(/Cannot change assignment questionnaire: answers already exist/);
    });
  });

  // =========================================================================
  // CONSTRAINT 4: Answer–QuestionOption consistency
  // =========================================================================
  describe("Constraint 4: Answer–QuestionOption consistency", () => {
    it("should accept an answer selecting an option belonging to that question", async () => {
      const assignment = await prisma.questionnaireAssignment.create({
        data: {
          questionnaireId: questionnaire1.id,
          supplierId: supplier1.id,
        },
      });

      const answer = await prisma.answer.create({
        data: {
          assignmentId: assignment.id,
          questionId: question1.id,
          selectedOptionId: option1A.id,
        },
      });

      expect(answer.id).toBeDefined();
      expect(answer.selectedOptionId).toBe(option1A.id);
    });

    it("should reject an answer selecting an option belonging to a different question", async () => {
      // Create option for question2
      const option2A = await prisma.questionOption.create({
        data: {
          questionId: question2.id,
          label: "Cert A",
          value: "cert_a",
          order: 1,
        },
      });

      const assignment = await prisma.questionnaireAssignment.create({
        data: {
          questionnaireId: questionnaire1.id,
          supplierId: supplier1.id,
        },
      });

      // Attempting to answer question1 while selecting option2A (which belongs to question2)
      await expect(
        prisma.answer.create({
          data: {
            assignmentId: assignment.id,
            questionId: question1.id,
            selectedOptionId: option2A.id,
          },
        }),
      ).rejects.toThrow(/Selected option does not belong to the answer question/);
    });

    it("should reject reassigning an option to another question if answers currently select it", async () => {
      const assignment = await prisma.questionnaireAssignment.create({
        data: {
          questionnaireId: questionnaire1.id,
          supplierId: supplier1.id,
        },
      });

      await prisma.answer.create({
        data: {
          assignmentId: assignment.id,
          questionId: question1.id,
          selectedOptionId: option1A.id,
        },
      });

      // Attempt to move option1A to question2 while answer selects option1A for question1
      await expect(
        prisma.questionOption.update({
          where: { id: option1A.id },
          data: { questionId: question2.id },
        }),
      ).rejects.toThrow(/Cannot reassign option to another question: existing answers select this option/);
    });
  });
});

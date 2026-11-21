import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import {
  PrismaClient,
  Role,
  QuestionnaireStatus,
  QuestionType,
  AssignmentStatus,
} from "@prisma/client";
import { AuthService } from "../src/auth/auth.service";
import { SuppliersService } from "../src/suppliers/suppliers.service";
import { QuestionnairesService } from "../src/questionnaires/questionnaires.service";
import { AssignmentsService } from "../src/assignments/assignments.service";
import { RolesGuard } from "../src/auth/roles.guard";
import { ROLES_KEY } from "../src/auth/roles.decorator";

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

describe("Supplier Self-Registration and Questionnaire Workflow Tests", () => {
  let authService: AuthService;
  let suppliersService: SuppliersService;
  let questionnairesService: QuestionnairesService;
  let assignmentsService: AssignmentsService;
  let rolesGuard: RolesGuard;
  let mockReflector: any;
  let mockNotificationsService: any;
  let mockJwtService: any;

  let supervisorUser: any;
  let adminUser: any;

  beforeAll(async () => {
    await prisma.$connect();

    mockJwtService = {
      sign: jest.fn(() => "mock-jwt-token"),
    };

    mockNotificationsService = {
      createNotification: jest.fn().mockResolvedValue({}),
    };

    mockReflector = {
      getAllAndOverride: jest.fn(),
    };

    authService = new AuthService(prisma as any, mockJwtService);
    suppliersService = new SuppliersService(prisma as any);
    questionnairesService = new QuestionnairesService(prisma as any);
    assignmentsService = new AssignmentsService(
      prisma as any,
      mockNotificationsService,
      {} as any,
    );
    rolesGuard = new RolesGuard(mockReflector);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean test database in reverse dependency order
    await prisma.answer.deleteMany();
    await prisma.questionOption.deleteMany();
    await prisma.question.deleteMany();
    await prisma.questionnaireAssignment.deleteMany();
    await prisma.questionnaire.deleteMany();
    await prisma.product.deleteMany();
    await prisma.supplier.deleteMany();
    await prisma.notification.deleteMany();
    await prisma.user.deleteMany();

    supervisorUser = await prisma.user.create({
      data: {
        email: "supervisor@example.com",
        password: "hashedpassword",
        firstName: "Sarah",
        lastName: "Supervisor",
        role: Role.SUPERVISOR,
      },
    });

    adminUser = await prisma.user.create({
      data: {
        email: "admin@example.com",
        password: "hashedpassword",
        firstName: "Adam",
        lastName: "Admin",
        role: Role.ADMIN,
      },
    });
  });

  describe("1. Supplier Self-Registration and Supervisor Approval Flow", () => {
    it("should allow a supplier to self-register and automatically create User and Supplier with pending approval", async () => {
      const regData = {
        email: "supplier.new@example.com",
        password: "StrongPassword123!",
        firstName: "Alice",
        lastName: "Supplier",
        companyName: "Alice Supplies Ltd",
        description: "Precision manufacturing components",
        phone: "+1-555-0101",
        address: "100 Manufacturing Ave, Detroit, MI",
      };

      const result = await authService.register(regData);

      expect(result).toBeDefined();
      expect(result.access_token).toBe("mock-jwt-token");
      expect(result.user).toBeDefined();
      expect(result.user.email).toBe("supplier.new@example.com");
      expect(result.user.role).toBe(Role.SUPPLIER);
      expect(result.supplier).toBeDefined();
      expect(result.supplier.companyName).toBe("Alice Supplies Ltd");
      expect(result.supplier.isApproved).toBe(false);

      // Verify in database
      const dbUser = await prisma.user.findUnique({
        where: { email: "supplier.new@example.com" },
        include: { supplier: true },
      });
      expect(dbUser).not.toBeNull();
      expect(dbUser!.role).toBe(Role.SUPPLIER);
      expect(dbUser!.supplier).not.toBeNull();
      expect(dbUser!.supplier!.companyName).toBe("Alice Supplies Ltd");
      expect(dbUser!.supplier!.isApproved).toBe(false);
      expect(dbUser!.supplier!.userId).toBe(dbUser!.id);
    });

    it("should reject registration with duplicate email", async () => {
      const regData = {
        email: "duplicate@example.com",
        password: "StrongPassword123!",
        firstName: "First",
        lastName: "User",
        companyName: "First Supplies",
      };

      await authService.register(regData);

      await expect(authService.register(regData)).rejects.toThrow(
        ConflictException,
      );
    });

    it("should reject access to protected supplier functionality for pending unapproved suppliers", () => {
      mockReflector.getAllAndOverride.mockReturnValue([
        Role.ADMIN,
        Role.SUPERVISOR,
        Role.SUPPLIER,
      ]);

      const mockExecutionContextPending: any = {
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
          getRequest: () => ({
            user: {
              userId: "uuid-1",
              email: "pending@example.com",
              role: Role.SUPPLIER,
              isApproved: false,
            },
          }),
        }),
      };

      expect(() =>
        rolesGuard.canActivate(mockExecutionContextPending),
      ).toThrow(ForbiddenException);

      try {
        rolesGuard.canActivate(mockExecutionContextPending);
      } catch (err: any) {
        expect(err.message).toContain(
          "Supplier account is pending supervisor approval",
        );
      }
    });

    it("should permit access to protected supplier functionality once approved", () => {
      mockReflector.getAllAndOverride.mockReturnValue([
        Role.ADMIN,
        Role.SUPERVISOR,
        Role.SUPPLIER,
      ]);

      const mockExecutionContextApproved: any = {
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
          getRequest: () => ({
            user: {
              userId: "uuid-2",
              email: "approved@example.com",
              role: Role.SUPPLIER,
              isApproved: true,
            },
          }),
        }),
      };

      const result = rolesGuard.canActivate(mockExecutionContextApproved);
      expect(result).toBe(true);
    });

    it("should allow supervisor to list pending supplier registrations and approve them", async () => {
      // Register two suppliers
      const reg1 = await authService.register({
        email: "supplier1@example.com",
        password: "Password1!",
        firstName: "Bob",
        lastName: "One",
        companyName: "Supplier One",
      });

      const reg2 = await authService.register({
        email: "supplier2@example.com",
        password: "Password2!",
        firstName: "Charlie",
        lastName: "Two",
        companyName: "Supplier Two",
      });

      // Retrieve pending suppliers
      const pendingList = await suppliersService.getPendingSuppliers();
      expect(pendingList.length).toBe(2);
      expect(
        pendingList.some((s) => s.id === reg1.supplier.id && !s.isApproved),
      ).toBe(true);
      expect(
        pendingList.some((s) => s.id === reg2.supplier.id && !s.isApproved),
      ).toBe(true);

      // Approve first supplier
      const approved1 = await suppliersService.approveSupplier(
        reg1.supplier.id,
      );
      expect(approved1.isApproved).toBe(true);

      // Verify pending list now only has one supplier
      const remainingPending = await suppliersService.getPendingSuppliers();
      expect(remainingPending.length).toBe(1);
      expect(remainingPending[0].id).toBe(reg2.supplier.id);

      // Verify in DB
      const dbSupplier1 = await prisma.supplier.findUnique({
        where: { id: reg1.supplier.id },
      });
      expect(dbSupplier1!.isApproved).toBe(true);
    });

    it("should reject attempts to approve an already approved supplier account", async () => {
      const reg = await authService.register({
        email: "supplier.approved@example.com",
        password: "Password1!",
        firstName: "Dave",
        lastName: "Supplier",
        companyName: "Approved Co",
      });

      await suppliersService.approveSupplier(reg.supplier.id);

      // Re-approving must throw BadRequestException
      await expect(
        suppliersService.approveSupplier(reg.supplier.id),
      ).rejects.toThrow(BadRequestException);
    });

    it("should disable manual supplier creation via SuppliersService.create", async () => {
      await expect(
        suppliersService.create(
          { companyName: "Manual Co" } as any,
          {
            userId: adminUser.id,
            email: adminUser.email,
            role: Role.ADMIN,
          },
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe("2. Questionnaire Statuses, Immutability and Assignment Workflow", () => {
    it("should create questionnaires in DRAFT status without version attribute", async () => {
      const q = await questionnairesService.createQuestionnaire(
        {
          title: "Initial Audit",
          description: "Draft audit questionnaire",
        },
        supervisorUser.id,
      );

      expect(q).toBeDefined();
      expect(q.title).toBe("Initial Audit");
      expect(q.status).toBe(QuestionnaireStatus.DRAFT);
      expect((q as any).version).toBeUndefined();
    });

    it("should allow editing a DRAFT questionnaire directly without version creation", async () => {
      const q = await questionnairesService.createQuestionnaire(
        {
          title: "Draft Audit To Edit",
          description: "Original description",
        },
        supervisorUser.id,
      );

      const updated = await questionnairesService.updateQuestionnaire(q.id, {
        description: "Updated description in place",
      });

      expect(updated.id).toBe(q.id);
      expect(updated.description).toBe("Updated description in place");
      expect(updated.status).toBe(QuestionnaireStatus.DRAFT);
    });

    it("should reject assigning a questionnaire that has no questions", async () => {
      const reg = await authService.register({
        email: "assignee@example.com",
        password: "Password1!",
        firstName: "Assignee",
        lastName: "Supplier",
        companyName: "Assignee Corp",
      });
      await suppliersService.approveSupplier(reg.supplier.id);

      const emptyQ = await questionnairesService.createQuestionnaire(
        { title: "Empty Questionnaire" },
        supervisorUser.id,
      );

      await expect(
        assignmentsService.createAssignment(
          {
            questionnaireId: emptyQ.id,
            supplierId: reg.supplier.id,
          },
          supervisorUser.id,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        assignmentsService.createAssignment(
          {
            questionnaireId: emptyQ.id,
            supplierId: reg.supplier.id,
          },
          supervisorUser.id,
        ),
      ).rejects.toThrow(/at least one question/i);
    });

    it("should transition questionnaire from DRAFT to ASSIGNED upon first assignment", async () => {
      const reg = await authService.register({
        email: "assignee2@example.com",
        password: "Password1!",
        firstName: "Assignee",
        lastName: "Supplier",
        companyName: "Assignee 2 Corp",
      });
      await suppliersService.approveSupplier(reg.supplier.id);

      const q = await questionnairesService.createQuestionnaire(
        { title: "Questionnaire With Questions" },
        supervisorUser.id,
      );

      // Add a question
      await questionnairesService.addQuestion(q.id, {
        text: "Do you have ISO 14001 certification?",
        type: QuestionType.YES_NO,
      });

      expect(q.status).toBe(QuestionnaireStatus.DRAFT);

      // First assignment
      const assignment = await assignmentsService.createAssignment(
        {
          questionnaireId: q.id,
          supplierId: reg.supplier.id,
        },
        supervisorUser.id,
      );

      expect(assignment).toBeDefined();
      expect(assignment.status).toBe(AssignmentStatus.PENDING);

      // Check questionnaire status transitioned to ASSIGNED
      const updatedQ = await prisma.questionnaire.findUnique({
        where: { id: q.id },
      });
      expect(updatedQ!.status).toBe(QuestionnaireStatus.ASSIGNED);
    });

    it("should allow an ASSIGNED questionnaire to receive additional assignments", async () => {
      const reg1 = await authService.register({
        email: "multi1@example.com",
        password: "Password1!",
        firstName: "Multi",
        lastName: "One",
        companyName: "Multi One",
      });
      await suppliersService.approveSupplier(reg1.supplier.id);

      const reg2 = await authService.register({
        email: "multi2@example.com",
        password: "Password1!",
        firstName: "Multi",
        lastName: "Two",
        companyName: "Multi Two",
      });
      await suppliersService.approveSupplier(reg2.supplier.id);

      const q = await questionnairesService.createQuestionnaire(
        { title: "Multi-Assignment Questionnaire" },
        supervisorUser.id,
      );

      await questionnairesService.addQuestion(q.id, {
        text: "Compliance status?",
        type: QuestionType.TEXT,
      });

      // Assignment 1 transitions to ASSIGNED
      await assignmentsService.createAssignment(
        { questionnaireId: q.id, supplierId: reg1.supplier.id },
        supervisorUser.id,
      );

      // Assignment 2 on already ASSIGNED questionnaire succeeds
      const assignment2 = await assignmentsService.createAssignment(
        { questionnaireId: q.id, supplierId: reg2.supplier.id },
        supervisorUser.id,
      );

      expect(assignment2).toBeDefined();
      expect(assignment2.supplierId).toBe(reg2.supplier.id);
    });

    it("should strictly enforce immutability on ASSIGNED questionnaires (updates, questions, options, deletion)", async () => {
      const reg = await authService.register({
        email: "immutable.test@example.com",
        password: "Password1!",
        firstName: "Imm",
        lastName: "Test",
        companyName: "Imm Corp",
      });
      await suppliersService.approveSupplier(reg.supplier.id);

      const q = await questionnairesService.createQuestionnaire(
        { title: "Immutable Master Audit" },
        supervisorUser.id,
      );

      const q1 = await questionnairesService.addQuestion(q.id, {
        text: "Are policies documented?",
        type: QuestionType.YES_NO,
      });

      const opt1 = await questionnairesService.addOption(q.id, q1.id, {
        label: "Yes",
        value: "YES",
      });

      // Transition to ASSIGNED
      await assignmentsService.createAssignment(
        { questionnaireId: q.id, supplierId: reg.supplier.id },
        supervisorUser.id,
      );

      // 1. Attempt updating questionnaire title/description
      await expect(
        questionnairesService.updateQuestionnaire(q.id, {
          title: "New Title Attempt",
        }),
      ).rejects.toThrow(BadRequestException);

      // 2. Attempt deleting questionnaire
      await expect(
        questionnairesService.deleteQuestionnaire(q.id),
      ).rejects.toThrow(BadRequestException);

      // 3. Attempt adding a question
      await expect(
        questionnairesService.addQuestion(q.id, {
          text: "New question attempt",
          type: QuestionType.TEXT,
        }),
      ).rejects.toThrow(BadRequestException);

      // 4. Attempt updating question
      await expect(
        questionnairesService.updateQuestion(q.id, q1.id, {
          text: "Updated text attempt",
        }),
      ).rejects.toThrow(BadRequestException);

      // 5. Attempt deleting question
      await expect(
        questionnairesService.deleteQuestion(q.id, q1.id),
      ).rejects.toThrow(BadRequestException);

      // 6. Attempt adding option
      await expect(
        questionnairesService.addOption(q.id, q1.id, {
          label: "No",
          value: "NO",
        }),
      ).rejects.toThrow(BadRequestException);

      // 7. Attempt updating option
      await expect(
        questionnairesService.updateOption(q.id, q1.id, opt1.id, {
          label: "Definitely Yes",
        }),
      ).rejects.toThrow(BadRequestException);

      // 8. Attempt deleting option
      await expect(
        questionnairesService.deleteOption(q.id, q1.id, opt1.id),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("3. Unique Questionnaire Titles & Supervisor Cloning", () => {
    it("should reject creating or updating a questionnaire with a duplicate title", async () => {
      await questionnairesService.createQuestionnaire(
        { title: "Unique Safety Audit" },
        supervisorUser.id,
      );

      // Attempt duplicate title creation
      await expect(
        questionnairesService.createQuestionnaire(
          { title: "Unique Safety Audit" },
          supervisorUser.id,
        ),
      ).rejects.toThrow(ConflictException);

      // Attempt duplicate title via update
      const q2 = await questionnairesService.createQuestionnaire(
        { title: "Different Audit" },
        supervisorUser.id,
      );

      await expect(
        questionnairesService.updateQuestionnaire(q2.id, {
          title: "Unique Safety Audit",
        }),
      ).rejects.toThrow(ConflictException);
    });

    it("should reject cloning a DRAFT questionnaire", async () => {
      const draftQ = await questionnairesService.createQuestionnaire(
        { title: "Draft Questionnaire To Clone" },
        supervisorUser.id,
      );

      await expect(
        questionnairesService.cloneQuestionnaire(
          draftQ.id,
          supervisorUser.id,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        questionnairesService.cloneQuestionnaire(
          draftQ.id,
          supervisorUser.id,
        ),
      ).rejects.toThrow(/Only assigned questionnaires can be cloned/i);
    });

    it("should clone an ASSIGNED questionnaire into DRAFT with unique name '(1)' and intact conditional logic", async () => {
      const reg = await authService.register({
        email: "clone.tester@example.com",
        password: "Password1!",
        firstName: "Clone",
        lastName: "Tester",
        companyName: "Clone Supplier",
      });
      await suppliersService.approveSupplier(reg.supplier.id);

      // Create master questionnaire with questions and conditional logic
      const masterQ = await questionnairesService.createQuestionnaire(
        {
          title: "Cybersecurity Standard 2026",
          description: "Original cyber audit",
        },
        supervisorUser.id,
      );

      const q1 = await questionnairesService.addQuestion(masterQ.id, {
        text: "Do you have an incident response plan?",
        type: QuestionType.YES_NO,
        order: 1,
      });

      const q2 = await questionnairesService.addQuestion(masterQ.id, {
        text: "When was the last tabletop exercise conducted?",
        type: QuestionType.TEXT,
        order: 2,
      });

      // Conditional branching: Option YES on q1 leads to follow-up q2
      await questionnairesService.addOption(masterQ.id, q1.id, {
        label: "Yes",
        value: "YES",
        order: 1,
        followUpQuestionId: q2.id,
      });

      await questionnairesService.addOption(masterQ.id, q1.id, {
        label: "No",
        value: "NO",
        order: 2,
      });

      // Assign to transition master to ASSIGNED
      await assignmentsService.createAssignment(
        { questionnaireId: masterQ.id, supplierId: reg.supplier.id },
        supervisorUser.id,
      );

      // 1. First clone
      const clone1 = await questionnairesService.cloneQuestionnaire(
        masterQ.id,
        supervisorUser.id,
      );

      expect(clone1).toBeDefined();
      expect(clone1!.id).not.toBe(masterQ.id);
      expect(clone1!.title).toBe("Cybersecurity Standard 2026 (1)");
      expect(clone1!.status).toBe(QuestionnaireStatus.DRAFT);
      expect(clone1!.questions.length).toBe(2);

      // Verify conditional branching in clone
      const clonedQ1 = clone1!.questions.find((q) => q.order === 1);
      const clonedQ2 = clone1!.questions.find((q) => q.order === 2);
      expect(clonedQ1).toBeDefined();
      expect(clonedQ2).toBeDefined();
      expect(clonedQ1!.id).not.toBe(q1.id);
      expect(clonedQ2!.id).not.toBe(q2.id);

      const yesOpt = clonedQ1!.options.find((o) => o.value === "YES");
      expect(yesOpt).toBeDefined();
      expect(yesOpt!.followUpQuestionId).toBe(clonedQ2!.id);

      // 2. Second clone from master should increment suffix to (2)
      const clone2 = await questionnairesService.cloneQuestionnaire(
        masterQ.id,
        supervisorUser.id,
      );

      expect(clone2!.title).toBe("Cybersecurity Standard 2026 (2)");
      expect(clone2!.status).toBe(QuestionnaireStatus.DRAFT);
      expect(clone2!.id).not.toBe(clone1!.id);

      // 3. Cloned questionnaires are editable (since they are in DRAFT status)
      const editedClone = await questionnairesService.updateQuestionnaire(
        clone1!.id,
        {
          description: "Updated description in cloned draft",
        },
      );
      expect(editedClone.description).toBe(
        "Updated description in cloned draft",
      );
    });
  });
});

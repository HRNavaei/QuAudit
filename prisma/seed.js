"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const argon2 = __importStar(require("argon2"));
const prisma = new client_1.PrismaClient();
async function main() {
    // 1. Seed Supervisor User
    const supervisorEmail = process.env.SEED_SUPERVISOR_EMAIL || 'supervisor@quaudit.com';
    const supervisorPassword = process.env.SEED_SUPERVISOR_PASSWORD || 'Supervisor@123456';
    const supervisorFirstName = process.env.SEED_SUPERVISOR_FIRST_NAME || 'Audit';
    const supervisorLastName = process.env.SEED_SUPERVISOR_LAST_NAME || 'Supervisor';
    const existingSupervisor = await prisma.user.findUnique({
        where: { email: supervisorEmail },
    });
    if (!existingSupervisor) {
        const hashedPassword = await argon2.hash(supervisorPassword);
        await prisma.user.create({
            data: {
                email: supervisorEmail,
                password: hashedPassword,
                firstName: supervisorFirstName,
                lastName: supervisorLastName,
                role: client_1.Role.SUPERVISOR,
                isActive: true,
            },
        });
        console.log(`Seeded supervisor user: ${supervisorEmail}`);
    }
    else {
        console.log(`Supervisor user already exists: ${supervisorEmail}`);
    }
    // 2. Seed Supplier User and Supplier Record
    const supplierEmail = process.env.SEED_SUPPLIER_EMAIL || 'supplier@quaudit.com';
    const supplierPassword = process.env.SEED_SUPPLIER_PASSWORD || 'Supplier@123456';
    const supplierFirstName = 'Pars';
    const supplierLastName = 'Supplier';
    const existingSupplierUser = await prisma.user.findUnique({
        where: { email: supplierEmail },
        include: { supplier: true },
    });
    if (!existingSupplierUser) {
        const hashedPassword = await argon2.hash(supplierPassword);
        await prisma.user.create({
            data: {
                email: supplierEmail,
                password: hashedPassword,
                firstName: supplierFirstName,
                lastName: supplierLastName,
                role: client_1.Role.SUPPLIER,
                isActive: true,
                supplier: {
                    create: {
                        companyName: 'Pars Home Electronics',
                        description: 'Home appliances and electronics manufacturing',
                        address: 'Tehran, Iran',
                        phone: '+98 21 8888 0000',
                        isApproved: true,
                    },
                },
            },
        });
        console.log(`Seeded supplier user and profile: ${supplierEmail}`);
    }
    else {
        console.log(`Supplier user already exists: ${supplierEmail}`);
        if (!existingSupplierUser.supplier) {
            await prisma.supplier.create({
                data: {
                    userId: existingSupplierUser.id,
                    companyName: 'Pars Home Electronics',
                    description: 'Home appliances and electronics manufacturing',
                    address: 'Tehran, Iran',
                    phone: '+98 21 8888 0000',
                    isApproved: true,
                },
            });
            console.log(`Created supplier profile for existing user: ${supplierEmail}`);
        }
    }
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});

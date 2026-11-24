import { PrismaClient, Role } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

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
        role: Role.SUPERVISOR,
        isActive: true,
      },
    });
    console.log(`Seeded supervisor user: ${supervisorEmail}`);
  } else {
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
        role: Role.SUPPLIER,
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
  } else {
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

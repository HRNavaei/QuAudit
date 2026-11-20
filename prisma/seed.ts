import { PrismaClient, Role } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@quaudit.com';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin@123456';
  const firstName = process.env.SEED_ADMIN_FIRST_NAME || 'System';
  const lastName = process.env.SEED_ADMIN_LAST_NAME || 'Admin';

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    const hashedPassword = await argon2.hash(adminPassword);
    await prisma.user.create({
      data: {
        email: adminEmail,
        password: hashedPassword,
        firstName,
        lastName,
        role: Role.ADMIN,
        isActive: true,
      },
    });
    console.log(`Seeded admin user: ${adminEmail}`);
  } else {
    console.log(`Admin user already exists: ${adminEmail}`);
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

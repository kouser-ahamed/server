import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const main = async () => {
  const saltRounds = 12;
  const adminPassword = await bcrypt.hash('admin123456', saltRounds);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@wheelio.com' },
    update: {},
    create: {
      name: 'Wheelio Admin',
      email: 'admin@wheelio.com',
      password: adminPassword,
      role: 'ADMIN',
      isVerified: true,
    },
  });

  const categories = ['Economy', 'Sedan', 'SUV', 'Luxury', 'Electric', 'Motorcycle', 'Scooter'];

  for (const name of categories) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  console.log('✅ Seed completed:');
  console.log(`   - Admin: ${admin.email} (password: admin123456)`);
  console.log(`   - Categories: ${categories.join(', ')}`);
};

main()
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

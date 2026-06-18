import { PrismaClient } from '@prisma/client';
import { seedUsers } from './users.seed';
import { seedFamilies } from './families.seed';
import { seedAuditLogs } from './audit.seed';

const prisma = new PrismaClient();

async function main() {
  console.log('--- DIGITAL POVERTY TWIN (DPT) DATABASE SEEDING STARTING ---');
  
  // 1. Seed Users (1 Super Admin, 2 Gov Admin, 5 Village Admin, 10 Social Workers, 3 Researchers)
  const seededUsers = await seedUsers(prisma);

  // 2. Seed Families (50 Families with balanced Risk Levels, Indonesian names, Aceh addresses)
  const familySummary = await seedFamilies(prisma);

  // 3. Seed Audit Logs (50 linked log entries)
  const seededAuditLogsCount = await seedAuditLogs(prisma, seededUsers);

  console.log('\n--- SEEDING COMPLETED SUCCESSFULLY ---');
  console.log('==================================================');
  console.log('               DATABASE SEED SUMMARY              ');
  console.log('==================================================');
  console.log(`- Users inserted      : ${seededUsers.length}`);
  console.log(`- Families inserted   : ${familySummary.familiesCount}`);
  console.log(`- Members inserted    : ${familySummary.membersCount}`);
  console.log(`- Incomes inserted    : ${familySummary.incomesCount}`);
  console.log(`- Assets inserted     : ${familySummary.assetsCount}`);
  console.log(`- Debts inserted      : ${familySummary.debtsCount}`);
  console.log(`- Educations inserted : ${familySummary.educationsCount}`);
  console.log(`- Employments inserted: ${familySummary.employmentsCount}`);
  console.log(`- Audit logs inserted : ${seededAuditLogsCount}`);
  console.log('==================================================');
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error('Seeding failed with error:');
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

export async function seedUsers(prisma: PrismaClient) {
  console.log('Seeding users...');
  
  const passwordHash = await bcrypt.hash('Admin123!', 12);

  const usersToSeed = [
    // 1 Super Admin
    {
      email: 'superadmin@dpt.go.id',
      name: 'Budi Santoso (Super Admin)',
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
    },
    // 2 Government Admin
    {
      email: 'govadmin1@dpt.go.id',
      name: 'Rian Hidayat (Gov Admin 1)',
      role: UserRole.GOVERNMENT_ADMIN,
      status: UserStatus.ACTIVE,
    },
    {
      email: 'govadmin2@dpt.go.id',
      name: 'Siti Aminah (Gov Admin 2)',
      role: UserRole.GOVERNMENT_ADMIN,
      status: UserStatus.ACTIVE,
    },
    // 5 Village Admin
    {
      email: 'villageadmin1@dpt.go.id',
      name: 'Agus Wijaya (Village Admin 1)',
      role: UserRole.VILLAGE_ADMIN,
      status: UserStatus.ACTIVE,
    },
    {
      email: 'villageadmin2@dpt.go.id',
      name: 'Dewi Lestari (Village Admin 2)',
      role: UserRole.VILLAGE_ADMIN,
      status: UserStatus.ACTIVE,
    },
    {
      email: 'villageadmin3@dpt.go.id',
      name: 'Bambang Kusuma (Village Admin 3)',
      role: UserRole.VILLAGE_ADMIN,
      status: UserStatus.ACTIVE,
    },
    {
      email: 'villageadmin4@dpt.go.id',
      name: 'Eka Saputra (Village Admin 4)',
      role: UserRole.VILLAGE_ADMIN,
      status: UserStatus.ACTIVE,
    },
    {
      email: 'villageadmin5@dpt.go.id',
      name: 'Fitriani (Village Admin 5)',
      role: UserRole.VILLAGE_ADMIN,
      status: UserStatus.ACTIVE,
    },
    // 10 Social Workers
    {
      email: 'socialworker1@dpt.go.id',
      name: 'Hendra Setiawan (Social Worker 1)',
      role: UserRole.SOCIAL_WORKER,
      status: UserStatus.ACTIVE,
    },
    {
      email: 'socialworker2@dpt.go.id',
      name: 'Ira Wati (Social Worker 2)',
      role: UserRole.SOCIAL_WORKER,
      status: UserStatus.ACTIVE,
    },
    {
      email: 'socialworker3@dpt.go.id',
      name: 'Joko Susilo (Social Worker 3)',
      role: UserRole.SOCIAL_WORKER,
      status: UserStatus.ACTIVE,
    },
    {
      email: 'socialworker4@dpt.go.id',
      name: 'Kartika Sari (Social Worker 4)',
      role: UserRole.SOCIAL_WORKER,
      status: UserStatus.ACTIVE,
    },
    {
      email: 'socialworker5@dpt.go.id',
      name: 'Lukman Hakim (Social Worker 5)',
      role: UserRole.SOCIAL_WORKER,
      status: UserStatus.ACTIVE,
    },
    {
      email: 'socialworker6@dpt.go.id',
      name: 'Maria Ulfa (Social Worker 6)',
      role: UserRole.SOCIAL_WORKER,
      status: UserStatus.ACTIVE,
    },
    {
      email: 'socialworker7@dpt.go.id',
      name: 'Novianti (Social Worker 7)',
      role: UserRole.SOCIAL_WORKER,
      status: UserStatus.ACTIVE,
    },
    {
      email: 'socialworker8@dpt.go.id',
      name: 'Oki Setiawan (Social Worker 8)',
      role: UserRole.SOCIAL_WORKER,
      status: UserStatus.ACTIVE,
    },
    {
      email: 'socialworker9@dpt.go.id',
      name: 'Putri Rahayu (Social Worker 9)',
      role: UserRole.SOCIAL_WORKER,
      status: UserStatus.ACTIVE,
    },
    {
      email: 'socialworker10@dpt.go.id',
      name: 'Rudi Hermawan (Social Worker 10)',
      role: UserRole.SOCIAL_WORKER,
      status: UserStatus.ACTIVE,
    },
    // 3 Researchers
    {
      email: 'researcher1@dpt.go.id',
      name: 'Sri Wahyuni (Researcher 1)',
      role: UserRole.RESEARCHER,
      status: UserStatus.ACTIVE,
    },
    {
      email: 'researcher2@dpt.go.id',
      name: 'Taufik Hidayat (Researcher 2)',
      role: UserRole.RESEARCHER,
      status: UserStatus.ACTIVE,
    },
    {
      email: 'researcher3@dpt.go.id',
      name: 'Utami Dewi (Researcher 3)',
      role: UserRole.RESEARCHER,
      status: UserStatus.ACTIVE,
    },
  ];

  const seededUsers = [];

  // Seed users using upsert to avoid duplicates and support re-seeding
  for (const u of usersToSeed) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        name: u.name,
        role: u.role,
        status: u.status,
        passwordHash,
      },
      create: {
        email: u.email,
        name: u.name,
        role: u.role,
        status: u.status,
        passwordHash,
      },
    });
    seededUsers.push(user);
  }

  console.log(`Successfully seeded ${seededUsers.length} users.`);
  return seededUsers;
}

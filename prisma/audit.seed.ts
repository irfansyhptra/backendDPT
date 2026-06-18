import { PrismaClient, AuditAction, AuditOutcome, User, Prisma } from '@prisma/client';
import { faker } from '@faker-js/faker';

export async function seedAuditLogs(prisma: PrismaClient, users: User[]) {
  console.log('Seeding audit logs...');

  // Delete all existing audit logs
  await prisma.auditLog.deleteMany({});
  console.log('Purged existing audit logs.');

  if (users.length === 0) {
    console.log('No users provided to link audit logs.');
    return 0;
  }

  const actions = [
    AuditAction.LOGIN,
    AuditAction.LOGOUT,
    AuditAction.PROFILE_UPDATE,
    AuditAction.FAMILY_CREATE,
    AuditAction.MEMBER_ADD,
    AuditAction.FAMILY_UPDATE,
    AuditAction.USER_APPROVE,
  ];

  const devices = [
    'iPhone 15 Pro, iOS 17.2, Mobile App',
    'Samsung Galaxy S24 Ultra, Android 14, Mobile App',
    'Xiaomi RedMi Note 13, Android 13, Mobile App',
    'Google Pixel 8, Android 14, Mobile App',
    'iPad Pro, iPadOS 17.1, Mobile App'
  ];

  let logCount = 0;

  // Generate 50 realistic audit logs over the last 10 days
  for (let i = 0; i < 50; i++) {
    const user = users[Math.floor(Math.random() * users.length)];
    const action = actions[Math.floor(Math.random() * actions.length)];
    
    // Outcome probability: 92% SUCCESS, 8% FAILURE
    const outcome = Math.random() > 0.08 ? AuditOutcome.SUCCESS : AuditOutcome.FAILURE;
    
    const ipAddress = faker.internet.ipv4();
    const deviceInfo = getRandomElement(devices);
    const createdAt = faker.date.recent({ days: 10 });

    let resource = '';
    let metadata: any = {};

    switch (action) {
      case AuditAction.LOGIN:
        resource = 'Auth';
        metadata = {
          email: user.email,
          loginMethod: 'JWT',
          status: outcome === AuditOutcome.SUCCESS ? 'Logged in successfully' : 'Invalid credentials'
        };
        break;
      case AuditAction.LOGOUT:
        resource = 'Auth';
        metadata = {
          email: user.email,
          reason: 'User click'
        };
        break;
      case AuditAction.PROFILE_UPDATE:
        resource = `User/${user.id}`;
        metadata = {
          fieldsChanged: ['name'],
          oldValue: { name: user.name },
          newValue: { name: user.name + ' (Updated)' }
        };
        break;
      case AuditAction.FAMILY_CREATE:
        resource = 'Family';
        metadata = {
          kkNumber: `1171${faker.string.numeric(12)}`,
          headName: faker.person.fullName()
        };
        break;
      case AuditAction.MEMBER_ADD:
        resource = 'FamilyMember';
        metadata = {
          memberName: faker.person.fullName(),
          relationship: 'Anak'
        };
        break;
      case AuditAction.FAMILY_UPDATE:
        resource = 'Family';
        metadata = {
          povertyRiskScoreBefore: 65,
          povertyRiskScoreAfter: 68
        };
        break;
      case AuditAction.USER_APPROVE:
        resource = 'User';
        metadata = {
          approvedUserEmail: 'new_social_worker@dpt.go.id',
          approvedBy: user.email
        };
        break;
    }

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action,
        resource,
        outcome,
        ipAddress,
        deviceInfo,
        metadata: metadata ? (metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
        createdAt,
      }
    });

    logCount++;
  }

  console.log(`Successfully seeded ${logCount} audit log entries.`);
  return logCount;
}

function getRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

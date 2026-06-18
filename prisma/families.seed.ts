import { PrismaClient, RiskLevel } from '@prisma/client';
import { faker } from '@faker-js/faker';

// Curated lists for Banda Aceh, Aceh
const ACEH_AREAS = [
  {
    subDistrict: 'Baiturrahman',
    villages: ['Kampung Baru', 'Neusu Aceh', 'Ateuk Jawo', 'Seutui', 'Peuniti', 'Sukaramai']
  },
  {
    subDistrict: 'Kuta Alam',
    villages: ['Laksana', 'Keudah', 'Peunayong', 'Mulia', 'Lamprit', 'Beurawe', 'Kota Baru']
  },
  {
    subDistrict: 'Meuraxa',
    villages: ['Ulee Lheue', 'Punge Ujong', 'Blang Oi', 'Lambung', 'Deah Baro', 'Deah Glumpang']
  },
  {
    subDistrict: 'Syiah Kuala',
    villages: ['Kopelma Darussalam', 'Pineung', 'Jeulingke', 'Lamgugob', 'Alue Deah Teungoh']
  },
  {
    subDistrict: 'Ulee Kareng',
    villages: ['Pango Raya', 'Ceurih', 'Lamteh', 'Ilie', 'Pango Deah']
  }
];

const MALE_NAMES = [
  'Teuku Faisal', 'Muhammad Ridwan', 'Ahmad Munir', 'Irfan Syahputra', 'Rian Hidayat',
  'Zulkifli', 'Syahrul Ramadhan', 'Rizal Fahlevi', 'Hendrawan', 'Agus Wijaya',
  'Teuku Iskandar', 'Faisal Basri', 'Bustami', 'Darwis', 'Mukhlis', 'Muzakir',
  'Jufri', 'Zainal Abidin', 'Hasballah', 'Tarmizi', 'Ilham', 'Saiful', 'Amri'
];

const FEMALE_NAMES = [
  'Cut Indah', 'Siti Fatima', 'Putri Rahayu', 'Dewi Lestari', 'Fitriani',
  'Siti Aminah', 'Rina Wati', 'Cut Nyak Meutia', 'Novianti', 'Sri Wahyuni',
  'Cut Wardah', 'Nurul Akmal', 'Farida', 'Asmaul Husna', 'Syarifah', 'Juliana',
  'Marlina', 'Ernawati', 'Khairiah', 'Nurlaila', 'Yusnidar', 'Mariani'
];

const LAST_NAMES = [
  'Pratama', 'Saputra', 'Wijaya', 'Kurniawan', 'Sanjaya', 'Putra', 'Lestari',
  'Sari', 'Utami', 'Fitriani', 'Hidayat', 'Ginting', 'Nasution', 'Siregar'
];

function getRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function generateIndonesianName(isMale: boolean): string {
  const first = isMale ? getRandomElement(MALE_NAMES) : getRandomElement(FEMALE_NAMES);
  const last = getRandomElement(LAST_NAMES);
  return `${first} ${last}`;
}

function generateKKNumber(): string {
  // 16 digits KK Number: Aceh code 11 + Banda Aceh code 71 + Random digits
  let kk = '1171';
  for (let i = 0; i < 12; i++) {
    kk += Math.floor(Math.random() * 10).toString();
  }
  return kk;
}

export async function seedFamilies(prisma: PrismaClient) {
  console.log('Seeding families and economic data...');

  // 1. Delete all existing families (cascade deletes all related tables: members, incomes, assets, debts, educations, employments)
  await prisma.family.deleteMany({});
  console.log('Purged existing families database tables.');

  // Define total families to generate per risk level
  const distributions = [
    { level: RiskLevel.SAFE, count: 15 },
    { level: RiskLevel.VULNERABLE, count: 15 },
    { level: RiskLevel.WARNING, count: 10 },
    { level: RiskLevel.HIGH_RISK, count: 7 },
    { level: RiskLevel.CRITICAL, count: 3 }
  ];

  let totalFamilies = 0;
  let totalMembers = 0;
  let totalIncomes = 0;
  let totalAssets = 0;
  let totalDebts = 0;
  let totalEducations = 0;
  let totalEmployments = 0;

  for (const dist of distributions) {
    for (let i = 0; i < dist.count; i++) {
      const area = getRandomElement(ACEH_AREAS);
      const village = getRandomElement(area.villages);
      const subDistrict = area.subDistrict;

      const kkNumber = generateKKNumber();
      const headIsMale = Math.random() > 0.1;
      const headName = generateIndonesianName(headIsMale);
      const address = `Jl. ${faker.location.street()}, No. ${faker.number.int({ min: 1, max: 99 })}, Gampong ${village}`;

      // 2. Generate Economic Profile matching the RiskLevel strictly to ensure PRS consistency
      let monthlyIncome = 0;
      let monthlyExpenses = 0;
      let ownsHouse = true;
      let houseCondition = 'Layak';
      let debtAmount = 0;
      let assetValue = 0;
      let povertyRiskScore = 0;

      // Temporary lists for creating nested sub-entities
      const incomesList: { source: string; amount: number; recipientName?: string }[] = [];
      const assetsList: { name: string; value: number; description?: string }[] = [];
      const debtsList: { source: string; amount: number; monthlyPayment: number; interestRate?: number }[] = [];

      switch (dist.level) {
        case RiskLevel.SAFE: {
          monthlyIncome = faker.number.int({ min: 3500000, max: 6500000 });
          monthlyExpenses = Math.floor(monthlyIncome * faker.number.float({ min: 0.6, max: 0.8 }));
          ownsHouse = true;
          houseCondition = getRandomElement(['Layak', 'Sangat Baik']);
          debtAmount = faker.number.int({ min: 0, max: 1500000 });
          assetValue = faker.number.int({ min: 8000000, max: 35000000 });
          povertyRiskScore = faker.number.float({ min: 0, max: 15, fractionDigits: 1 });

          incomesList.push({ source: 'Gaji Bulanan', amount: monthlyIncome, recipientName: headName });
          assetsList.push({ name: 'Tanah & Bangunan Rumah', value: Math.floor(assetValue * 0.7) });
          assetsList.push({ name: 'Sepeda Motor Honda Vario', value: Math.floor(assetValue * 0.3) });
          if (debtAmount > 0) {
            debtsList.push({ source: 'Kredit Motor Fifada', amount: debtAmount, monthlyPayment: Math.floor(debtAmount / 12) });
          }
          break;
        }
        case RiskLevel.VULNERABLE: {
          monthlyIncome = faker.number.int({ min: 2000000, max: 2400000 }); // +5 points
          monthlyExpenses = Math.floor(monthlyIncome * faker.number.float({ min: 0.85, max: 0.95 })); // +0 points
          ownsHouse = true;
          houseCondition = 'Cukup Layak'; // +10 points
          debtAmount = faker.number.int({ min: 2100000, max: 4800000 }); // +8 points
          assetValue = faker.number.int({ min: 600000, max: 1400000 }); // +8 points
          povertyRiskScore = faker.number.float({ min: 30, max: 45, fractionDigits: 1 }); // Total ~ 31

          incomesList.push({ source: 'Hasil Wiraswasta Kios', amount: monthlyIncome, recipientName: headName });
          assetsList.push({ name: 'Barang Dagangan Kios', value: Math.floor(assetValue * 0.6) });
          assetsList.push({ name: 'Peralatan Rumah Tangga', value: Math.floor(assetValue * 0.4) });
          debtsList.push({ source: 'Pinjaman Koperasi UED-SP', amount: debtAmount, monthlyPayment: Math.floor(debtAmount / 18) });
          break;
        }
        case RiskLevel.WARNING: {
          monthlyIncome = faker.number.int({ min: 1100000, max: 1400000 }); // +15 points
          monthlyExpenses = Math.floor(monthlyIncome * faker.number.float({ min: 1.05, max: 1.15 })); // +15 points
          ownsHouse = false; // +10 points
          houseCondition = getRandomElement(['Sedang', 'Cukup Layak']); // +10 points
          debtAmount = faker.number.int({ min: 0, max: 1500000 }); // +0 points
          assetValue = faker.number.int({ min: 1600000, max: 4000000 }); // +0 points
          povertyRiskScore = faker.number.float({ min: 50, max: 65, fractionDigits: 1 }); // Total ~ 50

          incomesList.push({ source: 'Upah Buruh Harian Lepas', amount: monthlyIncome, recipientName: headName });
          assetsList.push({ name: 'Sepeda Motor Suzuki Shogun Tua', value: Math.floor(assetValue * 0.8) });
          if (debtAmount > 0) {
            debtsList.push({ source: 'Hutang Sembako Warung', amount: debtAmount, monthlyPayment: Math.floor(debtAmount / 3) });
          }
          break;
        }
        case RiskLevel.HIGH_RISK: {
          monthlyIncome = faker.number.int({ min: 800000, max: 950000 }); // ~800,000 - 950,000 (+25 points)
          monthlyExpenses = Math.floor(monthlyIncome * faker.number.float({ min: 1.1, max: 1.25 })); // +15 points
          ownsHouse = false; // +10 points
          houseCondition = 'Cukup Layak'; // +10 points
          debtAmount = faker.number.int({ min: 2500000, max: 4500000 }); // +8 points
          assetValue = faker.number.int({ min: 600000, max: 1450000 }); // +8 points
          povertyRiskScore = faker.number.float({ min: 70, max: 82, fractionDigits: 1 }); // Total ~ 76

          incomesList.push({ source: 'Hasil Tangkapan Nelayan Tradisional', amount: monthlyIncome, recipientName: headName });
          assetsList.push({ name: 'Jaring & Peralatan Nelayan', value: Math.floor(assetValue * 0.5) });
          assetsList.push({ name: 'Alat Rumah Tangga', value: Math.floor(assetValue * 0.5) });
          debtsList.push({ source: 'Pinjaman Tengkulak Ikan', amount: debtAmount, monthlyPayment: Math.floor(debtAmount / 12) });
          break;
        }
        case RiskLevel.CRITICAL: {
          monthlyIncome = faker.number.int({ min: 300000, max: 700000 }); // +25 points
          monthlyExpenses = Math.floor(monthlyIncome * faker.number.float({ min: 1.15, max: 1.35 })); // +15 points
          ownsHouse = false; // +10 points
          houseCondition = 'Tidak Layak Huni'; // +20 points
          debtAmount = faker.number.int({ min: 5500000, max: 8000000 }); // +15 points
          assetValue = faker.number.int({ min: 100000, max: 450000 }); // +15 points
          povertyRiskScore = faker.number.float({ min: 85, max: 100, fractionDigits: 1 }); // Total ~ 90-100

          incomesList.push({ source: 'Pendapatan Pemulung/Serabutan', amount: monthlyIncome, recipientName: headName });
          assetsList.push({ name: 'Peralatan Masak & Rumah Tangga Sederhana', value: assetValue });
          debtsList.push({ source: 'Hutang Rentenir Keliling', amount: Math.floor(debtAmount * 0.7), monthlyPayment: Math.floor(debtAmount * 0.08) });
          debtsList.push({ source: 'Hutang Warung Tetangga', amount: Math.floor(debtAmount * 0.3), monthlyPayment: Math.floor(debtAmount * 0.03) });
          break;
        }
      }

      // 3. Generate Family Members (2 to 6 members: Head, Spouse, Children)
      const membersToCreate = [];
      const familySize = faker.number.int({ min: 2, max: 6 });
      
      // Family Head
      const headAge = faker.number.int({ min: 28, max: 65 });
      membersToCreate.push({
        name: headName,
        relationship: 'Kepala Keluarga',
        age: headAge,
        isMale: headIsMale,
      });

      // Spouse
      let spouseName = '';
      if (familySize >= 2) {
        const spouseAge = headAge + faker.number.int({ min: -6, max: 4 });
        spouseName = generateIndonesianName(!headIsMale);
        membersToCreate.push({
          name: spouseName,
          relationship: 'Istri',
          age: Math.max(20, spouseAge),
          isMale: !headIsMale,
        });
      }

      // Children
      const numChildren = familySize - membersToCreate.length;
      for (let c = 0; c < numChildren; c++) {
        const childAge = Math.max(1, headAge - 20 - (c * faker.number.int({ min: 2, max: 5 })));
        const childIsMale = Math.random() > 0.5;
        membersToCreate.push({
          name: generateIndonesianName(childIsMale),
          relationship: 'Anak',
          age: childAge,
          isMale: childIsMale,
        });
      }

      // Prepare seed data for nested creation in database transaction
      const prsHistory = [
        Math.max(0, povertyRiskScore - faker.number.float({ min: 2, max: 8 })),
        Math.max(0, povertyRiskScore - faker.number.float({ min: 1, max: 4 })),
        povertyRiskScore
      ];

      // Build family payload
      await prisma.family.create({
        data: {
          kkNumber,
          headName,
          address,
          village,
          subDistrict,
          monthlyIncome,
          monthlyExpenses,
          ownsHouse,
          houseCondition,
          debtAmount,
          assetValue,
          povertyRiskScore,
          riskLevel: dist.level,
          scoreHistory: prsHistory,
          lastAssessment: new Date(),
          members: {
            create: membersToCreate.map((m) => {
              // Determine education if school aged (7-22)
              let educationData = undefined;
              if (m.age >= 7 && m.age <= 22) {
                let level = 'SD';
                let schoolName = 'SD Negeri 2 Banda Aceh';
                if (m.age >= 19) {
                  level = 'Perguruan Tinggi';
                  schoolName = 'Universitas Syiah Kuala';
                } else if (m.age >= 16) {
                  level = 'SMA';
                  schoolName = 'SMA Negeri 1 Banda Aceh';
                } else if (m.age >= 13) {
                  level = 'SMP';
                  schoolName = 'SMP Negeri 3 Banda Aceh';
                }

                // Poverty warning/high risk families might have dropout children
                let status = 'Aktif';
                if ((dist.level === RiskLevel.CRITICAL || dist.level === RiskLevel.HIGH_RISK) && Math.random() > 0.6) {
                  status = 'Putus Sekolah';
                }

                educationData = {
                  create: {
                    level,
                    status,
                    schoolName: status === 'Aktif' ? schoolName : null
                  }
                };
                totalEducations++;
              }

              // Determine employment if working age (18-65) and head/spouse
              let employmentData = undefined;
              if (m.age >= 18 && m.age <= 65 && (m.relationship === 'Kepala Keluarga' || m.relationship === 'Istri')) {
                let occupation = 'Tidak Bekerja';
                let status = 'Tidak Bekerja';
                let jobIncome = 0;
                let employerName = null;

                if (m.relationship === 'Kepala Keluarga') {
                  status = 'Bekerja';
                  jobIncome = monthlyIncome;
                  if (dist.level === RiskLevel.SAFE) {
                    occupation = getRandomElement(['Karyawan Swasta', 'Pegawai Negeri Sipil (PNS)', 'Wiraswasta']);
                    employerName = occupation === 'Wiraswasta' ? 'Milik Sendiri' : 'Pemerintah/Perusahaan Swasta';
                  } else if (dist.level === RiskLevel.VULNERABLE) {
                    occupation = getRandomElement(['Supir Angkot', 'Buruh Pabrik', 'Pedagang Kelontong']);
                    employerName = 'Pemilik Angkot/Swasta';
                  } else if (dist.level === RiskLevel.WARNING) {
                    occupation = getRandomElement(['Buruh Tani', 'Kuli Bangunan', 'Supir Becak']);
                  } else if (dist.level === RiskLevel.HIGH_RISK) {
                    occupation = 'Nelayan Tradisional';
                  } else if (dist.level === RiskLevel.CRITICAL) {
                    occupation = getRandomElement(['Pemulung', 'Buruh Cuci Harian', 'Serabutan']);
                  }
                } else if (m.relationship === 'Istri') {
                  // Spouse employment
                  if (dist.level === RiskLevel.SAFE && Math.random() > 0.4) {
                    status = 'Bekerja';
                    occupation = 'Karyawan Swasta';
                    jobIncome = faker.number.int({ min: 2000000, max: 3000000 });
                    employerName = 'Toko retail';
                  } else {
                    status = 'Tidak Bekerja';
                    occupation = 'Ibu Rumah Tangga';
                    jobIncome = 0;
                  }
                }

                employmentData = {
                  create: {
                    occupation,
                    status,
                    monthlyIncome: jobIncome,
                    employerName
                  }
                };
                totalEmployments++;
              }

              totalMembers++;
              return {
                name: m.name,
                relationship: m.relationship,
                age: m.age,
                education: educationData,
                employment: employmentData
              };
            })
          },
          incomes: {
            create: incomesList.map((inc) => {
              totalIncomes++;
              return {
                source: inc.source,
                amount: inc.amount,
                recipientName: inc.recipientName
              };
            })
          },
          assets: {
            create: assetsList.map((ast) => {
              totalAssets++;
              return {
                name: ast.name,
                value: ast.value,
                description: ast.description || null
              };
            })
          },
          debts: {
            create: debtsList.map((dbt) => {
              totalDebts++;
              return {
                source: dbt.source,
                amount: dbt.amount,
                monthlyPayment: dbt.monthlyPayment,
                interestRate: dbt.interestRate || null
              };
            })
          }
        }
      });
      
      totalFamilies++;
    }
  }

  console.log(`Successfully seeded families data:`);
  console.log(`- Families: ${totalFamilies}`);
  console.log(`- Members: ${totalMembers}`);
  console.log(`- Incomes: ${totalIncomes}`);
  console.log(`- Assets: ${totalAssets}`);
  console.log(`- Debts: ${totalDebts}`);
  console.log(`- Educations: ${totalEducations}`);
  console.log(`- Employments: ${totalEmployments}`);

  return {
    familiesCount: totalFamilies,
    membersCount: totalMembers,
    incomesCount: totalIncomes,
    assetsCount: totalAssets,
    debtsCount: totalDebts,
    educationsCount: totalEducations,
    employmentsCount: totalEmployments
  };
}

import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("开始预置测试数据...");

  const adminPassword = await hash("admin123", 12);
  const userPassword = await hash("user123", 12);

  const admin = await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      hashedPassword: adminPassword,
      email: "admin@lq.com",
      fullName: "系统管理员",
      role: 1,
      isActive: true,
      isApproved: true,
    },
  });
  console.log("创建管理员用户:", admin.username);

  const testUser = await prisma.user.upsert({
    where: { username: "testuser" },
    update: {},
    create: {
      username: "testuser",
      hashedPassword: userPassword,
      email: "testuser@lq.com",
      fullName: "测试用户",
      phone: "13800138000",
      isActive: true,
      isApproved: true,
    },
  });
  console.log("创建测试用户:", testUser.username);

  const depot1 = await prisma.depot.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      name: "北京粮食储备库",
      address: "北京市朝阳区",
      contactPerson: "张经理",
      phone: "010-12345678",
      province: "北京",
    },
  });
  console.log("创建粮库:", depot1.name);

  const depot2 = await prisma.depot.upsert({
    where: { id: 2 },
    update: {},
    create: {
      id: 2,
      name: "上海粮食储备库",
      address: "上海市浦东新区",
      contactPerson: "李经理",
      phone: "021-87654321",
      province: "上海",
    },
  });
  console.log("创建粮库:", depot2.name);

  const granary1 = await prisma.granary.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      depotId: 1,
      name: "1号仓",
      collectionStatus: 1,
      lastCollectedAt: new Date(),
    },
  });
  console.log("创建仓房:", granary1.name);

  const granary2 = await prisma.granary.upsert({
    where: { id: 2 },
    update: {},
    create: {
      id: 2,
      depotId: 1,
      name: "2号仓",
      collectionStatus: 0,
    },
  });
  console.log("创建仓房:", granary2.name);

  const granary3 = await prisma.granary.upsert({
    where: { id: 3 },
    update: {},
    create: {
      id: 3,
      depotId: 2,
      name: "A仓",
      collectionStatus: 1,
      lastCollectedAt: new Date(),
    },
  });
  console.log("创建仓房:", granary3.name);

  for (let i = 1; i <= 10; i++) {
    const temps = Array.from({ length: 6 }, () => 15 + Math.random() * 10);
    await prisma.granaryData.create({
      data: {
        granaryId: 1,
        sequenceNumber: i,
        temperatureValues: temps,
        humidityValues: 45 + Math.random() * 10,
        collectedAt: new Date(Date.now() - i * 3600000),
      },
    });
  }
  console.log("创建测试温湿度数据");

  const association = await prisma.userDepotAssociation.upsert({
    where: {
      userId_depotId: {
        userId: testUser.id,
        depotId: depot1.id,
      },
    },
    update: {},
    create: {
      userId: testUser.id,
      depotId: depot1.id,
    },
  });
  console.log("创建用户粮库关联");

  console.log("测试数据预置完成！");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

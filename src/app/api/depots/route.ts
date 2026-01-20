import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const search = searchParams.get("search") || "";

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { address: { contains: search, mode: "insensitive" } },
        { contactPerson: { contains: search, mode: "insensitive" } },
      ];
    }

    if (session.user.role !== 1) {
      const associations = await prisma.userDepotAssociation.findMany({
        where: { userId: parseInt(session.user.id) },
        select: { depotId: true },
      });
      where.id = { in: associations.map((a) => a.depotId) };
    }

    const [depots, total] = await Promise.all([
      prisma.depot.findMany({
        where,
        include: {
          granaries: {
            select: { id: true, name: true },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.depot.count({ where }),
    ]);

    return NextResponse.json({
      data: depots,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get depots error:", error);
    return NextResponse.json(
      { error: "获取粮库列表失败" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    if (session.user.role !== 1) {
      return NextResponse.json({ error: "无权限创建粮库" }, { status: 403 });
    }

    const body = await request.json();
    const { name, address, contactPerson, phone, province } = body;

    if (!name) {
      return NextResponse.json({ error: "粮库名称为必填项" }, { status: 400 });
    }

    const depot = await prisma.depot.create({
      data: {
        name,
        address,
        contactPerson,
        phone,
        province,
      },
    });

    return NextResponse.json(depot);
  } catch (error) {
    console.error("Create depot error:", error);
    return NextResponse.json(
      { error: "创建粮库失败" },
      { status: 500 }
    );
  }
}

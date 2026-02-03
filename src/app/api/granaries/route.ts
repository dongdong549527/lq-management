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

    // Auto-reset stuck collections:
    // If status is 2 (Collecting) and last update was > 2 minutes ago, reset to 0 (Pending).
    // This handles cases where client crashed or refreshed during collection.
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    await prisma.granary.updateMany({
        where: {
            collectionStatus: 2,
            updatedAt: {
                lt: twoMinutesAgo
            }
        },
        data: {
            collectionStatus: 0 // Reset to pending
        }
    });

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const depotId = searchParams.get("depotId");
    const search = searchParams.get("search") || "";

    const where: any = {};

    if (depotId) {
      where.depotId = parseInt(depotId);
    } else if (session.user.role !== 1) {
      const associations = await prisma.userDepotAssociation.findMany({
        where: { userId: parseInt(session.user.id) },
        select: { depotId: true },
      });
      where.depotId = { in: associations.map((a) => a.depotId) };
    }

    if (search) {
      where.name = { contains: search, mode: "insensitive" };
    }

    const [granaries, total] = await Promise.all([
      prisma.granary.findMany({
        where,
        include: {
          depot: { select: { id: true, name: true } },
          config: true,
          info: true,
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.granary.count({ where }),
    ]);

    return NextResponse.json({
      data: granaries,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get granaries error:", error);
    return NextResponse.json(
      { error: "获取仓房列表失败" },
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

    const body = await request.json();
    const { depotId, name } = body;

    if (!depotId || !name) {
      return NextResponse.json(
        { error: "粮库ID和仓房名称为必填项" },
        { status: 400 }
      );
    }

    const parsedDepotId = parseInt(depotId);
    if (isNaN(parsedDepotId)) {
      return NextResponse.json(
        { error: "无效的粮库ID" },
        { status: 400 }
      );
    }

    // Ensure role is treated as number for comparison
    const userRole = typeof session.user.role === 'string' ? parseInt(session.user.role) : session.user.role;

    if (userRole !== 1) {
      return NextResponse.json({ error: "无权限创建仓房" }, { status: 403 });
    }

    const granary = await prisma.granary.create({
      data: {
        depotId: parsedDepotId,
        name,
      },
    });

    return NextResponse.json(granary);
  } catch (error) {
    console.error("Create granary error:", error);
    return NextResponse.json(
      { error: "创建仓房失败" },
      { status: 500 }
    );
  }
}

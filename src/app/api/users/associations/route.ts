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

    if (session.user.role !== 1) {
      return NextResponse.json({ error: "无权限查看用户关联" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");

    const [associations, total] = await Promise.all([
      prisma.userDepotAssociation.findMany({
        include: {
          user: {
            select: {
              id: true,
              username: true,
              fullName: true,
              email: true,
            },
          },
          depot: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.userDepotAssociation.count(),
    ]);

    return NextResponse.json({
      data: associations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get associations error:", error);
    return NextResponse.json(
      { error: "获取用户关联失败" },
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
      return NextResponse.json({ error: "无权限分配粮库" }, { status: 403 });
    }

    const body = await request.json();
    const { userId, depotId } = body;

    if (!userId || !depotId) {
      return NextResponse.json(
        { error: "用户ID和粮库ID为必填项" },
        { status: 400 }
      );
    }

    const existing = await prisma.userDepotAssociation.findUnique({
      where: {
        userId_depotId: { userId, depotId },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "该用户已关联此粮库" },
        { status: 400 }
      );
    }

    const association = await prisma.userDepotAssociation.create({
      data: {
        userId,
        depotId,
      },
      include: {
        user: { select: { id: true, username: true, fullName: true } },
        depot: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(association);
  } catch (error) {
    console.error("Create association error:", error);
    return NextResponse.json(
      { error: "分配粮库失败" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    if (session.user.role !== 1) {
      return NextResponse.json({ error: "无权限取消关联" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "关联ID为必填项" }, { status: 400 });
    }

    await prisma.userDepotAssociation.delete({
      where: { id: parseInt(id) },
    });

    return NextResponse.json({ message: "取消关联成功" });
  } catch (error) {
    console.error("Delete association error:", error);
    return NextResponse.json(
      { error: "取消关联失败" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 1) {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }

    const resolvedParams = await params;
    const userId = parseInt(resolvedParams.id);

    const associations = await prisma.userDepotAssociation.findMany({
      where: { userId },
      select: { depotId: true },
    });

    return NextResponse.json(associations.map((a) => a.depotId));
  } catch (error) {
    console.error("Get user associations error:", error);
    return NextResponse.json(
      { error: "获取用户关联粮库失败" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 1) {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }

    const resolvedParams = await params;
    const userId = parseInt(resolvedParams.id);
    const body = await request.json();
    const { depotIds } = body; // Array of depot IDs

    if (!Array.isArray(depotIds)) {
      return NextResponse.json({ error: "无效的数据格式" }, { status: 400 });
    }

    // Transaction to replace all associations
    await prisma.$transaction(async (tx) => {
      // 1. Delete existing associations
      await tx.userDepotAssociation.deleteMany({
        where: { userId },
      });

      // 2. Create new associations
      if (depotIds.length > 0) {
        await tx.userDepotAssociation.createMany({
          data: depotIds.map((depotId: number) => ({
            userId,
            depotId,
          })),
        });
      }
    });

    return NextResponse.json({ message: "关联更新成功" });
  } catch (error) {
    console.error("Update user associations error:", error);
    return NextResponse.json(
      { error: "更新用户关联粮库失败" },
      { status: 500 }
    );
  }
}

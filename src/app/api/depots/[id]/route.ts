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
    if (!session) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const resolvedParams = await params;
    const depotId = parseInt(resolvedParams.id);

    // Check permissions if not admin
    if (session.user.role !== 1) {
      const association = await prisma.userDepotAssociation.findUnique({
        where: {
          userId_depotId: {
            userId: parseInt(session.user.id),
            depotId: depotId,
          },
        },
      });

      if (!association) {
        return NextResponse.json({ error: "无权限查看该粮库" }, { status: 403 });
      }
    }

    const depot = await prisma.depot.findUnique({
      where: { id: depotId },
      include: {
        granaries: {
          select: {
            id: true,
            name: true,
            collectionStatus: true,
            lastCollectedAt: true,
          },
        },
      },
    });

    if (!depot) {
      return NextResponse.json({ error: "粮库不存在" }, { status: 404 });
    }

    return NextResponse.json(depot);
  } catch (error) {
    console.error("Get depot details error:", error);
    return NextResponse.json(
      { error: "获取粮库详情失败" },
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
    if (!session) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    if (session.user.role !== 1) {
      return NextResponse.json({ error: "无权限编辑粮库" }, { status: 403 });
    }

    const resolvedParams = await params;
    const body = await request.json();
    const { name, address, contactPerson, phone, province } = body;

    const depot = await prisma.depot.update({
      where: { id: parseInt(resolvedParams.id) },
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
    console.error("Update depot error:", error);
    return NextResponse.json(
      { error: "更新粮库失败" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    if (session.user.role !== 1) {
      return NextResponse.json({ error: "无权限删除粮库" }, { status: 403 });
    }

    const resolvedParams = await params;
    await prisma.depot.delete({
      where: { id: parseInt(resolvedParams.id) },
    });

    return NextResponse.json({ message: "删除成功" });
  } catch (error) {
    console.error("Delete depot error:", error);
    return NextResponse.json(
      { error: "删除粮库失败" },
      { status: 500 }
    );
  }
}

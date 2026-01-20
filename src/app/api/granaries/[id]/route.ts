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
    const granaryId = parseInt(resolvedParams.id);

    const granary = await prisma.granary.findUnique({
      where: { id: granaryId },
      include: {
        depot: { select: { id: true, name: true } },
        config: true,
        info: true,
      },
    });

    if (!granary) {
      return NextResponse.json({ error: "仓房不存在" }, { status: 404 });
    }

    // Check permissions if not admin
    if (session.user.role !== 1) {
      const association = await prisma.userDepotAssociation.findUnique({
        where: {
          userId_depotId: {
            userId: parseInt(session.user.id),
            depotId: granary.depotId,
          },
        },
      });

      if (!association) {
        return NextResponse.json({ error: "无权限查看该仓房" }, { status: 403 });
      }
    }

    return NextResponse.json(granary);
  } catch (error) {
    console.error("Get granary error:", error);
    return NextResponse.json(
      { error: "获取仓房详情失败" },
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

    const resolvedParams = await params;
    const body = await request.json();
    const { name, depotId, config } = body;

    const updateData: any = {
      name,
      depotId: depotId ? parseInt(depotId) : undefined,
    };

    if (config) {
      updateData.config = {
        upsert: {
          create: {
            extensionNumber: config.extensionNumber ? parseInt(config.extensionNumber) : undefined,
            tempCollectorCount: config.tempCollectorCount ? parseInt(config.tempCollectorCount) : undefined,
            thCollectorCount: config.thCollectorCount ? parseInt(config.thCollectorCount) : undefined,
            startIndex: config.startIndex ? parseInt(config.startIndex) : undefined,
            endIndex: config.endIndex ? parseInt(config.endIndex) : undefined,
            thIndex: config.thIndex ? parseInt(config.thIndex) : undefined,
            cableCount: config.cableCount ? parseInt(config.cableCount) : undefined,
            cablePointCount: config.cablePointCount ? parseInt(config.cablePointCount) : undefined,
            totalCollectorCount: config.totalCollectorCount ? parseInt(config.totalCollectorCount) : undefined,
            mqttTopicSub: config.mqttTopicSub,
            mqttTopicPub: config.mqttTopicPub,
            collectionDevice: config.collectionDevice ? parseInt(config.collectionDevice) : undefined,
          },
          update: {
            extensionNumber: config.extensionNumber ? parseInt(config.extensionNumber) : null,
            tempCollectorCount: config.tempCollectorCount ? parseInt(config.tempCollectorCount) : null,
            thCollectorCount: config.thCollectorCount ? parseInt(config.thCollectorCount) : null,
            startIndex: config.startIndex ? parseInt(config.startIndex) : null,
            endIndex: config.endIndex ? parseInt(config.endIndex) : null,
            thIndex: config.thIndex ? parseInt(config.thIndex) : null,
            cableCount: config.cableCount ? parseInt(config.cableCount) : null,
            cablePointCount: config.cablePointCount ? parseInt(config.cablePointCount) : null,
            totalCollectorCount: config.totalCollectorCount ? parseInt(config.totalCollectorCount) : null,
            mqttTopicSub: config.mqttTopicSub,
            mqttTopicPub: config.mqttTopicPub,
            collectionDevice: config.collectionDevice ? parseInt(config.collectionDevice) : null,
          },
        },
      };
    }

    const granary = await prisma.granary.update({
      where: { id: parseInt(resolvedParams.id) },
      data: updateData,
      include: {
        config: true,
      },
    });

    return NextResponse.json(granary);
  } catch (error) {
    console.error("Update granary error:", error);
    return NextResponse.json(
      { error: "更新仓房失败" },
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

    const resolvedParams = await params;
    await prisma.granary.delete({
      where: { id: parseInt(resolvedParams.id) },
    });

    return NextResponse.json({ message: "删除成功" });
  } catch (error) {
    console.error("Delete granary error:", error);
    return NextResponse.json(
      { error: "删除仓房失败" },
      { status: 500 }
    );
  }
}

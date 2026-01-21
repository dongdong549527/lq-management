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
    const granaryId = parseInt(resolvedParams.id);
    const body = await request.json();
    const { 
      name, 
      depotId, 
      config,
      manager,
      designCapacity,
      actualCapacity,
      storageNature,
      variety,
      origin,
      grade,
      roughRiceYield,
      moisture,
      remark
    } = body;

    // Check permissions
    if (session.user.role !== 1) {
      // 1. Check permission for current granary
      const currentGranary = await prisma.granary.findUnique({
        where: { id: granaryId },
      });

      if (!currentGranary) {
        return NextResponse.json({ error: "仓房不存在" }, { status: 404 });
      }

      const hasSourcePermission = await prisma.userDepotAssociation.findUnique({
        where: {
          userId_depotId: {
            userId: parseInt(session.user.id),
            depotId: currentGranary.depotId,
          },
        },
      });

      if (!hasSourcePermission) {
        return NextResponse.json({ error: "无权操作此仓房" }, { status: 403 });
      }

      // 2. Prevent depot change for non-admins
      if (depotId && parseInt(depotId) !== currentGranary.depotId) {
        return NextResponse.json({ error: "无权变更所属粮库" }, { status: 403 });
      }
    }

    const updateData: any = {
      name,
    };

    // Only update depotId if provided and (admin or same depot)
    if (depotId) {
      updateData.depotId = parseInt(depotId);
    }

    if (config) {
      updateData.config = {
        upsert: {
          create: {
            extensionNumber: config.extensionNumber !== undefined ? parseInt(config.extensionNumber) : undefined,
            tempCollectorCount: config.tempCollectorCount !== undefined ? parseInt(config.tempCollectorCount) : undefined,
            thCollectorCount: config.thCollectorCount !== undefined ? parseInt(config.thCollectorCount) : undefined,
            startIndex: config.startIndex !== undefined ? parseInt(config.startIndex) : undefined,
            endIndex: config.endIndex !== undefined ? parseInt(config.endIndex) : undefined,
            indoorThIndex: config.indoorThIndex !== undefined ? parseInt(config.indoorThIndex) : undefined,
            outdoorThIndex: config.outdoorThIndex !== undefined ? parseInt(config.outdoorThIndex) : undefined,
            cableCount: config.cableCount !== undefined ? parseInt(config.cableCount) : undefined,
            cablePointCount: config.cablePointCount !== undefined ? parseInt(config.cablePointCount) : undefined,
            totalCollectorCount: config.totalCollectorCount !== undefined ? parseInt(config.totalCollectorCount) : undefined,
            mqttTopicSub: config.mqttTopicSub,
            mqttTopicPub: config.mqttTopicPub,
            collectionDevice: config.collectionDevice !== undefined ? parseInt(config.collectionDevice) : undefined,
            serialPort: config.serialPort,
          },
          update: {
            extensionNumber: config.extensionNumber !== undefined ? parseInt(config.extensionNumber) : null,
            tempCollectorCount: config.tempCollectorCount !== undefined ? parseInt(config.tempCollectorCount) : null,
            thCollectorCount: config.thCollectorCount !== undefined ? parseInt(config.thCollectorCount) : null,
            startIndex: config.startIndex !== undefined ? parseInt(config.startIndex) : null,
            endIndex: config.endIndex !== undefined ? parseInt(config.endIndex) : null,
            indoorThIndex: config.indoorThIndex !== undefined ? parseInt(config.indoorThIndex) : null,
            outdoorThIndex: config.outdoorThIndex !== undefined ? parseInt(config.outdoorThIndex) : null,
            cableCount: config.cableCount !== undefined ? parseInt(config.cableCount) : null,
            cablePointCount: config.cablePointCount !== undefined ? parseInt(config.cablePointCount) : null,
            totalCollectorCount: config.totalCollectorCount !== undefined ? parseInt(config.totalCollectorCount) : null,
            mqttTopicSub: config.mqttTopicSub,
            mqttTopicPub: config.mqttTopicPub,
            collectionDevice: config.collectionDevice !== undefined ? parseInt(config.collectionDevice) : null,
            serialPort: config.serialPort,
          },
        },
      };
    }

    // Handle GranaryInfo updates
    if (manager !== undefined || designCapacity !== undefined || actualCapacity !== undefined) {
        updateData.info = {
            upsert: {
                create: {
                    manager,
                    designCapacity: designCapacity ? parseFloat(designCapacity) : undefined,
                    actualCapacity: actualCapacity ? parseFloat(actualCapacity) : undefined,
                    storageNature,
                    variety,
                    origin,
                    grade,
                    roughRiceYield: roughRiceYield ? parseFloat(roughRiceYield) : undefined,
                    moisture: moisture ? parseFloat(moisture) : undefined,
                    remark,
                },
                update: {
                    manager,
                    designCapacity: designCapacity ? parseFloat(designCapacity) : null,
                    actualCapacity: actualCapacity ? parseFloat(actualCapacity) : null,
                    storageNature,
                    variety,
                    origin,
                    grade,
                    roughRiceYield: roughRiceYield ? parseFloat(roughRiceYield) : null,
                    moisture: moisture ? parseFloat(moisture) : null,
                    remark,
                }
            }
        };
    }

    const granary = await prisma.granary.update({
      where: { id: granaryId },
      data: updateData,
      include: {
        config: true,
        info: true,
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

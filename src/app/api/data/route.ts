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
    const granaryId = searchParams.get("granaryId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const limit = parseInt(searchParams.get("limit") || "100");

    if (!granaryId) {
      return NextResponse.json({ error: "仓房ID为必填项" }, { status: 400 });
    }

    const where: any = {
      granaryId: parseInt(granaryId),
    };

    if (startDate && endDate) {
      where.collectedAt = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    const data = await prisma.granaryData.findMany({
      where,
      orderBy: { collectedAt: "desc" },
      take: limit,
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error("Get data error:", error);
    return NextResponse.json(
      { error: "获取数据失败" },
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
    const { granaryId, temperatureValues } = body;

    if (!granaryId) {
      return NextResponse.json({ error: "仓房ID为必填项" }, { status: 400 });
    }

    const data = await prisma.granaryData.create({
      data: {
        granaryId,
        temperatureValues,
      },
    });

    await prisma.granary.update({
      where: { id: granaryId },
      data: {
        lastCollectedAt: new Date(),
        collectionStatus: 1,
      },
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error("Create data error:", error);
    return NextResponse.json(
      { error: "创建数据失败" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

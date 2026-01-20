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
      return NextResponse.json({ error: "无权限审批用户" }, { status: 403 });
    }

    const resolvedParams = await params;
    const body = await request.json();
    const { action } = body;

    const user = await prisma.user.update({
      where: { id: parseInt(resolvedParams.id) },
      data: {
        isApproved: action === "approve",
        isActive: action === "approve",
        approvedBy: parseInt(session.user.id),
        approvedAt: action === "approve" ? new Date() : undefined,
      },
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error("Approve user error:", error);
    return NextResponse.json(
      { error: "审批操作失败" },
      { status: 500 }
    );
  }
}

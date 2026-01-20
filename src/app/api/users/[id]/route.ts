import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

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
    const { username, email, fullName, phone, role, isActive, password } = body;

    const updateData: any = {
      username,
      email: email || null,
      fullName: fullName || null,
      phone: phone || null,
      role,
      isActive,
    };

    if (password) {
      updateData.hashedPassword = await bcrypt.hash(password, 10);
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    // Remove password from response
    const { hashedPassword, ...userWithoutPassword } = user;
    return NextResponse.json(userWithoutPassword);
  } catch (error) {
    console.error("Update user error:", error);
    return NextResponse.json(
      { error: "更新用户失败" },
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
    if (!session || session.user.role !== 1) {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }

    const resolvedParams = await params;
    const userId = parseInt(resolvedParams.id);

    // Prevent deleting self
    if (session.user.id === userId) {
      return NextResponse.json(
        { error: "不能删除自己" },
        { status: 400 }
      );
    }

    await prisma.user.delete({
      where: { id: userId },
    });

    return NextResponse.json({ message: "删除成功" });
  } catch (error) {
    console.error("Delete user error:", error);
    return NextResponse.json(
      { error: "删除用户失败" },
      { status: 500 }
    );
  }
}

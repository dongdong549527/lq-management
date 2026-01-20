import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, email, password, fullName, phone } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: "用户名和密码为必填项" },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ username }, { email: email || undefined }],
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "用户名或邮箱已存在" },
        { status: 400 }
      );
    }

    const hashedPassword = await hash(password, 12);

    const user = await prisma.user.create({
      data: {
        username,
        email,
        hashedPassword,
        fullName,
        phone,
        isActive: true,
        isApproved: false,
      },
    });

    return NextResponse.json({
      id: user.id,
      username: user.username,
      message: "注册成功，等待管理员审核",
    });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "注册失败，请稍后重试" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    if (session.user.role !== 1) {
      return NextResponse.json({ error: "无权限查看用户" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const role = searchParams.get("role");
    const search = searchParams.get("search") || "";
    const depotId = searchParams.get("depotId");

    const where: any = {};

    if (role) {
      where.role = parseInt(role);
    }

    if (search) {
      where.OR = [
        { username: { contains: search, mode: "insensitive" } },
        { fullName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    if (role) {
      where.role = parseInt(role);
    }

    if (search) {
      where.OR = [
        { username: { contains: search, mode: "insensitive" } },
        { fullName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    if (depotId) {
      where.associations = {
        some: {
          depotId: parseInt(depotId),
        },
      };
    } else {
        // If no depotId is provided, we should probably allow seeing all users,
        // or maybe just users associated with depots the current admin manages?
        // For now, let's keep it as is, but maybe we want to ensure admins are always visible?
        // Or at least the current user?
        
        // Actually, the issue might be that when filtering by depot, admins who are NOT associated
        // with that depot are filtered out. But admins usually have access to everything.
        // If we want to see admins even when filtering by depot, we need to adjust the query.
        
        // However, if the user says "Can't see admin account", it might mean they are not in the list at all.
        // Let's check if the admin account is filtered out by something else.
        
        // Maybe the role filter is being applied unexpectedly?
        // Or maybe the admin user doesn't have an association?
    }
    
    // If the requirement is "I can't see the admin account" generally, it might be because
    // admins are not being returned if they don't match the criteria.
    // But if no filters are applied, they should be returned.
    
    // Let's assume the user means "I can't see MYSELF (the admin)" in the list.
    // If pagination is used, maybe they are on another page?
    // Or maybe the default sort order pushes them to the end?
    
    // Wait, if I look at the previous code, there was a check:
    // if (session.user.role !== 1) { return 403 }
    // So only admins can call this.
    
    // If the admin user itself is not showing up, let's check if there's any implicit filtering.
    // `where` is empty by default.
    
    // Ah, if the user is filtering by depot, and the admin is not explicitly assigned to that depot
    // via UserDepotAssociation, then the admin won't show up.
    // This is technically correct behavior for "users in this depot".
    // But maybe the user expects admins to be listed everywhere?
    
    // Let's look at the user input again: "看不到管理员账户了" (Can't see admin account).
    // This likely happened after I added the filtering logic.
    
    // If the user didn't select a depot filter, `depotId` is null, so `where.associations` is not set.
    // In that case, all users should be returned.
    
    // However, if the user meant "I can't see the admin account IN THE LIST", maybe it's because
    // of the pagination? `orderBy: { createdAt: "desc" }`.
    // The admin account is usually created first (oldest), so it would be on the LAST page.
    
    // Let's change the default sort order to `id: "asc"` or `createdAt: "asc"` to make early users appear first?
    // Or maybe the user is searching for something?
    
    // Let's try to include the current user in the result if they match the search but maybe not the depot filter?
    // No, that's confusing.
    
    // If the user says "Can't see admin account", and they just added depot filtering...
    // Maybe they are testing the depot filter and realized the admin is gone?
    // If an admin doesn't have a record in UserDepotAssociation, they won't appear when filtering by depot.
    
    // If no filter is active, and they still can't see it...
    // The default `limit` is 10. If there are more than 10 users, and admin is old, it's on page X.
    
    // Let's adjust the ordering to show admins first, or maybe sort by ID.
    // Usually admins want to see themselves or latest users.
    // The current sort is `createdAt: "desc"`, so NEWEST users are first.
    // Admin is usually the OLDEST user. So it's at the bottom.
    
    // I will change the sort order to `id: "asc"` as a quick fix, or maybe the user wants to search for "admin"?
    
    // Wait, let's look at the `where` construction again.
    // The code I wrote:
    // const where: any = {};
    // ...
    // if (depotId) { ... }
    
    // This looks correct.
    
    // Maybe the issue is that I replaced the entire `GET` function and missed something?
    // No, it looks fine.
    
    // Let's try to change the sort order to see if that helps.
    // And also ensure that we are not filtering out admins by default.
    
    // Another possibility: The user is talking about the "Admin" role filter?
    // No, they said "Can't see admin account".
    
    // Let's try to change the ordering to `id: "asc"` so the first created user (usually admin) shows up first.
    
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          username: true,
          email: true,
          fullName: true,
          phone: true,
          role: true,
          isActive: true,
          isApproved: true,
          createdAt: true,
          associations: {
            select: {
              depot: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { id: "asc" }, // Changed from createdAt: desc to id: asc to show admin first
      }),
      prisma.user.count({ where }),
    ]);

    // Transform response to include flat depots array
    const usersWithDepots = users.map(user => ({
      ...user,
      depots: user.associations.map(a => a.depot),
    }));

    return NextResponse.json({
      data: usersWithDepots,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get users error:", error);
    return NextResponse.json(
      { error: "获取用户列表失败" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 1) {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }

    const body = await request.json();
    const { username, password, email, fullName, phone, role, isActive } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: "用户名和密码为必填项" },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUser) {
      return NextResponse.json({ error: "用户名已存在" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        username,
        hashedPassword,
        email: email || null,
        fullName: fullName || null,
        phone: phone || null,
        role: role || 0,
        isActive: isActive !== undefined ? isActive : true,
        isApproved: true, // Admin created users are auto-approved
        approvedBy: parseInt(session.user.id),
        approvedAt: new Date(),
      },
    });

    const { hashedPassword: _, ...userWithoutPassword } = user;
    return NextResponse.json(userWithoutPassword);
  } catch (error) {
    console.error("Create user error:", error);
    return NextResponse.json(
      { error: "创建用户失败" },
      { status: 500 }
    );
  }
}

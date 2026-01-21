"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import {
  Button,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Pagination,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Tabs,
  Tab,
} from "@heroui/react";
import { Check, X, UserCheck, UserX } from "lucide-react";
import axios from "axios";
import { toast } from "sonner";

interface User {
  id: number;
  username: string;
  email: string | null;
  fullName: string | null;
  phone: string | null;
  isApproved: boolean;
  isActive: boolean;
  createdAt: string;
}

export default function ApprovalsPage() {
  const { data: session, status } = useSession();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [tab, setTab] = useState("pending");

  useEffect(() => {
    if (status === "unauthenticated") {
      redirect("/login");
    }
  }, [status]);

  useEffect(() => {
    fetchUsers();
  }, [page, tab]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await axios.get("/api/users/approvals", {
        params: { page, limit: 10, status: tab },
      });
      setUsers(res.data.data);
      setTotalPages(res.data.pagination.totalPages);
    } catch (error) {
      console.error("Failed to fetch users:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (userId: number, action: "approve" | "reject") => {
    try {
      await axios.put(`/api/users/approvals/${userId}`, { action });
      fetchUsers();
      toast.success(action === "approve" ? "已批准" : "已拒绝");
    } catch (error) {
      toast.error("操作失败");
    }
  };

  if (status === "loading") {
    return <div className="flex justify-center p-8">加载中...</div>;
  }

  if (session?.user?.role !== 1) {
    return (
      <div className="text-center p-8">
        <p>无权限访问此页面</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">用户审批</h1>

      <Card>
        <CardBody>
          <Tabs
            selectedKey={tab}
            onSelectionChange={(key) => {
              setTab(key.toString());
              setPage(1);
            }}
          >
            <Tab key="pending" title="待审批" />
            <Tab key="approved" title="已通过" />
          </Tabs>

          <Table aria-label="用户列表" className="mt-4">
            <TableHeader>
              <TableColumn>用户名</TableColumn>
              <TableColumn>姓名</TableColumn>
              <TableColumn>邮箱</TableColumn>
              <TableColumn>手机号</TableColumn>
              <TableColumn>注册时间</TableColumn>
              <TableColumn>操作</TableColumn>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    加载中...
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    暂无数据
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <p className="font-medium">{user.username}</p>
                    </TableCell>
                    <TableCell>{user.fullName || "-"}</TableCell>
                    <TableCell>{user.email || "-"}</TableCell>
                    <TableCell>{user.phone || "-"}</TableCell>
                    <TableCell>
                      {new Date(user.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {tab === "pending" ? (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            color="success"
                            variant="light"
                            isIconOnly
                            onClick={() => handleAction(user.id, "approve")}
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            color="danger"
                            variant="light"
                            isIconOnly
                            onClick={() => handleAction(user.id, "reject")}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <Chip
                          size="sm"
                          color={user.isActive ? "success" : "default"}
                        >
                          {user.isActive ? "已激活" : "已禁用"}
                        </Chip>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex justify-center mt-4">
              <Pagination
                total={totalPages}
                page={page}
                onChange={setPage}
              />
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

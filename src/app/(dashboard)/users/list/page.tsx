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
  Input,
  Pagination,
  Card,
  CardBody,
  Chip,
  useDisclosure,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Select,
  SelectItem,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  CheckboxGroup,
  Checkbox,
} from "@heroui/react";
import { Plus, Search, MoreVertical, Edit, Trash2 } from "lucide-react";
import axios from "axios";

interface User {
  id: number;
  username: string;
  email: string | null;
  fullName: string | null;
  phone: string | null;
  role: number;
  isActive: boolean;
  isApproved: boolean;
  createdAt: string;
  depots: Depot[]; // Added depots to user interface
}

interface Depot {
  id: number;
  name: string;
}

export default function UsersPage() {
  const { data: session, status } = useSession();
  const [users, setUsers] = useState<User[]>([]);
  const [depots, setDepots] = useState<Depot[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [depotFilter, setDepotFilter] = useState<string>(""); // Added depot filter state
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    fullName: "",
    phone: "",
    role: "0",
    isActive: "false",
    password: "", // Only for new users or password reset
  });
  const [selectedDepots, setSelectedDepots] = useState<string[]>([]);

  useEffect(() => {
    if (status === "unauthenticated") {
      redirect("/login");
    }
  }, [status]);

  useEffect(() => {
    fetchUsers();
    fetchDepots();
  }, [page, search, depotFilter]); // Added depotFilter to dependency array

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: 10 };
      if (search) params.search = search;
      if (depotFilter) params.depotId = depotFilter;

      const res = await axios.get("/api/users", { params });
      setUsers(res.data.data);
      setTotalPages(res.data.pagination.totalPages);
    } catch (error) {
      console.error("Failed to fetch users:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDepots = async () => {
    try {
      const res = await axios.get("/api/depots", { params: { limit: 100 } });
      setDepots(res.data.data || []);
    } catch (error) {
      console.error("Failed to fetch depots:", error);
    }
  };

  const fetchUserAssociations = async (userId: number) => {
    try {
      const res = await axios.get(`/api/users/${userId}/associations`);
      setSelectedDepots(res.data.map((id: number) => id.toString()));
    } catch (error) {
      console.error("Failed to fetch user associations:", error);
      setSelectedDepots([]);
    }
  };

  const handleSubmit = async () => {
    try {
      const data: any = {
        ...formData,
        role: parseInt(formData.role),
        isActive: formData.isActive === "true",
      };

      if (editingUser) {
        if (!data.password) delete data.password; // Don't update password if empty
        await axios.put(`/api/users/${editingUser.id}`, data);
        
        // Update associations only if role is User (0)
        // Or if you want admins to also have assigned depots, remove the check.
        // Assuming associations are relevant for everyone or just users.
        await axios.put(`/api/users/${editingUser.id}/associations`, {
            depotIds: selectedDepots.map(id => parseInt(id))
        });

      } else {
        if (!data.password) {
          alert("密码不能为空");
          return;
        }
        const res = await axios.post("/api/users", data);
        
        // For new user, also assign depots if any selected
        if (res.data && res.data.id && selectedDepots.length > 0) {
            await axios.put(`/api/users/${res.data.id}/associations`, {
                depotIds: selectedDepots.map(id => parseInt(id))
            });
        }
      }
      onClose();
      setEditingUser(null);
      resetForm();
      fetchUsers();
    } catch (error: any) {
      alert(error.response?.data?.error || "操作失败");
    }
  };

  const handleEdit = async (user: User) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      email: user.email || "",
      fullName: user.fullName || "",
      phone: user.phone || "",
      role: user.role.toString(),
      isActive: user.isActive.toString(),
      password: "",
    });
    await fetchUserAssociations(user.id);
    onOpen();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("确定要删除此用户吗？")) return;
    try {
      await axios.delete(`/api/users/${id}`);
      fetchUsers();
    } catch (error) {
      alert("删除失败");
    }
  };

  const resetForm = () => {
    setFormData({
      username: "",
      email: "",
      fullName: "",
      phone: "",
      role: "0",
      isActive: "true",
      password: "",
    });
    setSelectedDepots([]);
  };

  const handleOpenModal = () => {
    setEditingUser(null);
    resetForm();
    onOpen();
  };

  if (status === "loading") {
    return <div className="flex justify-center p-8">加载中...</div>;
  }

  if (session?.user?.role !== 1) {
    return <div className="text-center p-8">无权限访问此页面</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">用户管理</h1>
        <Button color="primary" onClick={handleOpenModal}>
          <Plus className="w-4 h-4 mr-2" />
          添加用户
        </Button>
      </div>

      <Card>
        <CardBody>
          <div className="flex gap-4 mb-4">
            <Input
              placeholder="搜索用户..."
              value={search}
              onValueChange={setSearch}
              startContent={<Search className="w-4 h-4 text-gray-400" />}
              className="max-w-xs"
            />
            <Select
              label="粮库筛选"
              placeholder="全部"
              className="max-w-xs"
              value={depotFilter}
              onChange={(e) => setDepotFilter(e.target.value)}
            >
              {depots.map((depot) => (
                <SelectItem key={depot.id.toString()} value={depot.id.toString()}>
                  {depot.name}
                </SelectItem>
              ))}
            </Select>
          </div>

          <Table aria-label="用户列表">
            <TableHeader>
              <TableColumn>用户名</TableColumn>
              <TableColumn>姓名</TableColumn>
              <TableColumn>角色</TableColumn>
              <TableColumn>状态</TableColumn>
              <TableColumn>联系方式</TableColumn>
              <TableColumn>关联粮库</TableColumn>
              <TableColumn>创建时间</TableColumn>
              <TableColumn>操作</TableColumn>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    加载中...
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    暂无数据
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <p className="font-medium">{user.username}</p>
                      <p className="text-tiny text-gray-500">{user.email}</p>
                    </TableCell>
                    <TableCell>{user.fullName || "-"}</TableCell>
                    <TableCell>
                      <Chip
                        size="sm"
                        color={user.role === 1 ? "secondary" : "default"}
                        variant="flat"
                      >
                        {user.role === 1 ? "管理员" : "普通用户"}
                      </Chip>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="sm"
                        color={!user.isApproved ? "warning" : user.isActive ? "success" : "danger"}
                        variant="dot"
                      >
                        {!user.isApproved ? "待审批" : user.isActive ? "启用" : "禁用"}
                      </Chip>
                    </TableCell>
                    <TableCell>{user.phone || "-"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.depots && user.depots.length > 0 ? (
                          user.depots.map((depot) => (
                            <Chip key={depot.id} size="sm" variant="flat">
                              {depot.name}
                            </Chip>
                          ))
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(user.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Dropdown>
                        <DropdownTrigger>
                          <Button isIconOnly size="sm" variant="light">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownTrigger>
                        <DropdownMenu aria-label="操作">
                          <DropdownItem
                            key="edit"
                            startContent={<Edit className="w-4 h-4" />}
                            onClick={() => handleEdit(user)}
                          >
                            编辑
                          </DropdownItem>
                          <DropdownItem
                            key="delete"
                            color="danger"
                            startContent={<Trash2 className="w-4 h-4" />}
                            onClick={() => handleDelete(user.id)}
                          >
                            删除
                          </DropdownItem>
                        </DropdownMenu>
                      </Dropdown>
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

      <Modal isOpen={isOpen} onClose={onClose} size="2xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>
            {editingUser ? "编辑用户" : "添加用户"}
          </ModalHeader>
          <ModalBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">基本信息</h3>
                <Input
                  label="用户名"
                  placeholder="请输入用户名"
                  value={formData.username}
                  onValueChange={(v) => setFormData({ ...formData, username: v })}
                  isDisabled={!!editingUser}
                />
                <Input
                  label="密码"
                  type="password"
                  placeholder={editingUser ? "留空则不修改密码" : "请输入密码"}
                  value={formData.password}
                  onValueChange={(v) => setFormData({ ...formData, password: v })}
                />
                <Input
                  label="姓名"
                  placeholder="请输入姓名"
                  value={formData.fullName}
                  onValueChange={(v) => setFormData({ ...formData, fullName: v })}
                />
                <Input
                  label="手机号"
                  placeholder="请输入手机号"
                  value={formData.phone}
                  onValueChange={(v) => setFormData({ ...formData, phone: v })}
                />
                <Input
                  label="邮箱"
                  type="email"
                  placeholder="请输入邮箱"
                  value={formData.email}
                  onValueChange={(v) => setFormData({ ...formData, email: v })}
                />
                <div className="grid grid-cols-2 gap-4">
                  <Select
                    label="角色"
                    selectedKeys={[formData.role]}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  >
                    <SelectItem key="0" value="0">普通用户</SelectItem>
                    <SelectItem key="1" value="1">管理员</SelectItem>
                  </Select>
                  <Select
                    label="状态"
                    selectedKeys={[formData.isActive]}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.value })}
                  >
                    <SelectItem key="true" value="true">启用</SelectItem>
                    <SelectItem key="false" value="false">禁用</SelectItem>
                  </Select>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">粮库权限分配</h3>
                <div className="border rounded-lg p-4 h-[400px] overflow-y-auto">
                    {depots.length === 0 ? (
                        <p className="text-gray-500 text-center">暂无粮库数据</p>
                    ) : (
                        <CheckboxGroup
                            value={selectedDepots}
                            onValueChange={setSelectedDepots}
                        >
                            {depots.map((depot) => (
                                <Checkbox key={depot.id} value={depot.id.toString()}>
                                    {depot.name}
                                </Checkbox>
                            ))}
                        </CheckboxGroup>
                    )}
                </div>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onClick={onClose}>
              取消
            </Button>
            <Button color="primary" onClick={handleSubmit}>
              确定
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

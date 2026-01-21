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
  CardHeader,
  Chip,
  useDisclosure,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Form,
  Select,
  SelectItem,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@heroui/react";
import { Plus, Search, MoreVertical, Edit, Trash2, Eye } from "lucide-react";
import axios from "axios";

interface Depot {
  id: number;
  name: string;
  address: string | null;
  contactPerson: string | null;
  phone: string | null;
  province: string | null;
  granaries: { id: number; name: string }[];
  createdAt: string;
}

export default function DepotsPage() {
  const { data: session, status } = useSession();
  const [depots, setDepots] = useState<Depot[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [editingDepot, setEditingDepot] = useState<Depot | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    contactPerson: "",
    phone: "",
    province: "",
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      redirect("/login");
    }
  }, [status]);

  useEffect(() => {
    fetchDepots();
  }, [page, search]);

  const fetchDepots = async () => {
    setLoading(true);
    try {
      const res = await axios.get("/api/depots", {
        params: { page, limit: 10, search },
      });
      setDepots(res.data.data);
      setTotalPages(res.data.pagination.totalPages);
      setTotal(res.data.pagination.total);
    } catch (error) {
      console.error("Failed to fetch depots:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      if (editingDepot) {
        await axios.put(`/api/depots/${editingDepot.id}`, formData);
      } else {
        await axios.post("/api/depots", formData);
      }
      onClose();
      setEditingDepot(null);
      resetForm();
      fetchDepots();
    } catch (error: any) {
      alert(error.response?.data?.error || "操作失败");
    }
  };

  const handleEdit = (depot: Depot) => {
    setEditingDepot(depot);
    setFormData({
      name: depot.name,
      address: depot.address || "",
      contactPerson: depot.contactPerson || "",
      phone: depot.phone || "",
      province: depot.province || "",
    });
    onOpen();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("确定要删除此粮库吗？")) return;
    try {
      await axios.delete(`/api/depots/${id}`);
      fetchDepots();
    } catch (error) {
      alert("删除失败");
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      address: "",
      contactPerson: "",
      phone: "",
      province: "",
    });
  };

  const handleOpenModal = () => {
    setEditingDepot(null);
    resetForm();
    onOpen();
  };

  if (status === "loading") {
    return <div className="flex justify-center p-8">加载中...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">粮库管理</h1>
        {session?.user?.role === 1 && (
          <Button color="primary" onClick={handleOpenModal}>
            <Plus className="w-4 h-4 mr-2" />
            添加粮库
          </Button>
        )}
      </div>

      <Card>
        <CardBody>
          <div className="flex gap-4 mb-4">
            <Input
              placeholder="搜索粮库名称..."
              value={search}
              onValueChange={setSearch}
              startContent={<Search className="w-4 h-4 text-gray-400" />}
              className="max-w-xs"
            />
          </div>

          <Table aria-label="粮库列表">
            <TableHeader>
              <TableColumn>名称</TableColumn>
              <TableColumn>地址</TableColumn>
              <TableColumn>联系人</TableColumn>
              <TableColumn>联系电话</TableColumn>
              <TableColumn>仓房数量</TableColumn>
              <TableColumn>操作</TableColumn>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    加载中...
                  </TableCell>
                </TableRow>
              ) : depots.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    暂无数据
                  </TableCell>
                </TableRow>
              ) : (
                depots.map((depot) => (
                  <TableRow key={depot.id}>
                    <TableCell>
                      <p className="font-medium">{depot.name}</p>
                    </TableCell>
                    <TableCell>{depot.address || "-"}</TableCell>
                    <TableCell>{depot.contactPerson || "-"}</TableCell>
                    <TableCell>{depot.phone || "-"}</TableCell>
                    <TableCell>
                      <Chip size="sm" color="primary">
                        {depot.granaries?.length || 0}
                      </Chip>
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
                            key="view"
                            startContent={<Eye className="w-4 h-4" />}
                            href={`/depots/${depot.id}`}
                          >
                            查看详情
                          </DropdownItem>
                          {session?.user?.role === 1 ? (
                            <DropdownItem
                              key="edit"
                              startContent={<Edit className="w-4 h-4" />}
                              onClick={() => handleEdit(depot)}
                            >
                              编辑
                            </DropdownItem>
                          ) : null}
                          {session?.user?.role === 1 ? (
                            <DropdownItem
                              key="delete"
                              color="danger"
                              startContent={<Trash2 className="w-4 h-4" />}
                              onClick={() => handleDelete(depot.id)}
                            >
                              删除
                            </DropdownItem>
                          ) : null}
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

      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <ModalContent>
          <ModalHeader>
            {editingDepot ? "编辑粮库" : "添加粮库"}
          </ModalHeader>
          <ModalBody>
            <Form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
              <div className="space-y-4">
                <Input
                  label="粮库名称"
                  placeholder="请输入粮库名称"
                  value={formData.name}
                  onValueChange={(v) => setFormData({ ...formData, name: v })}
                  isRequired
                />
                <Input
                  label="地址"
                  placeholder="请输入地址"
                  value={formData.address}
                  onValueChange={(v) =>
                    setFormData({ ...formData, address: v })
                  }
                />
                <Input
                  label="联系人"
                  placeholder="请输入联系人"
                  value={formData.contactPerson}
                  onValueChange={(v) =>
                    setFormData({ ...formData, contactPerson: v })
                  }
                />
                <Input
                  label="联系电话"
                  placeholder="请输入联系电话"
                  value={formData.phone}
                  onValueChange={(v) => setFormData({ ...formData, phone: v })}
                />
                <Input
                  label="省份"
                  placeholder="请输入省份"
                  value={formData.province}
                  onValueChange={(v) =>
                    setFormData({ ...formData, province: v })
                  }
                />
              </div>
            </Form>
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

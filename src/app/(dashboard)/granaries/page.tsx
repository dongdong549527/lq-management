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
} from "@heroui/react";
import { Plus, Search, MoreVertical, Edit, Trash2, BarChart2, Settings, Play } from "lucide-react";
import axios from "axios";
import { collectFromSerial, collectFromMqtt } from "@/lib/collection";

interface Granary {
  id: number;
  name: string;
  depotId: number;
  collectionStatus: number;
  lastCollectedAt: string | null;
  depot: { id: number; name: string };
  config: GranaryConfig | null;
  info: any;
}

interface GranaryConfig {
  id?: number;
  extensionNumber?: number;
  tempCollectorCount?: number;
  thCollectorCount?: number;
  startIndex?: number;
  endIndex?: number;
  thIndex?: number;
  cableCount?: number;
  cablePointCount?: number;
  totalCollectorCount?: number;
  mqttTopicSub?: string;
  mqttTopicPub?: string;
  collectionDevice?: number;
  serialPort?: string;
}

interface Depot {
  id: number;
  name: string;
}

export default function GranariesPage() {
  const { data: session, status } = useSession();
  const [granaries, setGranaries] = useState<Granary[]>([]);
  const [depots, setDepots] = useState<Depot[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [depotFilter, setDepotFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // Basic Info Modal
  const { isOpen: isEditOpen, onOpen: onEditOpen, onClose: onEditClose } = useDisclosure();
  const [editingGranary, setEditingGranary] = useState<Granary | null>(null);
  const [formData, setFormData] = useState({
    depotId: "",
    name: "",
    manager: "",
    designCapacity: "",
    actualCapacity: "",
    storageNature: "",
    variety: "",
    origin: "",
    grade: "",
    roughRiceYield: "",
    moisture: "",
    remark: "",
  });

  // Config Modal
  const { isOpen: isConfigOpen, onOpen: onConfigOpen, onClose: onConfigClose } = useDisclosure();
  const [configuringGranary, setConfiguringGranary] = useState<Granary | null>(null);
  const [configData, setConfigData] = useState<GranaryConfig>({});
  const [collectingId, setCollectingId] = useState<number | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      redirect("/login");
    }
  }, [status]);

  useEffect(() => {
    fetchDepots();
  }, []);

  useEffect(() => {
    fetchGranaries();
  }, [page, search, depotFilter]);

  const fetchDepots = async () => {
    try {
      const res = await axios.get("/api/depots", { params: { limit: 100 } });
      setDepots(res.data.data || []);
    } catch (error) {
      console.error("Failed to fetch depots:", error);
    }
  };

  const fetchGranaries = async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: 10 };
      if (search) params.search = search;
      if (depotFilter) params.depotId = depotFilter;
      const res = await axios.get("/api/granaries", { params });
      setGranaries(res.data.data);
      setTotalPages(res.data.pagination.totalPages);
    } catch (error) {
      console.error("Failed to fetch granaries:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.depotId || !formData.name) {
      alert("请填写完整信息");
      return;
    }
    try {
      if (editingGranary) {
        await axios.put(`/api/granaries/${editingGranary.id}`, formData);
      } else {
        await axios.post("/api/granaries", formData);
      }
      onEditClose();
      setEditingGranary(null);
      resetForm();
      fetchGranaries();
    } catch (error: any) {
      alert(error.response?.data?.error || "操作失败");
    }
  };

  const handleConfigSubmit = async () => {
    if (!configuringGranary) return;
    try {
      await axios.put(`/api/granaries/${configuringGranary.id}`, {
        name: configuringGranary.name, // Keep existing name
        depotId: configuringGranary.depotId, // Keep existing depot
        config: configData,
      });
      onConfigClose();
      setConfiguringGranary(null);
      fetchGranaries();
      alert("配置更新成功");
    } catch (error: any) {
      alert(error.response?.data?.error || "配置更新失败");
    }
  };

  const handleEdit = (granary: Granary) => {
    setEditingGranary(granary);
    setFormData({
      depotId: granary.depotId.toString(),
      name: granary.name,
      manager: granary.info?.manager || "",
      designCapacity: granary.info?.designCapacity?.toString() || "",
      actualCapacity: granary.info?.actualCapacity?.toString() || "",
      storageNature: granary.info?.storageNature || "",
      variety: granary.info?.variety || "",
      origin: granary.info?.origin || "",
      grade: granary.info?.grade || "",
      roughRiceYield: granary.info?.roughRiceYield?.toString() || "",
      moisture: granary.info?.moisture?.toString() || "",
      remark: granary.info?.remark || "",
    });
    onEditOpen();
  };

  const handleConfig = (granary: Granary) => {
    setConfiguringGranary(granary);
    setConfigData(granary.config || {});
    onConfigOpen();
  };

  const handleCollect = async (granary: Granary) => {
    if (!granary.config || !granary.config.collectionDevice) {
      alert("请先配置采集设备参数");
      return;
    }

    setCollectingId(granary.id);
    try {
      let data;
      if (granary.config.collectionDevice === 1) {
        // Serial
        // Pass extension number (default to 1 if not set)
        const ext = granary.config.extensionNumber || 1;
        // Default totalCollectorCount to 1 if not set
        const totalCount = granary.config.totalCollectorCount || 1;
        data = await collectFromSerial(ext, totalCount);
      } else if (granary.config.collectionDevice === 2 || granary.config.collectionDevice === 3) {
        // MQTT
        data = await collectFromMqtt({
          ...granary.config,
          collectionDevice: granary.config.collectionDevice,
        });
      } else {
        alert("未知的设备类型");
        return;
      }

      // Save data
      await axios.post("/api/data", {
        granaryId: granary.id,
        temperatureValues: data.temperatureValues,
        humidityValues: data.humidityValues,
        sequenceNumber: 1,
      });

      alert("采集成功！");
      fetchGranaries();
    } catch (error: any) {
      console.error(error);
      alert(error.message || "采集失败");
    } finally {
      setCollectingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("确定要删除此仓房吗？")) return;
    try {
      await axios.delete(`/api/granaries/${id}`);
      fetchGranaries();
    } catch (error) {
      alert("删除失败");
    }
  };

  const resetForm = () => {
    setFormData({
      depotId: "",
      name: "",
      manager: "",
      designCapacity: "",
      actualCapacity: "",
      storageNature: "",
      variety: "",
      origin: "",
      grade: "",
      roughRiceYield: "",
      moisture: "",
      remark: "",
    });
  };

  const handleOpenModal = () => {
    setEditingGranary(null);
    resetForm();
    onEditOpen();
  };

  if (status === "loading") {
    return <div className="flex justify-center p-8">加载中...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">仓房管理</h1>
        {session?.user?.role === 1 && (
          <Button color="primary" onClick={handleOpenModal}>
            <Plus className="w-4 h-4 mr-2" />
            添加仓房
          </Button>
        )}
      </div>

      <Card>
        <CardBody>
          <div className="flex gap-4 mb-4">
            <Input
              placeholder="搜索仓房名称..."
              value={search}
              onValueChange={setSearch}
              startContent={<Search className="w-4 h-4 text-gray-400" />}
              className="max-w-xs"
            />
            <Select
              label="粮库筛选"
              placeholder="全部"
              value={depotFilter}
              onChange={(e) => setDepotFilter(e.target.value)}
              className="max-w-xs"
            >
              {depots.map((depot) => (
                <SelectItem key={depot.id.toString()} value={depot.id.toString()}>
                  {depot.name}
                </SelectItem>
              ))}
            </Select>
          </div>

          <Table aria-label="仓房列表">
            <TableHeader>
              <TableColumn>名称</TableColumn>
              <TableColumn>所属粮库</TableColumn>
              <TableColumn>采集状态</TableColumn>
              <TableColumn>最后采集时间</TableColumn>
              <TableColumn>操作</TableColumn>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    加载中...
                  </TableCell>
                </TableRow>
              ) : granaries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    暂无数据
                  </TableCell>
                </TableRow>
              ) : (
                granaries.map((granary) => (
                  <TableRow key={granary.id}>
                    <TableCell>
                      <p className="font-medium">{granary.name}</p>
                    </TableCell>
                    <TableCell>{granary.depot.name}</TableCell>
                    <TableCell>
                      <Chip
                        size="sm"
                        color={granary.collectionStatus === 1 ? "success" : "warning"}
                      >
                        {granary.collectionStatus === 1 ? "已采集" : "待采集"}
                      </Chip>
                    </TableCell>
                    <TableCell>
                      {granary.lastCollectedAt
                        ? new Date(granary.lastCollectedAt).toLocaleString()
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          isIconOnly
                          size="sm"
                          variant="light"
                          color="primary"
                          title="开始采集"
                          isLoading={collectingId === granary.id}
                          onClick={() => handleCollect(granary)}
                        >
                          {!collectingId && <Play className="w-4 h-4" />}
                        </Button>
                        <Button
                          isIconOnly
                          size="sm"
                          variant="light"
                          as="a"
                          href={`/granaries/${granary.id}`}
                        >
                          <BarChart2 className="w-4 h-4" />
                        </Button>
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
                              onClick={() => handleEdit(granary)}
                            >
                              编辑信息
                            </DropdownItem>
                            {session?.user?.role === 1 && (
                              <DropdownItem
                                key="config"
                                startContent={<Settings className="w-4 h-4" />}
                                onClick={() => handleConfig(granary)}
                              >
                                参数配置
                              </DropdownItem>
                            )}
                            <DropdownItem
                              key="delete"
                              color="danger"
                              startContent={<Trash2 className="w-4 h-4" />}
                              onClick={() => handleDelete(granary.id)}
                            >
                              删除
                            </DropdownItem>
                          </DropdownMenu>
                        </Dropdown>
                      </div>
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

      {/* Edit Granary Modal */}
      <Modal isOpen={isEditOpen} onClose={onEditClose}>
        <ModalContent>
          <ModalHeader>
            {editingGranary ? "编辑仓房" : "添加仓房"}
          </ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="所属粮库"
                  placeholder="请选择粮库"
                  selectedKeys={formData.depotId ? [formData.depotId] : []}
                  onChange={(e) =>
                    setFormData({ ...formData, depotId: e.target.value })
                  }
                  isDisabled={!!editingGranary && session?.user?.role !== 1}
                >
                  {depots.map((depot) => (
                    <SelectItem key={depot.id.toString()} value={depot.id.toString()}>
                      {depot.name}
                    </SelectItem>
                  ))}
                </Select>
                <Input
                  label="仓房名称"
                  placeholder="请输入仓房名称"
                  value={formData.name}
                  onValueChange={(v) => setFormData({ ...formData, name: v })}
                />
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold text-gray-700 mb-4">基本信息</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="保管员"
                    placeholder="请输入保管员姓名"
                    value={formData.manager}
                    onValueChange={(v) => setFormData({ ...formData, manager: v })}
                  />
                  <Input
                    label="储粮性质"
                    placeholder="如：中央储备粮"
                    value={formData.storageNature}
                    onValueChange={(v) => setFormData({ ...formData, storageNature: v })}
                  />
                  <Input
                    label="设计仓容(吨)"
                    type="number"
                    value={formData.designCapacity}
                    onValueChange={(v) => setFormData({ ...formData, designCapacity: v })}
                  />
                  <Input
                    label="实际储量(吨)"
                    type="number"
                    value={formData.actualCapacity}
                    onValueChange={(v) => setFormData({ ...formData, actualCapacity: v })}
                  />
                  <Input
                    label="品种"
                    placeholder="如：小麦"
                    value={formData.variety}
                    onValueChange={(v) => setFormData({ ...formData, variety: v })}
                  />
                  <Input
                    label="产地"
                    placeholder="如：河南"
                    value={formData.origin}
                    onValueChange={(v) => setFormData({ ...formData, origin: v })}
                  />
                  <Input
                    label="等级"
                    placeholder="如：一等"
                    value={formData.grade}
                    onValueChange={(v) => setFormData({ ...formData, grade: v })}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      label="出糙率(%)"
                      type="number"
                      value={formData.roughRiceYield}
                      onValueChange={(v) => setFormData({ ...formData, roughRiceYield: v })}
                    />
                    <Input
                      label="水分(%)"
                      type="number"
                      value={formData.moisture}
                      onValueChange={(v) => setFormData({ ...formData, moisture: v })}
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <Input
                    label="备注"
                    value={formData.remark}
                    onValueChange={(v) => setFormData({ ...formData, remark: v })}
                  />
                </div>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onClick={onEditClose}>
              取消
            </Button>
            <Button color="primary" onClick={handleSubmit}>
              确定
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Granary Configuration Modal */}
      <Modal isOpen={isConfigOpen} onClose={onConfigClose} size="2xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>
            仓房配置 - {configuringGranary?.name}
          </ModalHeader>
          <ModalBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-700">MQTT 配置</h3>
                <Input
                  label="订阅主题 (Sub)"
                  placeholder="请输入MQTT订阅主题"
                  value={configData.mqttTopicSub || ""}
                  onValueChange={(v) => setConfigData({ ...configData, mqttTopicSub: v })}
                />
                <Input
                  label="发布主题 (Pub)"
                  placeholder="请输入MQTT发布主题"
                  value={configData.mqttTopicPub || ""}
                  onValueChange={(v) => setConfigData({ ...configData, mqttTopicPub: v })}
                />
                
                <h3 className="font-semibold text-gray-700 mt-6">设备参数</h3>
                <Input
                  label="分机号"
                  type="number"
                  placeholder="请输入分机号"
                  value={configData.extensionNumber?.toString() || ""}
                  onValueChange={(v) => setConfigData({ ...configData, extensionNumber: v ? parseInt(v) : undefined })}
                />
                <Select
                  label="采集设备类型"
                  placeholder="请选择设备类型"
                  selectedKeys={configData.collectionDevice ? [configData.collectionDevice.toString()] : []}
                  onChange={(e) => setConfigData({ ...configData, collectionDevice: e.target.value ? parseInt(e.target.value) : undefined })}
                >
                  <SelectItem key="1" value="1">串口主机</SelectItem>
                  <SelectItem key="2" value="2">网络主机</SelectItem>
                  <SelectItem key="3" value="3">网络分机</SelectItem>
                </Select>
                {configData.collectionDevice === 1 && (
                  <Input
                    label="串口号"
                    placeholder="例如: COM1"
                    value={configData.serialPort || ""}
                    onValueChange={(v) => setConfigData({ ...configData, serialPort: v })}
                  />
                )}
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-gray-700">传感器配置</h3>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    label="电缆数量"
                    type="number"
                    value={configData.cableCount?.toString() || ""}
                    onValueChange={(v) => setConfigData({ ...configData, cableCount: v ? parseInt(v) : undefined })}
                  />
                  <Input
                    label="单缆点数"
                    type="number"
                    value={configData.cablePointCount?.toString() || ""}
                    onValueChange={(v) => setConfigData({ ...configData, cablePointCount: v ? parseInt(v) : undefined })}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    label="温度采集器数"
                    type="number"
                    value={configData.tempCollectorCount?.toString() || ""}
                    onValueChange={(v) => setConfigData({ ...configData, tempCollectorCount: v ? parseInt(v) : undefined })}
                  />
                  <Input
                    label="温湿采集器数"
                    type="number"
                    value={configData.thCollectorCount?.toString() || ""}
                    onValueChange={(v) => setConfigData({ ...configData, thCollectorCount: v ? parseInt(v) : undefined })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Input
                    label="总采集器数"
                    type="number"
                    value={configData.totalCollectorCount?.toString() || ""}
                    onValueChange={(v) => setConfigData({ ...configData, totalCollectorCount: v ? parseInt(v) : undefined })}
                  />
                  <Input
                    label="温湿索引"
                    type="number"
                    value={configData.thIndex?.toString() || ""}
                    onValueChange={(v) => setConfigData({ ...configData, thIndex: v ? parseInt(v) : undefined })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Input
                    label="起始索引"
                    type="number"
                    value={configData.startIndex?.toString() || ""}
                    onValueChange={(v) => setConfigData({ ...configData, startIndex: v ? parseInt(v) : undefined })}
                  />
                  <Input
                    label="结束索引"
                    type="number"
                    value={configData.endIndex?.toString() || ""}
                    onValueChange={(v) => setConfigData({ ...configData, endIndex: v ? parseInt(v) : undefined })}
                  />
                </div>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onClick={onConfigClose}>
              取消
            </Button>
            <Button color="primary" onClick={handleConfigSubmit}>
              保存配置
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

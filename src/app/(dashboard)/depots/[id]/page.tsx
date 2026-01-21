"use client";

import { useEffect, useState, use } from "react";
import { useSession } from "next-auth/react";
import { redirect, useRouter } from "next/navigation";
import axios from "axios";
import {
  Card,
  CardBody,
  CardHeader,
  Divider,
  Button,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Spinner,
} from "@heroui/react";
import { ArrowLeft, Building2, MapPin, Phone, User, Warehouse } from "lucide-react";

interface Granary {
  id: number;
  name: string;
  collectionStatus: number;
  lastCollectedAt: string | null;
}

interface Depot {
  id: number;
  name: string;
  address: string | null;
  contactPerson: string | null;
  phone: string | null;
  province: string | null;
  granaries: Granary[];
  createdAt: string;
}

export default function DepotDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { status } = useSession();
  const router = useRouter();
  const [depot, setDepot] = useState<Depot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Use React.use() to unwrap params
  const resolvedParams = use(params);
  const depotId = resolvedParams.id;

  useEffect(() => {
    if (status === "unauthenticated") {
      redirect("/login");
    }
  }, [status]);

  useEffect(() => {
    if (depotId) {
      fetchDepotDetails();
    }
  }, [depotId]);

  const fetchDepotDetails = async () => {
    try {
      const res = await axios.get(`/api/depots/${depotId}`);
      setDepot(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || "获取粮库详情失败");
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Spinner size="lg" label="加载中..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <p className="text-danger text-lg">{error}</p>
        <Button onClick={() => router.back()} startContent={<ArrowLeft className="w-4 h-4" />}>
          返回列表
        </Button>
      </div>
    );
  }

  if (!depot) return null;

  return (
    <div className="space-y-6">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4">
        <Button 
          variant="light" 
          isIconOnly 
          onClick={() => router.back()}
          aria-label="返回"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-2xl font-bold">粮库详情</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Depot Info Card */}
        <Card className="md:col-span-1 h-fit">
          <CardHeader className="flex gap-3 bg-gray-50 border-b">
            <Building2 className="w-6 h-6 text-primary" />
            <div className="flex flex-col">
              <p className="text-md font-bold">{depot.name}</p>
              <p className="text-small text-default-500">基本信息</p>
            </div>
          </CardHeader>
          <Divider />
          <CardBody className="space-y-4">
            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-gray-400 mt-1" />
              <div>
                <p className="text-small text-gray-500">地址</p>
                <p className="text-sm">{depot.address || "未填写"}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <User className="w-4 h-4 text-gray-400 mt-1" />
              <div>
                <p className="text-small text-gray-500">联系人</p>
                <p className="text-sm">{depot.contactPerson || "未填写"}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Phone className="w-4 h-4 text-gray-400 mt-1" />
              <div>
                <p className="text-small text-gray-500">联系电话</p>
                <p className="text-sm">{depot.phone || "未填写"}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Building2 className="w-4 h-4 text-gray-400 mt-1" />
              <div>
                <p className="text-small text-gray-500">省份</p>
                <p className="text-sm">{depot.province || "未填写"}</p>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Granaries List Card */}
        <Card className="md:col-span-2">
          <CardHeader className="flex gap-3 bg-gray-50 border-b">
            <Warehouse className="w-6 h-6 text-primary" />
            <div className="flex flex-col">
              <p className="text-md font-bold">下属仓房</p>
              <p className="text-small text-default-500">共 {depot.granaries.length} 个仓房</p>
            </div>
          </CardHeader>
          <Divider />
          <CardBody>
            <Table aria-label="Granaries list" shadow="none">
              <TableHeader>
                <TableColumn>仓房名称</TableColumn>
                <TableColumn>采集状态</TableColumn>
                <TableColumn>最后采集时间</TableColumn>
                <TableColumn>操作</TableColumn>
              </TableHeader>
              <TableBody>
                {depot.granaries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-gray-400">
                      该粮库暂无仓房
                    </TableCell>
                  </TableRow>
                ) : (
                  depot.granaries.map((granary) => (
                    <TableRow key={granary.id}>
                      <TableCell>
                        <span className="font-medium">{granary.name}</span>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="sm"
                          color={granary.collectionStatus === 1 ? "success" : "warning"}
                          variant="flat"
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
                        <Button
                          size="sm"
                          variant="light"
                          color="primary"
                          as="a"
                          href={`/granaries/${granary.id}`}
                        >
                          查看详情
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

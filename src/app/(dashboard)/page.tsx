"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import {
  Card,
  CardBody,
  CardHeader,
  Spinner,
} from "@heroui/react";
import {
  Building2,
  Thermometer,
  AlertTriangle,
} from "lucide-react";
import axios from "axios";

interface Stats {
  depotCount: number;
  granaryCount: number;
  normalCount: number;
  warningCount: number;
}

interface Granary {
  id: number;
  name: string;
  collectionStatus: number;
  lastCollectedAt: string | null;
  depot: {
    name: string;
  };
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const [stats, setStats] = useState<Stats>({ depotCount: 0, granaryCount: 0, normalCount: 0, warningCount: 0 });
  const [granaries, setGranaries] = useState<Granary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      redirect("/login");
    }
  }, [status]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [depotsRes, granariesRes] = await Promise.all([
          axios.get("/api/depots", { params: { limit: 1 } }),
          axios.get("/api/granaries", { params: { limit: 10 } }),
        ]);

        const depots = depotsRes.data.pagination?.total || 0;
        const granariesData = granariesRes.data.data || [];
        const warningCount = granariesData.filter(
          (g: Granary) => g.collectionStatus === 0
        ).length;

        setStats({
          depotCount: depots,
          granaryCount: granariesRes.data.pagination?.total || 0,
          normalCount: granariesData.length - warningCount,
          warningCount,
        });
        setGranaries(granariesData);
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    if (session) {
      fetchData();
    }
  }, [session]);

  if (status === "loading" || loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  const statCards = [
    {
      title: "粮库总数",
      value: stats.depotCount,
      icon: Building2,
      color: "text-blue-500",
      bgColor: "bg-blue-100",
    },
    {
      title: "仓房总数",
      value: stats.granaryCount,
      icon: Building2,
      color: "text-green-500",
      bgColor: "bg-green-100",
    },
    {
      title: "正常采集",
      value: stats.normalCount,
      icon: Thermometer,
      color: "text-emerald-500",
      bgColor: "bg-emerald-100",
    },
    {
      title: "待采集",
      value: stats.warningCount,
      icon: AlertTriangle,
      color: "text-orange-500",
      bgColor: "bg-orange-100",
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">仪表盘</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => (
          <Card key={index}>
            <CardBody className="flex flex-row items-center gap-4">
              <div className={`p-3 rounded-full ${stat.bgColor}`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
              <div>
                <p className="text-sm text-gray-500">{stat.title}</p>
                <p className="text-2xl font-bold">{stat.value}</p>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">最近仓房状态</h3>
        </CardHeader>
        <CardBody>
          <div className="space-y-3">
            {granaries.length === 0 ? (
              <p className="text-gray-500">暂无数据</p>
            ) : (
              granaries.map((granary) => (
                <div
                  key={granary.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        granary.collectionStatus === 1
                          ? "bg-green-500"
                          : "bg-orange-500"
                      }`}
                    />
                    <div>
                      <p className="font-medium">{granary.name}</p>
                      <p className="text-sm text-gray-500">
                        {granary.depot.name}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-sm ${
                        granary.collectionStatus === 1
                          ? "text-green-500"
                          : "text-orange-500"
                      }`}
                    >
                      {granary.collectionStatus === 1 ? "已采集" : "待采集"}
                    </p>
                    {granary.lastCollectedAt && (
                      <p className="text-xs text-gray-400">
                        {new Date(granary.lastCollectedAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

"use client";

import { useEffect, useState, use } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Chip,
  Select,
  SelectItem,
  Spinner,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from "@heroui/react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { ArrowLeft, RefreshCw } from "lucide-react";
import axios from "axios";

interface Granary {
  id: number;
  name: string;
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
}

interface DataPoint {
  id: number;
  collectedAt: string;
  sequenceNumber: number | null;
  temperatureValues: number[];
  humidityValues: number | null;
}

interface ChartData {
  time: string;
  avgTemp: number;
  maxTemp: number;
  minTemp: number;
  humidity: number;
}

export default function GranaryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { data: session, status } = useSession();
  const [granary, setGranary] = useState<Granary | null>(null);
  const [data, setData] = useState<DataPoint[]>([]);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState("7");

  useEffect(() => {
    if (status === "unauthenticated") {
      redirect("/login");
    }
  }, [status]);

  useEffect(() => {
    fetchGranary();
    fetchData();
  }, [resolvedParams.id, dateRange]);

  const fetchGranary = async () => {
    try {
      const res = await axios.get(`/api/granaries/${resolvedParams.id}`);
      setGranary(res.data);
    } catch (error) {
      console.error("Failed to fetch granary:", error);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(dateRange));

      const res = await axios.get("/api/data", {
        params: {
          granaryId: resolvedParams.id,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          limit: 100,
        },
      });

      const dataPoints: DataPoint[] = res.data;
      setData(dataPoints);

      const formatted: ChartData[] = dataPoints.map((point) => {
        const temps = Array.isArray(point.temperatureValues)
          ? point.temperatureValues
          : [];
        return {
          time: new Date(point.collectedAt).toLocaleString(),
          avgTemp: temps.length
            ? temps.reduce((a: number, b: number) => a + b, 0) / temps.length
            : 0,
          maxTemp: temps.length ? Math.max(...temps) : 0,
          minTemp: temps.length ? Math.min(...temps) : 0,
          humidity: point.humidityValues || 0,
        };
      });

      setChartData(formatted);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading") {
    return <div className="flex justify-center p-8">加载中...</div>;
  }

  if (!granary) {
    return <div className="text-center p-8">仓房不存在</div>;
  }

  const latestData = data[0];
  const temps = latestData?.temperatureValues || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button as="a" href="/granaries" variant="light" isIconOnly>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{granary.name}</h1>
          <p className="text-gray-500">{granary.depot.name}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Select
            label="时间范围"
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="w-40"
            size="sm"
          >
            <SelectItem key="7" value="7">最近7天</SelectItem>
            <SelectItem key="14" value="14">最近14天</SelectItem>
            <SelectItem key="30" value="30">最近30天</SelectItem>
          </Select>
          <Button
            isIconOnly
            variant="light"
            onClick={fetchData}
            isLoading={loading}
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <Card>
            <CardBody className="text-center">
              <p className="text-sm text-gray-500">采集状态</p>
              <Chip
                color={granary.collectionStatus === 1 ? "success" : "warning"}
                className="mt-2"
              >
                {granary.collectionStatus === 1 ? "已采集" : "待采集"}
              </Chip>
            </CardBody>
          </Card>
        </div>
        <div>
          <Card>
            <CardBody className="text-center">
              <p className="text-sm text-gray-500">最后采集时间</p>
              <p className="text-lg font-semibold mt-2">
                {granary.lastCollectedAt
                  ? new Date(granary.lastCollectedAt).toLocaleString()
                  : "-"}
              </p>
            </CardBody>
          </Card>
        </div>
        <div>
          <Card>
            <CardBody className="text-center">
              <p className="text-sm text-gray-500">最新平均温度</p>
              <p className="text-lg font-semibold mt-2 text-primary">
                {temps.length
                  ? (
                      temps.reduce((a, b) => a + b, 0) / temps.length
                    ).toFixed(1)
                  : "-"}
                °C
              </p>
            </CardBody>
          </Card>
        </div>
        <div>
          <Card>
            <CardBody className="text-center">
              <p className="text-sm text-gray-500">最新湿度</p>
              <p className="text-lg font-semibold mt-2">
                {latestData?.humidityValues || "-"}%
              </p>
            </CardBody>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <p className="text-lg font-semibold">温度趋势</p>
        </CardHeader>
        <CardBody>
          {loading ? (
            <div className="h-64 flex items-center justify-center">
              <Spinner />
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-gray-500">
              暂无数据
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" fontSize={12} />
                  <YAxis />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="avgTemp"
                    stroke="#0ea5e9"
                    fill="#0ea5e9"
                    fillOpacity={0.3}
                    name="平均温度"
                  />
                  <Area
                    type="monotone"
                    dataKey="maxTemp"
                    stroke="#ef4444"
                    fill="#ef4444"
                    fillOpacity={0.1}
                    name="最高温度"
                  />
                  <Area
                    type="monotone"
                    dataKey="minTemp"
                    stroke="#22c55e"
                    fill="#22c55e"
                    fillOpacity={0.1}
                    name="最低温度"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <p className="text-lg font-semibold">历史数据</p>
        </CardHeader>
        <CardBody>
          <Table aria-label="数据列表">
            <TableHeader>
              <TableColumn>采集时间</TableColumn>
              <TableColumn>序号</TableColumn>
              <TableColumn>温度值</TableColumn>
              <TableColumn>湿度</TableColumn>
            </TableHeader>
            <TableBody>
              {data.slice(0, 10).map((point) => (
                <TableRow key={point.id}>
                  <TableCell>
                    {new Date(point.collectedAt).toLocaleString()}
                  </TableCell>
                  <TableCell>{point.sequenceNumber || "-"}</TableCell>
                  <TableCell>
                    {Array.isArray(point.temperatureValues)
                      ? point.temperatureValues.join(", ")
                      : "-"}
                  </TableCell>
                  <TableCell>{point.humidityValues || "-"}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );
}

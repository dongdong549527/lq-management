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
import { ArrowLeft, RefreshCw, Printer } from "lucide-react";
import axios from "axios";
import Granary3DView from "@/components/Granary3DView";
import GranaryCanvasView from "@/components/GranaryCanvasView";

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
  temperatureValues: any;
  humidityValues: any;
}

interface ChartData {
  time: string;
  avgTemp: number;
  maxTemp: number;
  minTemp: number;
  humidity: number;
  thTemp?: number;
}

export default function GranaryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { data: session, status } = useSession();
  const [granary, setGranary] = useState<Granary | null>(null);
  const [granaries, setGranaries] = useState<Granary[]>([]);
  const [data, setData] = useState<DataPoint[]>([]);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState("7");
  const [selectedDataId, setSelectedDataId] = useState<string>("");

  useEffect(() => {
    if (status === "unauthenticated") {
      redirect("/login");
    }
  }, [status]);

  useEffect(() => {
    fetchGranary();
    fetchGranaries();
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

  const fetchGranaries = async () => {
    try {
      const res = await axios.get("/api/granaries");
      const data = res.data;
      // API 返回格式: { data: granaries, pagination: {...} }
      setGranaries(data.data || []);
    } catch (error) {
      console.error("Failed to fetch granaries:", error);
    }
  };

  const handleGranaryChange = (granaryId: string) => {
    if (granaryId && granaryId !== resolvedParams.id) {
      window.location.href = `/granaries/${granaryId}`;
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
      if (dataPoints.length > 0) {
          setSelectedDataId(dataPoints[0].id.toString());
      }

      const formatted: ChartData[] = dataPoints.map((point) => {
        // Handle temperatureValues whether it's array (legacy) or object (new)
        let temps: number[] = [];
        if (Array.isArray(point.temperatureValues)) {
          temps = point.temperatureValues;
        } else if (point.temperatureValues && typeof point.temperatureValues === 'object') {
          // Filter out Indoor/Outdoor from average calculation
          temps = Object.entries(point.temperatureValues)
            .filter(([key]) => key !== 'Indoor' && key !== 'Outdoor')
            .map(([, val]) => val as number);
        }

        // Handle humidityValues
        let humidity = 0;
        let thTemp = 0;
        if (typeof point.humidityValues === 'number') {
            humidity = point.humidityValues;
        } else if (point.humidityValues && typeof point.humidityValues === 'object') {
            humidity = point.humidityValues.humidity || 0;
            thTemp = point.humidityValues.temperature || 0;
        }

        return {
          time: new Date(point.collectedAt).toLocaleString(),
          avgTemp: temps.length
            ? temps.reduce((a: number, b: number) => a + b, 0) / temps.length
            : 0,
          maxTemp: temps.length ? Math.max(...temps) : 0,
          minTemp: temps.length ? Math.min(...temps) : 0,
          humidity,
          thTemp
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
  const selectedData = data.find(d => d.id.toString() === selectedDataId) || latestData;

  // Calculate latest average temperature logic
  let temps: number[] = [];
  if (latestData) {
      if (Array.isArray(latestData.temperatureValues)) {
          temps = latestData.temperatureValues;
      } else if (latestData.temperatureValues && typeof latestData.temperatureValues === 'object') {
          temps = Object.entries(latestData.temperatureValues)
            .filter(([key]) => key !== 'Indoor' && key !== 'Outdoor')
            .map(([, val]) => val as number);
      }
  }

  // Get indoor/outdoor values
  const indoorVal = latestData?.temperatureValues?.['Indoor'];
  const outdoorVal = latestData?.temperatureValues?.['Outdoor'];

  // Print function
  const handlePrint = () => {
    if (!granary || !latestData) {
      alert('暂无数据，无法打印报表');
      return;
    }

    // Generate report HTML
    const reportHTML = `
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>粮情报表 - ${granary.name}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          body {
            font-family: "SimSun", "宋体", "Microsoft YaHei", serif;
            font-size: 10px;
            line-height: 1.3;
            color: #1a1a1a;
            background: #fff;
          }
          .container {
            width: 100%;
            max-width: 190mm;
            margin: 0 auto;
            padding: 8mm;
            background: #fff;
          }
          .header {
            text-align: center;
            margin-bottom: 6mm;
            border-bottom: 2px solid #1a1a1a;
            padding-bottom: 4mm;
          }
          .header h1 {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 3mm;
            letter-spacing: 3px;
            color: #000;
          }
          .header-info {
            display: flex;
            justify-content: space-between;
            font-size: 9px;
            color: #444;
          }
          .table-container {
            margin-bottom: 5mm;
            overflow-x: hidden;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 8px;
            table-layout: fixed;
          }
          th, td {
            border: 0.5px solid #666;
            padding: 2px 1px;
            text-align: center;
            vertical-align: middle;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          th {
            background-color: #d9d9d9;
            font-weight: bold;
            color: #000;
          }
          /* 温度表格背景统一为白色，移除斑马纹 */
          .table-container tbody tr {
            background-color: #fff;
          }
          .summary-table {
            margin-bottom: 5mm;
          }
          .summary-table th {
            background-color: #c0c0c0;
            font-size: 8px;
          }
          .summary-table td {
            font-size: 8px;
          }
          .weather-table {
            margin-bottom: 5mm;
          }
          .weather-table td {
            background-color: #f0f0f0;
            font-weight: bold;
            font-size: 9px;
          }
          .weather-table td:nth-child(odd) {
            background-color: #d9d9d9;
            width: 12%;
          }
          .weather-table td:nth-child(even) {
            background-color: #fff;
            width: 12%;
            font-weight: normal;
          }
          .info-table {
            margin-bottom: 4mm;
          }
          .info-table td {
            font-size: 8px;
            padding: 3px 2px;
          }
          .info-table tr td:nth-child(odd) {
            background-color: #d9d9d9;
            font-weight: bold;
            width: 10%;
          }
          .info-table tr td:nth-child(even) {
            background-color: #fff;
            font-weight: normal;
            width: 15%;
          }
          .footer {
            margin-top: 6mm;
            display: flex;
            justify-content: space-between;
            font-size: 9px;
            border-top: 1px solid #999;
            padding-top: 3mm;
            color: #444;
          }
          @media print {
            body {
              print-color-adjust: exact;
              -webkit-print-color-adjust: exact;
            }
            .container {
              padding: 5mm;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${granary.depot.name} (${granary.name}) 粮情报表</h1>
            <div class="header-info">
              <span>测量日期: ${new Date(latestData.collectedAt).toLocaleString()}</span>
              <span>天气: 多云</span>
              <span>单位: °C</span>
            </div>
          </div>

          <!-- Temperature Table -->
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  ${generateTableHeader()}
                </tr>
              </thead>
              <tbody>
                ${generateTemperatureRows()}
              </tbody>
            </table>
          </div>

          <!-- Summary Table -->
          <div class="summary-table">
            <table>
              <thead>
                <tr>
                  <th rowspan="2">区域</th>
                  <th colspan="3">四周区</th>
                  <th colspan="3">中央区</th>
                  <th colspan="3">全仓区</th>
                </tr>
                <tr>
                  <th>最高</th>
                  <th>最低</th>
                  <th>平均</th>
                  <th>最高</th>
                  <th>最低</th>
                  <th>平均</th>
                  <th>最高</th>
                  <th>最低</th>
                  <th>平均</th>
                </tr>
              </thead>
              <tbody>
                ${generateSummaryRows()}
              </tbody>
            </table>
          </div>

          <!-- Weather Table -->
          <div class="weather-table">
            <table>
              <tbody>
                <tr>
                  <td>仓温</td>
                  <td>${indoorVal?.temperature?.toFixed(1) || '0.0'}°C</td>
                  <td>仓湿</td>
                  <td>${indoorVal?.humidity?.toFixed(1) || '0.0'}%</td>
                  <td>气温</td>
                  <td>${outdoorVal?.temperature?.toFixed(1) || '0.0'}°C</td>
                  <td>气湿</td>
                  <td>${outdoorVal?.humidity?.toFixed(1) || '0.0'}%</td>
                </tr>
                <tr>
                  <td>整仓最高</td>
                  <td>${calculateMaxTemp().toFixed(1)}°C</td>
                  <td>整仓最低</td>
                  <td>${calculateMinTemp().toFixed(1)}°C</td>
                  <td>整仓平均</td>
                  <td>${calculateAvgTemp().toFixed(1)}°C</td>
                  <td>-</td>
                  <td>-</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Info Table -->
          <div class="info-table">
            <table>
              <tbody>
                <tr>
                  <td>保管员</td>
                  <td>${granary.info?.manager || '-'}</td>
                  <td>储粮性质</td>
                  <td>${granary.info?.storageType || '-'}</td>
                  <td>设计仓容(吨)</td>
                  <td>${granary.info?.designCapacity || 0}</td>
                </tr>
                <tr>
                  <td>实际储量(吨)</td>
                  <td>${granary.info?.actualCapacity || 0}</td>
                  <td>品种</td>
                  <td>${granary.info?.variety || '-'}</td>
                  <td>产地</td>
                  <td>${granary.info?.origin || '-'}</td>
                </tr>
                <tr>
                  <td>等级</td>
                  <td>${granary.info?.grade || '-'}</td>
                  <td>出糙率(%)</td>
                  <td>${granary.info?.roughRiceYield || 0}</td>
                  <td>水分(%)</td>
                  <td>${granary.info?.moisture || 0}</td>
                </tr>
                <tr>
                  <td>备注</td>
                  <td colspan="5">${granary.info?.remarks || '-'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="footer">
            <span>操作员: ${session?.user?.fullName || '管理员'}</span>
            <span>保管员: ${granary.info?.manager || '管理员'}</span>
            <span>备注: 温度点最高温字体加粗，最低温字体添加下划线</span>
          </div>
        </div>
      </body>
      </html>
    `;

    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(reportHTML);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
        printWindow.close();
      };
    }
  };

  // Helper functions for report generation
  const generateTemperatureRows = () => {
    if (!latestData?.temperatureValues) return '';

    // 使用仓房配置中的实际参数
    // 参考3D视图的映射逻辑（数据键格式：采集器ID-电缆编号-点编号）：
    // - cable = cableCount (电缆数量) -> 报表的"行"
    // - point = cablePointCount (每根电缆的点数) -> 报表的"层"
    // - collector = 采集器数量 (从startIndex到endIndex) -> 报表的"列"
    const actualCables = granary.config?.cableCount || 3;    // 电缆数量 -> 报表行数
    const actualPoints = granary.config?.cablePointCount || 4; // 点数数量 -> 报表层数
    
    // 计算采集器数量（列数）
    const startIdx = granary.config?.startIndex || 1;
    const endIdx = granary.config?.endIndex || 10;
    const actualCollectors = endIdx - startIdx + 1; // 列数 = 采集器数量

    // 计算列宽度（与表头保持一致）
    const colWidth = Math.max(20, Math.floor((190 - 50) / actualCollectors));

    const rows = [];
    // 根据实际配置生成电缆（行）和点（层）
    for (let cable = 1; cable <= actualCables; cable++) {
      for (let point = 1; point <= actualPoints; point++) {
        const cells = [];
        // 行层单元格样式（显示：X行Y层）
        cells.push(`<td style="width: 50px; font-weight: bold; background-color: #f5f5f5; font-size: 8px;">${cable}行${point}层</td>`);
        
        // 首先收集该行的所有温度值，找出最大值和最小值
        const rowTemps: number[] = [];
        for (let collectorIdx = 0; collectorIdx < actualCollectors; collectorIdx++) {
          const collectorId = startIdx + collectorIdx;
          const temp = getTemperatureValue(collectorId, cable, point) || 0.0;
          rowTemps.push(temp);
        }
        const maxTemp = Math.max(...rowTemps);
        const minTemp = Math.min(...rowTemps);
        
        // 生成对应采集器列数
        for (let collectorIdx = 0; collectorIdx < actualCollectors; collectorIdx++) {
          const collectorId = startIdx + collectorIdx;
          const temp = getTemperatureValue(collectorId, cable, point) || 0.0;
          
          // 所有温度值使用统一黑色
          const colorStyle = 'color: #000;';
          
          // 最大值加粗，最小值加下划线
          let specialStyle = '';
          if (temp === maxTemp) {
            specialStyle += 'font-weight: bold;';
          }
          if (temp === minTemp) {
            specialStyle += 'text-decoration: underline;';
          }
          
          cells.push(`<td style="width: ${colWidth}px; font-size: 8px; ${colorStyle} ${specialStyle}">${temp.toFixed(1)}</td>`);
        }
        rows.push(`<tr>${cells.join('')}</tr>`);
      }
    }
    return rows.join('');
  };

  const getTemperatureValue = (collectorId: number, cable: number, point: number) => {
    if (!latestData?.temperatureValues) return 0;
    
    // 与3D视图一致的映射（数据键格式：采集器ID-电缆编号-点编号）
    // collectorId -> c (采集器ID)
    // cable -> l (电缆编号)
    // point -> p (点编号)
    
    const key = `${collectorId}-${cable}-${point}`;
    return latestData.temperatureValues[key];
  };

  const generateTableHeader = () => {
    if (!latestData?.temperatureValues) return '';
    
    // 使用仓房配置中的实际参数
    // 计算采集器数量（列数）
    const startIdx = granary.config?.startIndex || 1;
    const endIdx = granary.config?.endIndex || 10;
    const actualCollectors = endIdx - startIdx + 1; // 列数 = 采集器数量
    
    // 生成表头，第一列为斜线表头（左下：行-层，右上：列）
    const headers = [`<th style="width: 50px; height: 40px; position: relative; padding: 0; background-color: #d9d9d9; overflow: hidden;">
      <div style="position: absolute; top: 2px; right: 4px; font-size: 8px;">列</div>
      <div style="position: absolute; bottom: 2px; left: 4px; font-size: 8px;">行-层</div>
      <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;">
        <svg style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" preserveAspectRatio="none">
          <line x1="0" y1="0" x2="100%" y2="100%" stroke="#666" stroke-width="1"/>
        </svg>
      </div>
    </th>`];
    
    // 为每列生成表头（显示采集器ID），根据列数动态调整宽度
    const colWidth = Math.max(20, Math.floor((190 - 50) / actualCollectors));
    
    for (let i = 0; i < actualCollectors; i++) {
      const collectorId = startIdx + i;
      headers.push(`<th style="width: ${colWidth}px; font-size: 8px;">${collectorId}</th>`);
    }
    
    return headers.join('');
  };

  const generateSummaryRows = () => {
    if (!latestData?.temperatureValues) return '';
    
    // 使用仓房配置中的实际参数
    // 数据映射：采集器ID-电缆编号-点编号
    const actualPoints = granary.config?.cablePointCount || 4; // 点数数量 -> 层
    const actualCables = granary.config?.cableCount || 3; // 电缆数量 -> 行
    const startIdx = granary.config?.startIndex || 1;
    const endIdx = granary.config?.endIndex || 10;
    const actualCollectors = endIdx - startIdx + 1; // 采集器数量 -> 列

    const rows = [];
    // 根据实际点数（层）生成统计
    for (let point = 1; point <= actualPoints; point++) {
      // 计算该点层（在3D视图中是垂直方向）的统计数据
      const pointTemps: number[] = [];
      const edgeTemps: number[] = [];
      const centerTemps: number[] = [];
      
      for (let cable = 1; cable <= actualCables; cable++) {
        for (let collectorIdx = 0; collectorIdx < actualCollectors; collectorIdx++) {
          const collectorId = startIdx + collectorIdx;
          const temp = getTemperatureValue(collectorId, cable, point);
          if (temp !== undefined && temp !== null) {
            pointTemps.push(temp);
            
            // 判断是否为最外圈（四周区）
            // 最外圈：第一电缆、最后一电缆、第一采集器、最后一采集器
            const isEdge = (cable === 1) || (cable === actualCables) || (collectorIdx === 0) || (collectorIdx === actualCollectors - 1);
            
            if (isEdge) {
              edgeTemps.push(temp);
            } else {
              centerTemps.push(temp);
            }
          }
        }
      }
      
      const cells = [];
      cells.push(`<td style="font-weight: bold; background-color: #f5f5f5;">${point}层</td>`);
      
      // 四周区（最外圈温度点）
      if (edgeTemps.length > 0) {
        cells.push(`<td>${Math.max(...edgeTemps).toFixed(1)}</td>`);
        cells.push(`<td>${Math.min(...edgeTemps).toFixed(1)}</td>`);
        cells.push(`<td>${(edgeTemps.reduce((a, b) => a + b, 0) / edgeTemps.length).toFixed(1)}</td>`);
      } else {
        cells.push('<td>-</td><td>-</td><td>-</td>');
      }
      
      // 中央区（除最外圈外的温度点）
      if (centerTemps.length > 0) {
        cells.push(`<td>${Math.max(...centerTemps).toFixed(1)}</td>`);
        cells.push(`<td>${Math.min(...centerTemps).toFixed(1)}</td>`);
        cells.push(`<td>${(centerTemps.reduce((a, b) => a + b, 0) / centerTemps.length).toFixed(1)}</td>`);
      } else {
        cells.push('<td>-</td><td>-</td><td>-</td>');
      }
      
      // 全仓区（该点层所有温度点）
      if (pointTemps.length > 0) {
        cells.push(`<td>${Math.max(...pointTemps).toFixed(1)}</td>`);
        cells.push(`<td>${Math.min(...pointTemps).toFixed(1)}</td>`);
        cells.push(`<td>${(pointTemps.reduce((a, b) => a + b, 0) / pointTemps.length).toFixed(1)}</td>`);
      } else {
        cells.push('<td>-</td><td>-</td><td>-</td>');
      }
      
      rows.push(`<tr>${cells.join('')}</tr>`);
    }
    return rows.join('');
  };

  const calculateMaxTemp = () => {
    if (!latestData?.temperatureValues) return 0;
    
    const temps = Object.entries(latestData.temperatureValues)
      .filter(([key]) => key !== 'Indoor' && key !== 'Outdoor')
      .map(([, val]) => val as number);
    
    return temps.length ? Math.max(...temps) : 0;
  };

  const calculateMinTemp = () => {
    if (!latestData?.temperatureValues) return 0;
    
    const temps = Object.entries(latestData.temperatureValues)
      .filter(([key]) => key !== 'Indoor' && key !== 'Outdoor')
      .map(([, val]) => val as number);
    
    return temps.length ? Math.min(...temps) : 0;
  };

  const calculateAvgTemp = () => {
    if (!latestData?.temperatureValues) return 0;
    
    const temps = Object.entries(latestData.temperatureValues)
      .filter(([key]) => key !== 'Indoor' && key !== 'Outdoor')
      .map(([, val]) => val as number);
    
    return temps.length ? temps.reduce((a, b) => a + b, 0) / temps.length : 0;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button as="a" href="/granaries" variant="light" isIconOnly>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-2">
          <Select
            aria-label="选择仓房"
            selectedKeys={resolvedParams.id ? [resolvedParams.id] : []}
            onChange={(e) => handleGranaryChange(e.target.value)}
            className="w-48"
            size="sm"
          >
            {granaries.map((g) => (
              <SelectItem key={g.id.toString()}>
                {g.name}
              </SelectItem>
            ))}
          </Select>
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
            <SelectItem key="7">最近7天</SelectItem>
            <SelectItem key="14">最近14天</SelectItem>
            <SelectItem key="30">最近30天</SelectItem>
          </Select>
          <Button
            isIconOnly
            variant="light"
            onClick={fetchData}
            isLoading={loading}
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button
            isIconOnly
            variant="light"
            onClick={() => handlePrint()}
          >
            <Printer className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        <div className="flex">
          <Card className="flex-1 h-28 flex flex-col">
            <CardBody className="text-center flex flex-col justify-center p-2">
              <p className="text-xs text-gray-500">采集状态</p>
              <div className="mt-1 flex justify-center">
                <Chip
                  size="sm"
                  color={granary.collectionStatus === 1 ? "success" : "warning"}
                >
                  {granary.collectionStatus === 1 ? "已采集" : "待采集"}
                </Chip>
              </div>
            </CardBody>
          </Card>
        </div>
        <div className="flex">
          <Card className="flex-1 h-28 flex flex-col">
            <CardBody className="text-center flex flex-col justify-center p-2">
              <p className="text-xs text-gray-500">最后采集时间</p>
              <p className="text-sm font-semibold mt-1">
                {granary.lastCollectedAt
                  ? new Date(granary.lastCollectedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
                  : "-"}
              </p>
            </CardBody>
          </Card>
        </div>
        <div className="flex">
          <Card className="flex-1 h-28 flex flex-col">
            <CardBody className="text-center flex flex-col justify-center p-2">
              <p className="text-xs text-gray-500">最新平均温度</p>
              <p className="text-sm font-semibold mt-1 text-primary">
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
        <div className="flex">
          <Card className="flex-1 h-28 flex flex-col">
            <CardBody className="text-center flex flex-col justify-center p-2">
              <p className="text-xs text-gray-500">仓内温湿度</p>
              <div className="mt-1">
                {indoorVal ? (
                    <div className="flex flex-col gap-1">
                      <p className="text-sm font-semibold text-primary">
                        {indoorVal.temperature}°C
                      </p>
                      <p className="text-xs text-gray-500">
                        {indoorVal.humidity}%
                      </p>
                    </div>
                ) : (
                  <p className="text-sm font-semibold">-</p>
                )}
              </div>
            </CardBody>
          </Card>
        </div>
        <div className="flex">
          <Card className="flex-1 h-28 flex flex-col">
            <CardBody className="text-center flex flex-col justify-center p-2">
              <p className="text-xs text-gray-500">仓外温湿度</p>
              <div className="mt-1">
                {outdoorVal ? (
                    <div className="flex flex-col gap-1">
                      <p className="text-sm font-semibold text-primary">
                        {outdoorVal.temperature}°C
                      </p>
                      <p className="text-xs text-gray-500">
                        {outdoorVal.humidity}%
                      </p>
                    </div>
                ) : (
                  <p className="text-sm font-semibold">-</p>
                )}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

{/*       <Card>
        <CardHeader className="flex justify-between items-center">
          <p className="text-lg font-semibold">立体粮情 (Canvas)</p>
          <Select 
            aria-label="选择采集时间"
            className="w-64" 
            size="sm" 
            placeholder="选择采集时间"
            selectedKeys={selectedDataId ? [selectedDataId] : []}
            onChange={(e) => setSelectedDataId(e.target.value)}
          >
              {data.map((point) => (
                  <SelectItem key={point.id}>
                      {new Date(point.collectedAt).toLocaleString()}
                  </SelectItem>
              ))}
          </Select>
        </CardHeader>
        <CardBody>
          <div className="h-[500px] w-full min-w-0">
             <GranaryCanvasView 
                data={selectedData?.temperatureValues || {}}
                config={{
                    cableCount: granary.config?.cableCount || 0,
                    cablePointCount: granary.config?.cablePointCount || 0,
                    totalCollectorCount: granary.config?.totalCollectorCount || 0 // Pass this
                }}
             />
          </div>
        </CardBody>
      </Card> */}

      <Card>
        <CardHeader>
          <p className="text-lg font-semibold">立体粮情 (Three.js)</p>
        </CardHeader>
        <CardBody>
          <div className="h-[500px] w-full min-w-0">
             <Granary3DView 
                name={granary.name}
                data={selectedData?.temperatureValues || {}}
                config={{
                    cableCount: granary.config?.cableCount || 0,
                    cablePointCount: granary.config?.cablePointCount || 0,
                    totalCollectorCount: granary.config?.totalCollectorCount || 0 // Pass this
                }}
             />
          </div>
        </CardBody>
      </Card>

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
            <div className="h-64 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%" debounce={50}>
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
              <TableColumn>最高温</TableColumn>
              <TableColumn>最低温</TableColumn>
              <TableColumn>平均温</TableColumn>
              <TableColumn>仓温</TableColumn>
              <TableColumn>仓湿</TableColumn>
              <TableColumn>外温</TableColumn>
              <TableColumn>外湿</TableColumn>
            </TableHeader>
            <TableBody>
              {data.slice(0, 10).map((point) => {
                // Calculate stats for each row
                let temps: number[] = [];
                if (Array.isArray(point.temperatureValues)) {
                  temps = point.temperatureValues;
                } else if (point.temperatureValues && typeof point.temperatureValues === 'object') {
                   temps = Object.entries(point.temperatureValues)
                    .filter(([key]) => key !== 'Indoor' && key !== 'Outdoor')
                    .map(([, val]) => val as number);
                }
                
                const maxTemp = temps.length ? Math.max(...temps) : "-";
                const minTemp = temps.length ? Math.min(...temps) : "-";
                const avgTemp = temps.length ? (temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1) : "-";
                
                const indoor = point.temperatureValues?.['Indoor'];
                const outdoor = point.temperatureValues?.['Outdoor'];

                return (
                  <TableRow key={point.id}>
                    <TableCell>
                      {new Date(point.collectedAt).toLocaleString()}
                    </TableCell>
                    <TableCell>{maxTemp}°C</TableCell>
                    <TableCell>{minTemp}°C</TableCell>
                    <TableCell>{avgTemp}°C</TableCell>
                    <TableCell>{indoor ? `${indoor.temperature}°C` : "-"}</TableCell>
                    <TableCell>{indoor ? `${indoor.humidity}%` : "-"}</TableCell>
                    <TableCell>{outdoor ? `${outdoor.temperature}°C` : "-"}</TableCell>
                    <TableCell>{outdoor ? `${outdoor.humidity}%` : "-"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );
}

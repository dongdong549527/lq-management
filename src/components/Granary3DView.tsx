"use client";

import React, { useMemo, useRef, useState, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Text, Html, Billboard } from "@react-three/drei";
import { Maximize, Minimize } from "lucide-react";
import * as THREE from "three";

interface Granary3DViewProps {
  config: {
    cableCount: number;
    cablePointCount: number;
    startIndex?: number;
    endIndex?: number;
    length?: number;
    width?: number;
    height?: number;
  };
  data: { [key: string]: number }; // temperatureValues
}

// 根据温度值返回对应的颜色字符串
function getColor(value?: number) {
  if (value === undefined) return "gray";
  if (value < 5) return "#60a5fa";  // blue-400
  if (value < 10) return "#3b82f6"; // blue-500
  if (value < 15) return "#22c55e"; // green-500
  if (value < 20) return "#84cc16"; // lime-500
  if (value < 25) return "#eab308"; // yellow-500
  if (value < 30) return "#f59e0b"; // amber-500
  if (value < 35) return "#f97316"; // orange-500
  return "#ef4444"; // red-500
}

// 网格标签组件，支持悬停和点击交互
function GridLabel({ position, text, onClick, active }: { position: [number, number, number]; text: string; onClick?: () => void; active?: boolean }) {
  const [hovered, setHover] = useState(false);
  
  return (
    <Text
      position={position}
      fontSize={0.5}
      color={active ? "#ef4444" : (hovered ? "#3b82f6" : "black")}
      anchorX="center"
      anchorY="middle"
      outlineWidth={0.02}
      outlineColor="white"
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
      onClick={(e) => {
          e.stopPropagation();
          onClick?.();
      }}
    >
      {text}
    </Text>
  );
}

// 传感器数值显示组件，始终面向相机
function SensorValue({ position, value }: { position: [number, number, number]; value?: number }) {
    const color = useMemo(() => getColor(value), [value]);

    return (
        <Billboard position={position}>
            <Text
                fontSize={0.5}
                color={color}
                anchorX="center"
                anchorY="middle"
                outlineWidth={0.02}
                outlineColor="white"
            >
                {value !== undefined ? value.toFixed(1) : '-'}
            </Text>
        </Billboard>
    )
}

export default function Granary3DView({ config, data }: Granary3DViewProps) {
  const { cableCount, cablePointCount, startIndex, endIndex } = config;
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
        containerRef.current?.requestFullscreen();
    } else {
        document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
        setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // 根据数据动态解析布局：列、行、层
  const layout = useMemo(() => {
    if (!data) return { cols: 1, rows: 1, layers: 1, map: new Map() };
    
    // 过滤掉室内/室外温度键值
    const keys = Object.keys(data).filter(k => k !== 'Indoor' && k !== 'Outdoor');
    const parsed = keys.map(k => {
        const parts = k.split('-').map(Number);
        if (parts.length === 3) {
            return { c: parts[0], l: parts[1], p: parts[2], val: data[k], key: k };
        }
        return null;
    }).filter(Boolean) as { c: number, l: number, p: number, val: number, key: string }[];
    
    if (parsed.length === 0) return { cols: 1, rows: 1, layers: 1, map: new Map() };
    
    // 计算最大最小索引
    const minC = Math.min(...parsed.map(i => i.c));
    const maxC = Math.max(...parsed.map(i => i.c));
    const minL = Math.min(...parsed.map(i => i.l));
    const maxL = Math.max(...parsed.map(i => i.l));
    const minP = Math.min(...parsed.map(i => i.p));
    const maxP = Math.max(...parsed.map(i => i.p));
    
    const cols = maxC; // 采集器作为列
    const rows = maxL; // 线缆作为行
    const layers = maxP; // 测点作为层
    
    // 创建快速查询映射
    const map = new Map();
    parsed.forEach(item => {
        map.set(`${item.c}-${item.l}-${item.p}`, item.val);
    });
    
    return { cols, rows, layers, map };
  }, [data]);
  
  const { cols, rows, layers, map } = layout;

  // 过滤器状态：按层、行、列或全部显示
  const [filter, setFilter] = useState<{ type: 'layer' | 'row' | 'col' | 'all', value: number } | null>(null);

  // 默认显示最底层（最大层索引）
  useEffect(() => {
      if (layers > 0) {
          setFilter({ type: 'layer', value: layers });
      }
  }, [layers]);

  // 计算尺寸与间距
  const pointSpacingY = config.height && layers ? config.height / layers : 1.5;
  const cableSpacingX = config.width && cols ? config.width / cols : 2;
  const cableSpacingZ = config.length && rows ? config.length / rows : 2;

  const width = cols * cableSpacingX;
  const depth = rows * cableSpacingZ;
  const height = layers * pointSpacingY;

  // 居中偏移
  const offsetX = -width / 2 + cableSpacingX / 2;
  const offsetZ = -depth / 2 + cableSpacingZ / 2;
  const offsetY = -height / 2 + pointSpacingY / 2;

  // 生成传感器节点数组
  const sensors = useMemo(() => {
    const items = [];
    
    // 遍历列、行、层
    for (let c = 1; c <= cols; c++) {
        for (let l = 1; l <= rows; l++) {
            for (let p = 1; p <= layers; p++) {
                const val = map.get(`${c}-${l}-${p}`);
                
                // 计算三维坐标
                const x = (c - 1) * cableSpacingX + offsetX;
                const z = (l - 1) * cableSpacingZ + offsetZ;
                const y = (layers - p) * pointSpacingY + offsetY;
                
                // 根据过滤器决定是否可见
                let visible = true;
                if (filter && filter.type !== 'all') {
                    if (filter.type === 'layer' && p !== filter.value) visible = false;
                    if (filter.type === 'col' && c !== filter.value) visible = false;
                    if (filter.type === 'row' && l !== filter.value) visible = false;
                }

                if (visible) {
                    items.push({
                        position: [x, y, z] as [number, number, number],
                        value: val,
                        label: `${c}-${l}-${p}`
                    });
                }
            }
        }
    }
    return items;
  }, [cols, rows, layers, map, offsetX, offsetY, offsetZ, filter]);

  // Calculate camera position to fit the scene
  const fov = 45;
  const maxDim = Math.max(width, height);
  // Distance to fit the object vertically/horizontally at the center plane (z=0)
  // We add depth/2 to ensure we are outside the object, and a margin factor
  const camDist = (maxDim / (2 * Math.tan((fov * Math.PI) / 360))) + depth / 2 - 10;

  return (
    <div ref={containerRef} className={`w-full ${isFullscreen ? 'h-screen' : 'h-[500px]'} bg-sky-100 rounded-xl overflow-hidden border border-sky-200 relative`}>
      {/* 全屏按钮 */}
      <div 
          className="absolute top-4 left-4 bg-white/90 p-2 rounded shadow text-xs cursor-pointer hover:bg-gray-100 z-50 flex items-center justify-center"
          onClick={toggleFullscreen}
          title={isFullscreen ? "退出全屏" : "全屏显示"}
      >
          {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
      </div>

      <Canvas camera={{ position: [0, 0, camDist], fov: fov }}>
        <ambientLight intensity={0.8} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <OrbitControls makeDefault />

        <group>
            {/* 地板 */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -height/2 - 0.5, 0]}>
                <planeGeometry args={[width + 2, depth + 2]} />
                <meshStandardMaterial color="#cbd5e1" />
            </mesh>

            {/* 线框边界 */}
            <lineSegments position={[0, 0, 0]}>
                <edgesGeometry args={[new THREE.BoxGeometry(width, height, depth)]} />
                <lineBasicMaterial color="#f59e0b" linewidth={2} />
            </lineSegments>

            {/* 传感器数值 */}
            {sensors.map((s, idx) => (
                <SensorValue key={idx} position={s.position} value={s.value} />
            ))}

            {/* 层标签（Y轴） */}
            {Array.from({ length: layers }).map((_, i) => (
                <GridLabel
                    key={`layer-${i}`}
                    position={[-width / 2 - 1, (layers - 1 - i) * pointSpacingY + offsetY, depth / 2]}
                    text={`${i + 1}层`}
                    active={filter?.type === 'layer' && filter.value === i + 1}
                    onClick={() => setFilter({ type: 'layer', value: i + 1 })}
                />
            ))}

            {/* 列标签（X轴） - 显示在底部 */}
            {Array.from({ length: cols }).map((_, i) => (
                <GridLabel
                    key={`col-${i}`}
                    position={[i * cableSpacingX + offsetX, -height / 2 + 1, depth / 2]}
                    text={`${i + 1}列`}
                    active={filter?.type === 'col' && filter.value === i + 1}
                    onClick={() => setFilter({ type: 'col', value: i + 1 })}
                />
            ))}

            {/* 排标签（Z轴） */}
            {Array.from({ length: rows }).map((_, i) => (
                <GridLabel
                    key={`row-${i}`}
                    position={[-width / 2 - 1, height / 2 + 1, i * cableSpacingZ + offsetZ]}
                    text={`${i + 1}排`}
                    active={filter?.type === 'row' && filter.value === i + 1}
                    onClick={() => setFilter({ type: 'row', value: i + 1 })}
                />
            ))}

        </group>
      </Canvas>

      {/* 温度图例 */}
      <div className="absolute bottom-4 right-4 bg-white/90 p-2 rounded shadow text-xs space-y-1">
          <div className="flex items-center gap-2"><div className="w-3 h-3 bg-blue-500 rounded-full"></div> &lt; 10°C</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 bg-green-500 rounded-full"></div> 10-20°C</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 bg-yellow-500 rounded-full"></div> 20-30°C</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-500 rounded-full"></div> &gt; 30°C</div>
      </div>
      
      {/* 显示全部按钮 */}
      {filter?.type !== 'all' && (
          <div 
            className="absolute top-4 right-4 bg-white/90 p-2 rounded shadow text-xs cursor-pointer hover:bg-gray-100"
            onClick={() => setFilter({ type: 'all', value: 0 })}
          >
              显示全部
          </div>
      )}
    </div>
  );
}

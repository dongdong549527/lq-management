"use client";

import React, { useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Text, Html, Billboard } from "@react-three/drei";
import * as THREE from "three";
import { useEffect } from "react";

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

// Color logic (returns string for Text color)
function getColor(value?: number) {
  if (value === undefined) return "gray";
  if (value < 10) return "#3b82f6"; // blue-500
  if (value < 20) return "#22c55e"; // green-500
  if (value < 30) return "#eab308"; // yellow-500
  return "#ef4444"; // red-500
}

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

  // Calculate layout based on start/end index
  // Col (Column): Derived from cable index
  // Row (Row): Not explicitly defined in config, assuming 1 row if not specified, 
  // or we can calculate if we had "cablesPerRow".
  // The user requirement says: "Col is collector start/end index".
  // This implies the X axis represents the cables (Collector IDs or Cable IDs).
  // "Row is cable count" - this is a bit confusing.
  // Let's re-read: "列是采集起始和结束索引" (Cols are start/end index) -> So Width is determined by (endIndex - startIndex + 1)
  // "层是单缆点数" (Layers are cablePointCount) -> Height is cablePointCount
  // "行是电缆数量" (Rows are cableCount) -> This might mean depth?
  
  // Interpretation A:
  // X-axis: Cable ID (from startIndex to endIndex)
  // Y-axis: Point ID (1 to cablePointCount)
  // Z-axis: Maybe just 1 row if it's a 2D slice, or if "Row" means something else.
  
  // Wait, "行是电缆数量" (Row is cable count) AND "列是采集起始和结束索引" (Col is start/end index).
  // Usually Total Cables = (endIndex - startIndex + 1).
  // If "Row is cable count", maybe it means there are multiple rows of cables?
  // But standard granary config usually just has a linear list of cables.
  
  // Let's try to infer from typical granary layout:
  // Usually cables are arranged in a grid (Rows x Cols).
  // But here we only have `startIndex` and `endIndex` (e.g. 1 to 12).
  // Total cables = 12.
  // User says "Col is start/end index". So we have 12 Columns.
  // User says "Row is cable count". This contradicts "Col is start/end".
  // Maybe "Row" is fixed to 1?
  
  // Let's look at the image provided by user (mental check):
  // It shows a 3D box.
  // Top labels: 1, 2, 3 ... 15 (Columns)
  // Side labels: 1排, 2排, 3排 (Rows)
  // Vertical labels: 4层, 3层... (Layers)
  
  // So we need to support Rows x Cols grid.
  // But our config only has `startIndex`, `endIndex`, `cableCount`.
  // `cableCount` usually equals `(endIndex - startIndex + 1)`.
  // If the user wants a grid, we are missing "Columns per Row" or "Total Rows" info in the config.
  // HOWEVER, the user prompt says: "行列层应该根据粮仓配置来... 行是电缆数量"
  // If "Row is cable quantity", and "Col is start/end index"...
  // Maybe it means:
  // X-axis (Cols) = Cable Index (1..N)
  // Z-axis (Rows) = 1 (Default, unless we can parse it from data)
  
  // Alternative interpretation of "行是电缆数量":
  // Maybe user means the Z-axis count is `cableCount`? And X-axis is `endIndex - startIndex`?
  // No, that would duplicate dimensions.
  
  // Let's look at the data keys: "1-1-1" (Collector-Cable-Point).
  // In many systems: Collector = Column, Cable = Row? Or vice versa?
  // Or Collector-Cable combined = XY position?
  
  // Let's try to auto-detect dimensions from the DATA if config is insufficient.
  // We can parse all keys "C-L-P" (Collector-Line-Point).
  // Max(C) -> Cols?
  // Max(L) -> Rows?
  // Max(P) -> Layers?
  
  // User said: "温度值前面有序号可以作为坐标" (The sequence number in temp value can be used as coordinate).
  // Data keys are "1-1-1", "1-1-2", etc.
  // Let's assume the format is "X-Z-Y" or "Col-Row-Layer" or similar.
  // Standard lq-server format is "Collector-Cable-Point".
  // Let's assume:
  // Collector ID -> Column (X)
  // Cable ID -> Row (Z)
  // Point ID -> Layer (Y)
  
  // Let's implement dynamic detection based on data keys.
  
  const layout = useMemo(() => {
    if (!data) return { cols: 1, rows: 1, layers: 1, map: new Map() };
    
    const keys = Object.keys(data).filter(k => k !== 'Indoor' && k !== 'Outdoor');
    const parsed = keys.map(k => {
        const parts = k.split('-').map(Number);
        if (parts.length === 3) {
            return { c: parts[0], l: parts[1], p: parts[2], val: data[k], key: k };
        }
        return null;
    }).filter(Boolean) as { c: number, l: number, p: number, val: number, key: string }[];
    
    if (parsed.length === 0) return { cols: 1, rows: 1, layers: 1, map: new Map() };
    
    const minC = Math.min(...parsed.map(i => i.c));
    const maxC = Math.max(...parsed.map(i => i.c));
    const minL = Math.min(...parsed.map(i => i.l));
    const maxL = Math.max(...parsed.map(i => i.l));
    const minP = Math.min(...parsed.map(i => i.p));
    const maxP = Math.max(...parsed.map(i => i.p));
    
    const cols = maxC; // Collector as Column
    const rows = maxL; // Cable as Row
    const layers = maxP; // Point as Layer
    
    // Create a map for easy lookup: `${c}-${l}-${p}` -> val
    const map = new Map();
    parsed.forEach(item => {
        map.set(`${item.c}-${item.l}-${item.p}`, item.val);
    });
    
    return { cols, rows, layers, map };
  }, [data]);
  
  const { cols, rows, layers, map } = layout;

  // Filter State
  const [filter, setFilter] = useState<{ type: 'layer' | 'row' | 'col' | 'all', value: number } | null>(null);

  // Set default filter to bottom layer (max layer index)
  useEffect(() => {
      if (layers > 0) {
          setFilter({ type: 'layer', value: layers });
      }
  }, [layers]);

  // Dimensions
  const pointSpacingY = config.height && layers ? config.height / layers : 1.5;
  const cableSpacingX = config.width && cols ? config.width / cols : 2;
  const cableSpacingZ = config.length && rows ? config.length / rows : 2;

  const width = cols * cableSpacingX;
  const depth = rows * cableSpacingZ;
  const height = layers * pointSpacingY;

  // Center the granary
  const offsetX = -width / 2 + cableSpacingX / 2;
  const offsetZ = -depth / 2 + cableSpacingZ / 2;
  const offsetY = -height / 2 + pointSpacingY / 2;

  const sensors = useMemo(() => {
    const items = [];
    
    // Iterate x, z, y
    for (let c = 1; c <= cols; c++) {
        for (let l = 1; l <= rows; l++) {
            for (let p = 1; p <= layers; p++) {
                const val = map.get(`${c}-${l}-${p}`);
                
                // Only render if we have data or if it's within the "bounding box" of expected sensors
                // To avoid empty gaps being too prominent, we can render placeholders or skip.
                // Let's render everything in the grid to show structure, but gray out missing.
                
                const x = (c - 1) * cableSpacingX + offsetX;
                const z = (l - 1) * cableSpacingZ + offsetZ;
                const y = (layers - p) * pointSpacingY + offsetY; // Layer 1 is top? Or bottom? 
                
                // Check filter
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


  const [hoverInfo, setHoverInfo] = useState<any>(null); // Kept for future use if needed, but currently unused logic removed

  return (
    <div className="w-full h-[500px] bg-sky-100 rounded-xl overflow-hidden border border-sky-200 relative">
      <Canvas camera={{ position: [width * 1.5, height * 1.5, depth * 1.5], fov: 45 }}>
        <ambientLight intensity={0.8} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <OrbitControls makeDefault />

        <group>
            {/* Floor */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -height/2 - 0.5, 0]}>
                <planeGeometry args={[width + 2, depth + 2]} />
                <meshStandardMaterial color="#cbd5e1" />
            </mesh>

            {/* Wireframe Box */}
            <lineSegments position={[0, 0, 0]}>
                <edgesGeometry args={[new THREE.BoxGeometry(width, height, depth)]} />
                <lineBasicMaterial color="#f59e0b" linewidth={2} />
            </lineSegments>

            {/* Sensors via Text */}
            {sensors.map((s, idx) => (
                <SensorValue key={idx} position={s.position} value={s.value} />
            ))}

            {/* Layer Labels (Y-axis) */}
            {Array.from({ length: layers }).map((_, i) => (
                <GridLabel
                    key={`layer-${i}`}
                    position={[-width / 2 - 1, (layers - 1 - i) * pointSpacingY + offsetY, depth / 2]}
                    text={`${i + 1}层`}
                    active={filter?.type === 'layer' && filter.value === i + 1}
                    onClick={() => setFilter({ type: 'layer', value: i + 1 })}
                />
            ))}

            {/* Row/Col Labels */}
             {/* Columns (X-axis) */}
             {Array.from({ length: cols }).map((_, i) => (
                <GridLabel
                    key={`col-${i}`}
                    position={[i * cableSpacingX + offsetX, height / 2 + 1, depth / 2]}
                    text={`${i + 1}列`}
                    active={filter?.type === 'col' && filter.value === i + 1}
                    onClick={() => setFilter({ type: 'col', value: i + 1 })}
                />
            ))}
             {/* Rows (Z-axis) */}
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
      <div className="absolute bottom-4 right-4 bg-white/90 p-2 rounded shadow text-xs space-y-1">
          <div className="flex items-center gap-2"><div className="w-3 h-3 bg-blue-500 rounded-full"></div> &lt; 10°C</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 bg-green-500 rounded-full"></div> 10-20°C</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 bg-yellow-500 rounded-full"></div> 20-30°C</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-500 rounded-full"></div> &gt; 30°C</div>
      </div>
      
      {/* Show All Button */}
      {filter?.type !== 'all' && (
          <div 
            className="absolute top-4 right-4 bg-white/90 p-2 rounded shadow text-xs cursor-pointer hover:bg-gray-100"
            onClick={() => setFilter({ type: 'all', value: 0 })}
          >
              显示全部
          </div>
      )}
      
      {/* Tooltip for Hover Info - Removed as we show values directly */}
    </div>
  );
}

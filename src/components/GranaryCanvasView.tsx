"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";

interface GranaryCanvasViewProps {
  config: {
    cableCount: number;
    cablePointCount: number;
    startIndex?: number; // Add start index
    endIndex?: number;   // Add end index
    length?: number;
    width?: number;
    height?: number;
    totalCollectorCount?: number;
  };
  data: { [key: string]: number };
}

export default function GranaryCanvasView({ config, data }: GranaryCanvasViewProps) {
  const { cableCount, cablePointCount } = config;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<{ type: 'layer' | 'row' | 'col' | 'all', value: number } | null>(null);

  // 解析数据并确定布局
  const layout = useMemo(() => {
    // 自动探测数据范围
    let dCols = 1, dRows = 1, dLayers = 1;
    const map = new Map();

    if (data) {
        const keys = Object.keys(data).filter(k => k !== 'Indoor' && k !== 'Outdoor');
        const parsed = keys.map(k => {
            const parts = k.split('-').map(Number);
            if (parts.length === 3) {
                return { c: parts[0], l: parts[1], p: parts[2], val: data[k] };
            }
            return null;
        }).filter(Boolean) as { c: number, l: number, p: number, val: number }[];
        
        parsed.forEach(item => {
            map.set(`${item.c}-${item.l}-${item.p}`, item.val);
        });
        
        if (parsed.length > 0) {
            dCols = Math.max(...parsed.map(i => i.c));
            dRows = Math.max(...parsed.map(i => i.l));
            dLayers = Math.max(...parsed.map(i => i.p));
        }
    }
    
    // 优先使用配置中的参数
    const startIdx = config.startIndex || 1;
    const endIdx = config.endIndex || dCols;
    const cols = (endIdx - startIdx + 1) || dCols; 
    
    const rows = config.cableCount || dRows;          // 行
    const layers = config.cablePointCount || dLayers; // 层

    return { cols, rows, layers, map, startIdx };
  }, [data, config]); // 依赖 config

  const { cols, rows, layers, map, startIdx } = layout;

  // Set default filter to bottom layer
  useEffect(() => {
    if (layers > 0 && !filter) {
        setFilter({ type: 'layer', value: layers });
    }
  }, [layers]);

  // 2. Drawing Logic
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Responsive Canvas Size Handling
    // We need to listen to resize events or use ResizeObserver to keep canvas buffer size in sync with display size.
    // However, since this component re-renders when parent changes (usually), 
    // simply checking clientWidth/Height here is often enough for initial render.
    // For robust resizing, we can add a ResizeObserver.
    
    const resizeCanvas = () => {
        const container = containerRef.current;
        if (container) {
            // Set actual canvas buffer size to match display size
            canvas.width = container.clientWidth;
            canvas.height = container.clientHeight;
            
            // Trigger redraw by forcing update or just calling draw()
            // Since we are inside useEffect [width, height], modifying width/height might not trigger it unless we store them in state.
            // Let's store W/H in state to trigger re-calculation of geometry.
            setCanvasSize({ width: container.clientWidth, height: container.clientHeight });
        }
    };

    // Initial resize
    resizeCanvas();

    // Add listener
    window.addEventListener('resize', resizeCanvas);
    
    // Cleanup
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  // Actual Drawing Effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || canvasSize.width === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    const W = canvasSize.width;
    const H = canvasSize.height;
    
    // Clear
    ctx.clearRect(0, 0, W, H);

    // --- Configuration ---
    // Perspective parameters (Oblique projection)
    // To prevent deformation, we should base our units on the smaller dimension (Min(W, H))
    // rather than scaling X and Y independently.
    
    const scaleFactor = Math.min(W, H) / 500; // Base scale on 500px ref size
    
    const margin = 60 * scaleFactor;
    // Keep aspect ratio of the front face consistent
    // Let's say front face should take up ~60% of width and ~50% of height max
    const frontW = Math.min(W * 0.6, H * 0.6); 
    const frontH = frontW * 0.8; // Fixed aspect ratio for front face (width/height)
    
    // Center it horizontally
    const startX = (W - frontW) / 2 + (20 * scaleFactor); 
    // Position vertically
    const startY = H - margin - (40 * scaleFactor);
    
    // Z-axis projection vector
    const zDepth = 200 * scaleFactor; 
    const zAngle = -Math.PI / 4.5; 
    const zVecX = Math.cos(zAngle) * zDepth; 
    const zVecY = Math.sin(zAngle) * zDepth; 

    // ... Rest of drawing logic uses these calculated variables ...

    // Helper: Project 3D (col, layer, row) to 2D (x, y)
    // col: 1..cols (X), layer: 1..layers (Y), row: 1..rows (Z)
    const project = (c: number, p: number, l: number) => {
        // Normalize 0..1
        const nX = (c - 1) / Math.max(cols - 1, 1);
        
        // Y depends on p
        // User Req: "Layer 1 at Bottom"
        // Canvas coords: 0 is Top, Max is Bottom.
        // We want p=1 to be at Max Y (Bottom).
        // We want p=layers to be at Min Y (Top).
        // If p=1 -> nY should be 0 (for bottom).
        // Wait, baseY = startY - nY * frontH.
        // startY is bottom of front face.
        // If we want p=1 at bottom, then nY should be 0.
        // (p - 1) / max -> 0/max = 0. Correct.
        // If p=layers -> nY = 1.
        // baseY = startY - 1 * frontH = Top. Correct.
        const nY = (p - 1) / Math.max(layers - 1, 1);

        // Z depends on l
        // User Req: "Row 1 at Front"
        // In oblique: l=1 -> z=0 (Front). l=rows -> z=Max (Back).
        // nZ = (l-1)/max -> 0 for l=1. Correct.
        const nZ = (l - 1) / Math.max(rows - 1, 1);
        
        // Base Front Face
        const baseX = startX + nX * frontW;
        const baseY = startY - nY * frontH;
        
        // Add Z offset
        const x = baseX + nZ * zVecX;
        const y = baseY + nZ * zVecY;
        
        return { x, y };
    };

    // Helper: Get Color
    const getColor = (val: number) => {
        if (val < 10) return "#3b82f6";
        if (val < 20) return "#22c55e";
        if (val < 30) return "#eab308";
        return "#ef4444";
    };

    // --- Draw Background Box ---
    // Back Face
    ctx.fillStyle = "#fefce8"; // yellow-50
    ctx.strokeStyle = "#eab308"; // yellow-500
    ctx.lineWidth = 1;

    const p000 = project(1, layers, 1); // Front-Bottom-Left
    const p100 = project(cols, layers, 1); // Front-Bottom-Right
    const p010 = project(1, 1, 1); // Front-Top-Left
    const p110 = project(cols, 1, 1); // Front-Top-Right
    
    const p001 = project(1, layers, rows); // Back-Bottom-Left
    const p101 = project(cols, layers, rows); // Back-Bottom-Right
    const p011 = project(1, 1, rows); // Back-Top-Left
    const p111 = project(cols, 1, rows); // Back-Top-Right

    // Draw Floor (Bottom Face)
    ctx.beginPath();
    ctx.moveTo(p000.x, p000.y);
    ctx.lineTo(p100.x, p100.y);
    ctx.lineTo(p101.x, p101.y);
    ctx.lineTo(p001.x, p001.y);
    ctx.closePath();
    ctx.fillStyle = "#d1d5db"; // gray-300 floor
    ctx.fill();
    ctx.stroke();

    // Draw Back Wall
    ctx.beginPath();
    ctx.moveTo(p001.x, p001.y);
    ctx.lineTo(p101.x, p101.y);
    ctx.lineTo(p111.x, p111.y);
    ctx.lineTo(p011.x, p011.y);
    ctx.closePath();
    ctx.fillStyle = "#fef9c3"; // yellow-100
    ctx.fill();
    ctx.stroke();

    // Draw Left Wall
    ctx.beginPath();
    ctx.moveTo(p000.x, p000.y);
    ctx.lineTo(p001.x, p001.y);
    ctx.lineTo(p011.x, p011.y);
    ctx.lineTo(p010.x, p010.y);
    ctx.closePath();
    ctx.fillStyle = "#fefce8";
    ctx.fill();
    ctx.stroke();

    // Draw Right Wall (Wireframe only usually, but let's fill lightly)
    // ctx.beginPath();
    // ctx.moveTo(p100.x, p100.y);
    // ctx.lineTo(p101.x, p101.y);
    // ctx.lineTo(p111.x, p111.y);
    // ctx.lineTo(p110.x, p110.y);
    // ctx.closePath();
    // ctx.stroke();

    // Draw Top (Ceiling) - Wireframe (dashed)
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(p010.x, p010.y);
    ctx.lineTo(p110.x, p110.y);
    ctx.lineTo(p111.x, p111.y);
    ctx.lineTo(p011.x, p011.y);
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw Front Frame
    ctx.strokeRect(p010.x, p010.y, p110.x - p010.x, p000.y - p010.y);


    // --- Draw Data Points ---
    const drawData = () => {
        // Sort points by depth (Z) then Y so they overlap correctly?
        // Actually in oblique, Back points are drawn first.
        // Loop Z from rows down to 1? Or 1 to rows?
        // Back is rows (l=rows, nZ=1, z=Max). Front is 1 (l=1, nZ=0, z=0).
        // We should draw Back (rows) first, then Front (1).
        
        const pointsToDraw = [];
        
        for (let l = rows; l >= 1; l--) { // Draw back to front
            for (let i = 0; i < cols; i++) {
                 const c = startIdx + i;
                 for (let p = 1; p <= layers; p++) {
                    const val = map.get(`${c}-${l}-${p}`);
                    
                    // Filter Logic
                    let visible = true;
                    if (filter && filter.type !== 'all') {
                        if (filter.type === 'layer' && p !== filter.value) visible = false;
                        if (filter.type === 'col' && c !== filter.value) visible = false;
                        if (filter.type === 'row' && l !== filter.value) visible = false;
                    }
                    
                    if (visible) {
                        const pos = project(i + 1, p, l);
                        pointsToDraw.push({ x: pos.x, y: pos.y, val, key: `${c}-${l}-${p}` });
                    }
                 }
            }
        }
        
        // Render Points
        pointsToDraw.forEach(pt => {
            const size = 28; // Smaller size to avoid overlap
            const x = pt.x - size/2;
            const y = pt.y - size/2;
            
            // Box
            ctx.fillStyle = getColor(pt.val || 0);
            if (pt.val === undefined) ctx.fillStyle = "#e5e7eb"; // gray for no data
            
            ctx.fillRect(x, y, size, size);
            
            // Text
            ctx.fillStyle = "black";
            ctx.font = "9px Arial"; // Smaller font
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(pt.val !== undefined ? pt.val.toFixed(1) : "-", pt.x, pt.y);
        });
    };
    
    drawData();

  }, [cols, rows, layers, map, filter, startIdx]);

  // 3. HTML Labels (Overlay)
  // We need to calculate positions for labels too.
  // Re-implement simplified project for labels
  const getLabelPos = (type: 'col' | 'row' | 'layer', idx: number) => {
    // These constants must match the canvas drawing logic!
    // Since canvas resizes, this is tricky.
    // Better to use absolute positioning in %, or re-calc based on container size.
    // But container size changes.
    // Let's use inline styles calculated during render? No, React render cycle is separate from Canvas draw.
    // We can put labels in the same loop or state.
    
    // Simpler: Just render labels as React elements using state-stored metrics?
    // Or just guess roughly based on CSS %?
    // Accurate way: Use the same `project` math.
    // We can expose the projection function or pre-calculate label positions in a `useEffect` and store in state.
    return { left: 0, top: 0 }; 
  };
  
  // Let's store label positions in state to render them accurately
  const [labelPositions, setLabelPositions] = useState<{type: string, id: number, x: number, y: number}[]>([]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const W = container.clientWidth;
    const H = container.clientHeight;
    
    // Use EXACTLY the same logic as draw loop to ensure alignment
    const scaleFactor = Math.min(W, H) / 500;
    const margin = 60 * scaleFactor;
    const frontW = Math.min(W * 0.6, H * 0.6); 
    const frontH = frontW * 0.8; 
    const startX = (W - frontW) / 2 + (20 * scaleFactor); 
    const startY = H - margin - (40 * scaleFactor);
    const zDepth = 200 * scaleFactor; 
    const zAngle = -Math.PI / 4.5; 
    const zVecX = Math.cos(zAngle) * zDepth; 
    const zVecY = Math.sin(zAngle) * zDepth; 

    const project = (c: number, p: number, l: number) => {
        const nX = (c - 1) / Math.max(cols - 1, 1);
        const nY = (p - 1) / Math.max(layers - 1, 1);
        const nZ = (l - 1) / Math.max(rows - 1, 1);
        
        const baseX = startX + nX * frontW;
        const baseY = startY - nY * frontH;
        
        const x = baseX + nZ * zVecX;
        const y = baseY + nZ * zVecY;
        return { x, y };
    };

    const newLabels = [];

    // Col Labels (Bottom Front Edge)
    for(let i=0; i<cols; i++) {
        const c = startIdx + i;
        const pos = project(i + 1, 1, 1); // Bottom (p=1), Front row (l=1)
        newLabels.push({ type: 'col', id: c, x: pos.x, y: pos.y + (20 * scaleFactor) });
    }
    
    // Row Labels (Left Top Edge going deep)
    for(let r=1; r<=rows; r++) {
        const pos = project(1, layers, r); // Top (p=layers), Left col
        newLabels.push({ type: 'row', id: r, x: pos.x - (30 * scaleFactor), y: pos.y - (10 * scaleFactor) });
    }
    
    // Layer Labels (Front Left Edge)
    for(let p=1; p<=layers; p++) {
        const pos = project(1, p, 1); // Left col, Front row
        newLabels.push({ type: 'layer', id: p, x: pos.x - (30 * scaleFactor), y: pos.y });
    }
    
    setLabelPositions(newLabels);

  }, [cols, rows, layers, startIdx, canvasSize]); // Recalc on dimension change (window resize not handled for simplicity)

  return (
    <div ref={containerRef} className="w-full h-[500px] bg-white rounded-xl border border-gray-200 relative overflow-hidden">
        <canvas ref={canvasRef} className="block" />
        
        {/* Labels Overlay */}
        {labelPositions.map((lbl, idx) => {
            const isActive = filter?.type === lbl.type && filter.value === lbl.id;
            return (
                <div
                    key={`${lbl.type}-${lbl.id}`}
                    className={`absolute px-2 py-1 text-xs rounded shadow cursor-pointer transition-colors border
                        ${isActive ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-200 hover:border-indigo-400 hover:text-indigo-600'}
                    `}
                    style={{ left: lbl.x, top: lbl.y, transform: 'translate(-50%, -50%)' }}
                    onClick={() => setFilter({ type: lbl.type as any, value: lbl.id })}
                >
                    {lbl.id}{lbl.type === 'col' ? '列' : lbl.type === 'row' ? '排' : '层'}
                </div>
            );
        })}

        {/* Show All Button */}
        {filter?.type !== 'all' && (
           <div 
             className="absolute top-4 right-4 bg-white/90 p-2 rounded shadow text-xs cursor-pointer hover:bg-gray-100 border border-gray-200"
             onClick={() => setFilter({ type: 'all', value: 0 })}
           >
               显示全部
           </div>
       )}
    </div>
  );
}

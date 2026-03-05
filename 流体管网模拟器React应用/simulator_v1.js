import React, { useState, useEffect, useRef } from 'react';
import { Settings, MousePointer2, Plus, Trash2, Gauge, Grid3X3 } from 'lucide-react';

// --- 类型定义 ---

type Point = { x: number; y: number };

interface Pipe {
  id: string;
  start: Point;
  end: Point;
  width: number; // m
}

export default function App() {
  // --- 状态 ---
  const [pipes, setPipes] = useState<Pipe[]>([]);
  const [userNodes, setUserNodes] = useState<Record<string, number>>({});
  
  // 全局物理参数
  const [globalHeight, setGlobalHeight] = useState<number>(0.02); // 2cm
  const [viscosity, setViscosity] = useState<number>(0.001); // Pa*s
  
  // 交互状态：增加 'pressure' 模式
  const [mode, setMode] = useState<'select' | 'draw' | 'pressure'>('draw');
  const [selectedPipeId, setSelectedPipeId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoverInfo, setHoverInfo] = useState<{ x: number; y: number; pressure: number } | null>(null);
  const [dragStart, setDragStart] = useState<Point | null>(null);
  const [currentMouse, setCurrentMouse] = useState<Point | null>(null);

  // 默认管道宽度
  const [defaultWidth, setDefaultWidth] = useState<number>(0.05);

  // 计算结果缓存 (节点压力)
  const [nodePressures, setNodePressures] = useState<Record<string, number>>({});

  const svgRef = useRef<SVGSVGElement>(null);

  // --- 辅助函数 ---
  const GRID_SIZE = 40;
  const SCALE = 0.05;

  const ptKey = (p: Point) => `${p.x},${p.y}`;
  const snap = (val: number) => Math.round(val / GRID_SIZE) * GRID_SIZE;

  const getGridPoint = (e: React.MouseEvent): Point => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const CTM = svgRef.current.getScreenCTM();
    if (!CTM) return { x: 0, y: 0 };
    const clientX = e.clientX;
    const clientY = e.clientY;
    const x = (clientX - CTM.e) / CTM.a;
    const y = (clientY - CTM.f) / CTM.d;
    return { x: snap(x), y: snap(y) };
  };

  const getPipeLengthMeters = (p: Pipe) => {
      const dx = (p.end.x - p.start.x) / GRID_SIZE * SCALE;
      const dy = (p.end.y - p.start.y) / GRID_SIZE * SCALE;
      return Math.sqrt(dx*dx + dy*dy);
  };

  // --- 物理计算核心 ---
  const calculateResistance = (length: number, width: number, height: number, eta: number) => {
    if (width <= 0 || height <= 0) return Infinity;
    const term1 = 12 * eta * length;
    let denominatorTerm = 1 - 0.63 * (height / width);
    if (denominatorTerm <= 0.01) denominatorTerm = 0.01; 
    const term2 = 1 / (Math.pow(height, 3) * width);
    return (term1 / denominatorTerm) * term2;
  };

  useEffect(() => {
    const adjacency: Record<string, Array<{ target: string; resistance: number }>> = {};
    const allNodes = new Set<string>();

    pipes.forEach(pipe => {
      const u = ptKey(pipe.start);
      const v = ptKey(pipe.end);
      allNodes.add(u);
      allNodes.add(v);

      const dx = (pipe.end.x - pipe.start.x) / GRID_SIZE * SCALE;
      const dy = (pipe.end.y - pipe.start.y) / GRID_SIZE * SCALE;
      const L = Math.sqrt(dx*dx + dy*dy);
      const R = calculateResistance(L, pipe.width, globalHeight, viscosity);

      if (!adjacency[u]) adjacency[u] = [];
      if (!adjacency[v]) adjacency[v] = [];
      adjacency[u].push({ target: v, resistance: R });
      adjacency[v].push({ target: u, resistance: R });
    });

    let currentPressures: Record<string, number> = {};
    const fixedNodes = Object.keys(userNodes);

    if (fixedNodes.length === 0) {
      setNodePressures({});
      return;
    }

    const avgPressure = fixedNodes.reduce((sum, key) => sum + userNodes[key], 0) / fixedNodes.length;
    allNodes.forEach(key => {
      currentPressures[key] = (key in userNodes) ? userNodes[key] : avgPressure;
    });

    for (let iter = 0; iter < 100; iter++) {
      let maxChange = 0;
      const nextPressures = { ...currentPressures };

      allNodes.forEach(nodeId => {
        if (nodeId in userNodes) return;
        const neighbors = adjacency[nodeId];
        if (!neighbors || neighbors.length === 0) return;

        let sumConductance = 0;
        let sumFlowInput = 0;

        neighbors.forEach(n => {
          const conductance = 1 / n.resistance;
          sumConductance += conductance;
          sumFlowInput += currentPressures[n.target] * conductance;
        });

        if (sumConductance > 0) {
          const newP = sumFlowInput / sumConductance;
          const diff = Math.abs(newP - currentPressures[nodeId]);
          if (diff > maxChange) maxChange = diff;
          nextPressures[nodeId] = newP;
        }
      });
      currentPressures = nextPressures;
      if (maxChange < 1e-5) break;
    }
    setNodePressures(currentPressures);
  }, [pipes, userNodes, globalHeight, viscosity]);


  // --- 交互处理 ---

  const handleMouseDown = (e: React.MouseEvent) => {
    const pt = getGridPoint(e);
    const ptString = ptKey(pt);

    // 1. 设置压力模式：只选点，不选管
    if (mode === 'pressure') {
        setSelectedNodeId(ptString);
        setSelectedPipeId(null);
        return;
    }

    // 2. 选择模式：优先选点，其次选管
    if (mode === 'select') {
      const isNode = Object.keys(nodePressures).includes(ptString);
      if (isNode) {
          setSelectedNodeId(ptString);
          setSelectedPipeId(null);
          return;
      }

      // 检测管道点击
      if (!svgRef.current) return;
      const CTM = svgRef.current.getScreenCTM();
      if (!CTM) return;
      const mx = (e.clientX - CTM.e) / CTM.a;
      const my = (e.clientY - CTM.f) / CTM.d;

      let foundPipe = null;
      for (const pipe of pipes) {
        const minX = Math.min(pipe.start.x, pipe.end.x) - 5;
        const maxX = Math.max(pipe.start.x, pipe.end.x) + 5;
        const minY = Math.min(pipe.start.y, pipe.end.y) - 5;
        const maxY = Math.max(pipe.start.y, pipe.end.y) + 5;
        if (mx >= minX && mx <= maxX && my >= minY && my <= maxY) {
            foundPipe = pipe;
            break;
        }
      }

      if (foundPipe) {
        setSelectedPipeId(foundPipe.id);
        setSelectedNodeId(null);
      } else {
        setSelectedPipeId(null);
        setSelectedNodeId(null);
      }
    } else if (mode === 'draw') {
      setDragStart(pt);
      setCurrentMouse(pt);
      setSelectedNodeId(null);
      setSelectedPipeId(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const gridPt = getGridPoint(e);
    setCurrentMouse(gridPt);

    if (!svgRef.current) return;
    const CTM = svgRef.current.getScreenCTM();
    if (!CTM) return;
    const mx = (e.clientX - CTM.e) / CTM.a;
    const my = (e.clientY - CTM.f) / CTM.d;

    let foundInfo = null;

    // 只有在非绘制状态下才显示Hover
    if (!dragStart && mode !== 'draw') {
        for (const pipe of pipes) {
            const isHoriz = Math.abs(pipe.start.y - pipe.end.y) < 1;
            const tolerance = 8;
            let onPipe = false;
            let progress = 0; 

            if (isHoriz) {
                if (Math.abs(my - pipe.start.y) < tolerance) {
                    const minX = Math.min(pipe.start.x, pipe.end.x);
                    const maxX = Math.max(pipe.start.x, pipe.end.x);
                    if (mx >= minX && mx <= maxX) {
                        onPipe = true;
                        const len = maxX - minX;
                        progress = len === 0 ? 0 : (mx - pipe.start.x) / (pipe.end.x - pipe.start.x); 
                    }
                }
            } else {
                 if (Math.abs(mx - pipe.start.x) < tolerance) {
                    const minY = Math.min(pipe.start.y, pipe.end.y);
                    const maxY = Math.max(pipe.start.y, pipe.end.y);
                    if (my >= minY && my <= maxY) {
                        onPipe = true;
                        const len = maxY - minY;
                        progress = len === 0 ? 0 : (my - pipe.start.y) / (pipe.end.y - pipe.start.y);
                    }
                }
            }

            if (onPipe) {
                const pStart = nodePressures[ptKey(pipe.start)] ?? 0;
                const pEnd = nodePressures[ptKey(pipe.end)] ?? 0;
                const currentP = pStart + (pEnd - pStart) * progress;
                foundInfo = { x: e.clientX, y: e.clientY, pressure: currentP };
                break;
            }
        }
    }
    setHoverInfo(foundInfo);
  };

  const handleMouseUp = () => {
    if (mode === 'draw' && dragStart && currentMouse) {
      if (dragStart.x !== currentMouse.x || dragStart.y !== currentMouse.y) {
        const dx = Math.abs(currentMouse.x - dragStart.x);
        const dy = Math.abs(currentMouse.y - dragStart.y);
        const endPoint = { ...currentMouse };
        if (dx > dy) endPoint.y = dragStart.y;
        else endPoint.x = dragStart.x;

        const newPipe: Pipe = {
          id: Math.random().toString(36).substr(2, 9),
          start: dragStart,
          end: endPoint,
          width: defaultWidth
        };
        setPipes([...pipes, newPipe]);
      }
    }
    setDragStart(null);
  };

  const deleteSelected = () => {
    if (selectedPipeId) {
      setPipes(pipes.filter(p => p.id !== selectedPipeId));
      setSelectedPipeId(null);
    }
    if (selectedNodeId) {
        const newNodes = { ...userNodes };
        delete newNodes[selectedNodeId];
        setUserNodes(newNodes);
        setSelectedNodeId(null);
    }
  };

  const updateSelectedPipeWidth = (w: number) => {
    if (!selectedPipeId) return;
    setPipes(pipes.map(p => p.id === selectedPipeId ? { ...p, width: w } : p));
  };

  const updateSelectedNodePressure = (val: string) => {
      if (!selectedNodeId) return;
      if (val === '') {
         // 允许清空输入框，但不写入NaN
         return; 
      }
      const num = parseFloat(val);
      if (!isNaN(num)) {
          setUserNodes({ ...userNodes, [selectedNodeId]: num });
      }
  };

  return (
    <div className="flex h-screen w-full bg-gray-50 text-slate-800 font-sans overflow-hidden">
      {/* 左侧控制面板 */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col shadow-lg z-10">
        <div className="p-4 border-b border-gray-100">
          <h1 className="text-xl font-bold flex items-center gap-2 text-blue-600">
            <Settings className="w-6 h-6" />
            管网阻力模拟
          </h1>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* 全局设置 */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">全局参数</h3>
            <div className="grid grid-cols-2 gap-2">
                <div>
                    <label className="text-xs text-gray-500">管道高 h(m)</label>
                    <input 
                        type="number" step="0.001" min="0.001"
                        value={globalHeight}
                        onChange={(e) => setGlobalHeight(parseFloat(e.target.value))}
                        className="w-full px-2 py-1 border rounded text-sm outline-none focus:border-blue-500"
                    />
                </div>
                <div>
                    <label className="text-xs text-gray-500">粘度 η(Pa·s)</label>
                    <input 
                        type="number" step="0.0001" min="0.000001"
                        value={viscosity}
                        onChange={(e) => setViscosity(parseFloat(e.target.value))}
                        className="w-full px-2 py-1 border rounded text-sm outline-none focus:border-blue-500"
                    />
                </div>
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* 工具箱 */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">模式选择</h3>
            <div className="flex flex-col gap-2">
              <button 
                onClick={() => setMode('draw')}
                className={`flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors ${mode === 'draw' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
              >
                <Plus className="w-4 h-4" />
                <span>1. 绘制管道</span>
              </button>
              
               <button 
                onClick={() => setMode('pressure')}
                className={`flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors ${mode === 'pressure' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
              >
                <Gauge className="w-4 h-4" />
                <span>2. 设置端口压力</span>
              </button>

              <button 
                onClick={() => setMode('select')}
                className={`flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors ${mode === 'select' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
              >
                <MousePointer2 className="w-4 h-4" />
                <span>3. 调整尺寸/删除</span>
              </button>
            </div>

            {/* 模式说明区 */}
            <div className="bg-slate-50 p-3 rounded text-xs text-slate-600 border border-slate-100 mt-2 min-h-[80px]">
                {mode === 'draw' && (
                    <>
                        <p className="font-bold mb-1">绘制模式：</p>
                        在右侧网格拖拽鼠标绘制直线管道。
                        <div className="mt-2 flex items-center gap-2">
                            <span>默认宽(m):</span>
                            <input 
                                type="number" step="0.01" min="0.001"
                                value={defaultWidth}
                                onChange={(e) => setDefaultWidth(parseFloat(e.target.value))}
                                className="w-16 px-1 py-0.5 border rounded"
                            />
                        </div>
                    </>
                )}
                {mode === 'pressure' && (
                    <>
                        <p className="font-bold mb-1">压力设置模式：</p>
                        点击网格上的任意点，在下方输入该点的压力值（Pa）。
                    </>
                )}
                {mode === 'select' && (
                    <>
                        <p className="font-bold mb-1">编辑模式：</p>
                        点击管道修改宽度，或点击已设置压力的点进行修改/删除。
                    </>
                )}
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* 属性编辑区 (Sidebar) */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
                {selectedNodeId ? '端口压力设置' : selectedPipeId ? '管道参数设置' : '当前选中'}
            </h3>
            
            {selectedPipeId && (
              <div className="bg-white p-3 rounded border border-gray-200 shadow-sm space-y-3 animate-in fade-in slide-in-from-left-2">
                <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                    <span className="text-xs font-bold text-gray-500">管道 #{selectedPipeId}</span>
                    <button onClick={deleteSelected} className="text-red-500 hover:bg-red-50 p-1 rounded transition-colors" title="删除管道">
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
                {(() => {
                    const p = pipes.find(p => p.id === selectedPipeId)!;
                    const len = getPipeLengthMeters(p);
                    const res = calculateResistance(len, p.width, globalHeight, viscosity);
                    return (
                        <div className="space-y-2">
                           <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                    <label className="text-gray-500 block mb-1">宽度 w (m)</label>
                                    <input 
                                        type="number" step="0.005"
                                        value={p.width}
                                        onChange={(e) => updateSelectedPipeWidth(parseFloat(e.target.value))}
                                        className="w-full p-1 border rounded focus:border-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-gray-500 block mb-1">长度 L (m)</label>
                                    <div className="p-1 bg-gray-100 rounded text-gray-600">{len.toFixed(3)}</div>
                                </div>
                           </div>
                           <div className="bg-slate-50 p-2 rounded border border-slate-100 text-xs">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">阻力 R:</span>
                                    <span className="font-mono">{res.toExponential(2)}</span>
                                </div>
                           </div>
                        </div>
                    );
                })()}
              </div>
            )}

            {selectedNodeId && (
                <div className="bg-yellow-50 p-3 rounded border border-yellow-200 shadow-sm space-y-3 animate-in fade-in slide-in-from-left-2">
                     <div className="flex justify-between items-center pb-2 border-b border-yellow-100">
                        <span className="text-xs font-bold text-yellow-800">节点 ({selectedNodeId})</span>
                        {(selectedNodeId in userNodes) && (
                            <button onClick={deleteSelected} className="text-red-500 hover:bg-red-50 p-1 rounded transition-colors" title="移除压力源">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                    <div>
                        <label className="text-xs text-yellow-700 block mb-1">设定压力 P (Pa)</label>
                        <div className="flex items-center gap-2">
                            <input 
                                type="number"
                                autoFocus
                                value={userNodes[selectedNodeId] ?? ''}
                                onChange={(e) => updateSelectedNodePressure(e.target.value)}
                                className="flex-1 px-2 py-1.5 border border-yellow-300 rounded text-sm focus:ring-2 focus:ring-yellow-500 outline-none"
                                placeholder="输入数值..."
                            />
                        </div>
                        <p className="text-[10px] text-yellow-600 mt-2 leading-tight">
                            输入数值后，该点将作为恒压源驱动流体。清空数值或点击垃圾桶可移除压力源。
                        </p>
                    </div>
                </div>
            )}

            {!selectedPipeId && !selectedNodeId && (
              <div className="text-xs text-gray-400 italic text-center py-8 border border-dashed rounded bg-gray-50">
                {mode === 'pressure' ? '请点击右侧网格点设置压力' : '未选中任何对象'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 主画布区域 */}
      <div className="flex-1 relative bg-[#f8fafc] overflow-hidden cursor-crosshair">
        
        {/* Hover Tooltip */}
        {hoverInfo && (
            <div 
                className="fixed pointer-events-none z-50 bg-slate-800 text-white text-xs px-2 py-1 rounded shadow-lg transform -translate-x-1/2 -translate-y-full mt-[-10px]"
                style={{ left: hoverInfo.x, top: hoverInfo.y }}
            >
                P = {hoverInfo.pressure.toFixed(2)} Pa
            </div>
        )}

        <svg 
            ref={svgRef}
            className="w-full h-full touch-none"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
          <defs>
            <pattern id="grid" width={GRID_SIZE} height={GRID_SIZE} patternUnits="userSpaceOnUse">
              <path d={`M ${GRID_SIZE} 0 L 0 0 0 ${GRID_SIZE}`} fill="none" stroke="#e2e8f0" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />

          {/* 绘制管道 */}
          {pipes.map(pipe => {
              const isSelected = selectedPipeId === pipe.id;
              const p1 = nodePressures[ptKey(pipe.start)] ?? 0;
              const p2 = nodePressures[ptKey(pipe.end)] ?? 0;
              const avgP = (p1 + p2) / 2;
              const maxP = Math.max(...Object.values(nodePressures), 1);
              const opacity = Math.min(1, Math.max(0.2, avgP / maxP));
              const pipeWidthPx = Math.max(4, pipe.width * 200);

              return (
                  <g key={pipe.id} className="group">
                    <line 
                        x1={pipe.start.x} y1={pipe.start.y}
                        x2={pipe.end.x} y2={pipe.end.y}
                        stroke={`rgba(59, 130, 246, ${opacity})`}
                        strokeWidth={pipeWidthPx}
                        strokeLinecap="butt"
                    />
                    <line 
                        x1={pipe.start.x} y1={pipe.start.y}
                        x2={pipe.end.x} y2={pipe.end.y}
                        stroke={isSelected ? "#f59e0b" : "transparent"}
                        strokeWidth={pipeWidthPx + 6}
                        strokeOpacity={isSelected ? 0.5 : 0}
                        className="transition-all"
                    />
                    <text 
                        x={(pipe.start.x + pipe.end.x) / 2} 
                        y={(pipe.start.y + pipe.end.y) / 2 - pipeWidthPx/2 - 5} 
                        textAnchor="middle" 
                        className="text-[10px] fill-slate-500 pointer-events-none select-none opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        L:{getPipeLengthMeters(pipe).toFixed(2)} w:{pipe.width}
                    </text>
                  </g>
              );
          })}

          {/* 绘制预览线 */}
          {mode === 'draw' && dragStart && currentMouse && (
             <line
                x1={dragStart.x} y1={dragStart.y}
                x2={Math.abs(currentMouse.x - dragStart.x) > Math.abs(currentMouse.y - dragStart.y) ? currentMouse.x : dragStart.x}
                y2={Math.abs(currentMouse.x - dragStart.x) > Math.abs(currentMouse.y - dragStart.y) ? dragStart.y : currentMouse.y}
                stroke="#3b82f6"
                strokeWidth="4"
                strokeDasharray="5,5"
                opacity="0.6"
              />
          )}

          {/* 绘制节点 */}
          {Object.keys(nodePressures).map(key => {
              const [x, y] = key.split(',').map(Number);
              const pressure = nodePressures[key];
              const isUserSet = key in userNodes;
              const isSelected = selectedNodeId === key;

              return (
                  <g key={key} transform={`translate(${x}, ${y})`} className="pointer-events-none">
                      <circle 
                        r={isUserSet ? 8 : 5} 
                        fill={isUserSet ? "#f59e0b" : "#94a3b8"} 
                        stroke={isSelected ? "#000" : "white"}
                        strokeWidth={2}
                        className="transition-all shadow-sm"
                      />
                      {isUserSet && (
                          <text y={-14} textAnchor="middle" className="text-[10px] font-bold fill-yellow-700 select-none">
                              {pressure}Pa
                          </text>
                      )}
                  </g>
              );
          })}

          {/* 交互辅助：选中光标 */}
          {(mode === 'pressure' || mode === 'select') && currentMouse && !dragStart && (
             <g transform={`translate(${currentMouse.x}, ${currentMouse.y})`}>
                 <rect 
                    x="-10" y="-10" width="20" height="20" 
                    fill="none" 
                    stroke={mode === 'pressure' ? "#f59e0b" : "#ef4444"} 
                    strokeWidth="1.5" 
                    strokeDasharray="3,2"
                    className="pointer-events-none animate-pulse"
                 />
                 <line x1="-14" y1="0" x2="14" y2="0" stroke={mode === 'pressure' ? "#f59e0b" : "#ef4444"} strokeWidth="0.5" strokeOpacity="0.5" />
                 <line x1="0" y1="-14" x2="0" y2="14" stroke={mode === 'pressure' ? "#f59e0b" : "#ef4444"} strokeWidth="0.5" strokeOpacity="0.5" />
             </g>
          )}

          {selectedNodeId && (
            (() => {
                const [sx, sy] = selectedNodeId.split(',').map(Number);
                return (
                    <g transform={`translate(${sx}, ${sy})`}>
                        <rect x="-12" y="-12" width="24" height="24" fill="none" stroke="#f59e0b" strokeWidth="2" />
                    </g>
                );
            })()
          )}

        </svg>

        {/* 覆盖层提示 */}
        <div className="absolute top-4 right-4 bg-white/90 backdrop-blur p-2 rounded shadow text-xs text-gray-500 pointer-events-none">
            Scale: 1 格 = {SCALE} m
        </div>
      </div>
    </div>
  );
}
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Settings, MousePointer2, Plus, Trash2, Info, ArrowRight, Grid3X3, X, Target } from 'lucide-react';

// --- 类型定义 ---

type Point = { x: number; y: number };

interface Pipe {
  id: string;
  start: Point;
  end: Point;
  width: number; // m
}

interface Node {
  id: string;
  x: number;
  y: number;
  pressure: number | null;
  isFixed: boolean;
}

interface SimulationState {
  pipes: Pipe[];
  userNodes: Record<string, number>;
  globalHeight: number;
  viscosity: number;
}

// --- 常量 ---
const GRID_SIZE = 40; // 屏幕像素
const SCALE = 0.05; // 1个网格单位 = 多少米

export default function App() {
  // --- 状态 ---
  const [pipes, setPipes] = useState<Pipe[]>([]);
  const [userNodes, setUserNodes] = useState<Record<string, number>>({});
  
  // 全局物理参数
  const [globalHeight, setGlobalHeight] = useState<number>(0.02);
  const [viscosity, setViscosity] = useState<number>(0.001);
  
  // 交互状态 - 新增 'pressure' 模式
  const [mode, setMode] = useState<'select' | 'draw' | 'pressure'>('draw');
  const [selectedPipeId, setSelectedPipeId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoverInfo, setHoverInfo] = useState<{ x: number; y: number; pressure: number } | null>(null);
  const [dragStart, setDragStart] = useState<Point | null>(null);
  const [currentMouse, setCurrentMouse] = useState<Point | null>(null);

  // 默认管道宽度和压力值
  const [defaultWidth, setDefaultWidth] = useState<number>(0.05);
  const [defaultPressure, setDefaultPressure] = useState<number>(1000); // 新增：默认压力值

  // 计算结果缓存
  const [nodePressures, setNodePressures] = useState<Record<string, number>>({});

  // SVG 引用
  const svgRef = useRef<SVGSVGElement>(null);

  // --- 辅助函数 ---

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
      if (key in userNodes) {
        currentPressures[key] = userNodes[key];
      } else {
        currentPressures[key] = avgPressure;
      }
    });

    const ITERATIONS = 100;
    
    for (let iter = 0; iter < ITERATIONS; iter++) {
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

    if (mode === 'pressure') {
      // 压力设置模式：直接在点击位置添加/修改压力点
      setUserNodes({
        ...userNodes,
        [ptString]: defaultPressure
      });
      setSelectedNodeId(ptString);
      return;
    }

    if (mode === 'select') {
      // 检查是否点击了节点
      const isNode = Object.keys(nodePressures).includes(ptString);
      
      if (isNode) {
        setSelectedNodeId(ptString);
        setSelectedPipeId(null);
        return;
      }

      // 检查管道
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

    if (!dragStart && mode === 'select' && !selectedNodeId) {
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
          
          foundInfo = {
            x: e.clientX,
            y: e.clientY,
            pressure: currentP
          };
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
        if (dx > dy) {
          endPoint.y = dragStart.y;
        } else {
          endPoint.x = dragStart.x;
        }

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
    const num = parseFloat(val);
    if (!isNaN(num)) {
      setUserNodes({
        ...userNodes,
        [selectedNodeId]: num
      });
    }
  };

  const getPipeLengthMeters = (p: Pipe) => {
    const dx = (p.end.x - p.start.x) / GRID_SIZE * SCALE;
    const dy = (p.end.y - p.start.y) / GRID_SIZE * SCALE;
    return Math.sqrt(dx*dx + dy*dy);
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
          <p className="text-xs text-gray-500 mt-1">2D 流体压力分布与阻力计算器</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          
          {/* 全局设置 */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">全局流体参数</h3>
            
            <div className="space-y-1">
              <label className="text-xs text-gray-500">管道高度 h (m)</label>
              <input 
                type="number" step="0.001" min="0.001"
                value={globalHeight}
                onChange={(e) => setGlobalHeight(parseFloat(e.target.value))}
                className="w-full px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-gray-500">流体粘度 η (Pa·s)</label>
              <input 
                type="number" step="0.0001" min="0.000001"
                value={viscosity}
                onChange={(e) => setViscosity(parseFloat(e.target.value))}
                className="w-full px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* 工具栏 - 添加压力模式 */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">工具箱</h3>
            <div className="grid grid-cols-3 gap-2">
              <button 
                onClick={() => setMode('select')}
                className={`py-2 rounded flex flex-col items-center justify-center text-xs transition-colors ${mode === 'select' ? 'bg-blue-100 text-blue-700 font-medium' : 'bg-gray-100 hover:bg-gray-200'}`}
              >
                <MousePointer2 className="w-5 h-5 mb-1" />
                选择
              </button>
              <button 
                onClick={() => setMode('draw')}
                className={`py-2 rounded flex flex-col items-center justify-center text-xs transition-colors ${mode === 'draw' ? 'bg-blue-100 text-blue-700 font-medium' : 'bg-gray-100 hover:bg-gray-200'}`}
              >
                <Plus className="w-5 h-5 mb-1" />
                绘制
              </button>
              <button 
                onClick={() => setMode('pressure')}
                className={`py-2 rounded flex flex-col items-center justify-center text-xs transition-colors ${mode === 'pressure' ? 'bg-green-100 text-green-700 font-medium' : 'bg-gray-100 hover:bg-gray-200'}`}
              >
                <Target className="w-5 h-5 mb-1" />
                压力
              </button>
            </div>
            
            {mode === 'select' && (
              <div className="bg-indigo-50 p-3 rounded text-xs text-indigo-800 border border-indigo-100">
                <p className="font-semibold mb-1 flex items-center gap-1">
                  <Grid3X3 className="w-3 h-3"/> 操作指南：
                </p>
                1. <strong>点击节点</strong>：选中后可编辑压力值<br/>
                2. <strong>点击管道</strong>：选中后可调整宽度
              </div>
            )}
            
            {mode === 'draw' && (
              <div className="bg-blue-50 p-3 rounded text-xs text-blue-800 border border-blue-100">
                <p className="font-semibold mb-1">提示：</p>
                拖拽鼠标绘制直线管道
                <div className="mt-2">
                  <label className="block text-blue-600 mb-1">默认宽度 w (m):</label>
                  <input 
                    type="number" step="0.01" min="0.001"
                    value={defaultWidth}
                    onChange={(e) => setDefaultWidth(parseFloat(e.target.value))}
                    className="w-full px-2 py-1 border border-blue-200 rounded text-sm"
                  />
                </div>
              </div>
            )}

            {mode === 'pressure' && (
              <div className="bg-green-50 p-3 rounded text-xs text-green-800 border border-green-100">
                <p className="font-semibold mb-1 flex items-center gap-1">
                  <Target className="w-3 h-3"/> 压力设置模式：
                </p>
                点击画布上的任意网格点设置压力
                <div className="mt-2">
                  <label className="block text-green-600 mb-1">默认压力值 (Pa):</label>
                  <input 
                    type="number" step="100"
                    value={defaultPressure}
                    onChange={(e) => setDefaultPressure(parseFloat(e.target.value))}
                    className="w-full px-2 py-1 border border-green-200 rounded text-sm"
                  />
                </div>
                <div className="mt-2 text-[10px] text-green-600 bg-green-100/50 p-2 rounded">
                  💡 提示：设置后可切换到选择模式进行微调
                </div>
              </div>
            )}
          </div>

          <hr className="border-gray-100" />

          {/* 选中对象属性 */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">选中属性</h3>
            
            {selectedPipeId ? (
              <div className="bg-gray-50 p-3 rounded border border-gray-200 space-y-3 animate-in fade-in slide-in-from-left-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">管道 #{selectedPipeId.substring(0, 6)}</span>
                  <button onClick={deleteSelected} className="text-red-500 hover:bg-red-50 p-1 rounded">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                
                {(() => {
                  const p = pipes.find(p => p.id === selectedPipeId)!;
                  const len = getPipeLengthMeters(p);
                  const res = calculateResistance(len, p.width, globalHeight, viscosity);
                  return (
                    <>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <label className="text-gray-500">宽度 w (m)</label>
                          <input 
                            type="number" step="0.005"
                            value={p.width}
                            onChange={(e) => updateSelectedPipeWidth(parseFloat(e.target.value))}
                            className="w-full mt-1 p-1 border rounded"
                          />
                        </div>
                        <div>
                          <label className="text-gray-500">长度 L (m)</label>
                          <div className="mt-1 p-1 bg-gray-100 rounded text-gray-600 cursor-not-allowed">{len.toFixed(3)}</div>
                        </div>
                      </div>
                      <div className="bg-white p-2 rounded border text-xs space-y-1">
                        <div className="flex justify-between">
                          <span className="text-gray-500">阻力 R:</span>
                          <span className="font-mono font-medium">{res.toExponential(2)}</span>
                        </div>
                        <div className="text-[10px] text-gray-400">Pa·s/m³</div>
                      </div>
                    </>
                  );
                })()}
              </div>
            ) : selectedNodeId ? (
              <div className="bg-yellow-50 p-3 rounded border border-yellow-200 space-y-3 animate-in fade-in slide-in-from-left-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">压力节点</span>
                  <button onClick={deleteSelected} className="text-red-500 hover:bg-red-50 p-1 rounded">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">位置</label>
                    <div className="text-xs font-mono bg-gray-100 p-2 rounded">
                      ({selectedNodeId})
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">压力值 (Pa)</label>
                    <input 
                      type="number"
                      value={userNodes[selectedNodeId] ?? ''}
                      onChange={(e) => updateSelectedNodePressure(e.target.value)}
                      className="w-full px-2 py-1 border border-yellow-300 rounded text-sm focus:ring-2 focus:ring-yellow-500 outline-none"
                      placeholder="输入压力值"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-400 italic text-center py-4">
                未选中任何对象
              </div>
            )}
          </div>

          {/* 压力点列表 */}
          {Object.keys(userNodes).length > 0 && (
            <>
              <hr className="border-gray-100" />
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
                  压力点列表 ({Object.keys(userNodes).length})
                </h3>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {Object.entries(userNodes).map(([key, value]) => (
                    <div 
                      key={key}
                      onClick={() => {
                        setSelectedNodeId(key);
                        setSelectedPipeId(null);
                        setMode('select');
                      }}
                      className={`flex justify-between items-center p-2 rounded text-xs cursor-pointer transition-colors ${
                        selectedNodeId === key 
                          ? 'bg-yellow-100 border border-yellow-300' 
                          : 'bg-gray-50 hover:bg-gray-100 border border-transparent'
                      }`}
                    >
                      <span className="font-mono text-gray-600">({key})</span>
                      <span className="font-medium text-gray-800">{value} Pa</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 主画布区域 */}
      <div className="flex-1 relative bg-[#f8fafc] overflow-hidden cursor-crosshair">
        
        {/* Hover Tooltip */}
        {hoverInfo && !selectedNodeId && (
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
                  style={{ fontSize: '10px' }}
                >
                  L:{getPipeLengthMeters(pipe).toFixed(2)}m w:{pipe.width}m
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
                    {pressure.toFixed(0)}Pa
                  </text>
                )}
              </g>
            );
          })}

          {/* 压力模式光标提示 */}
          {mode === 'pressure' && currentMouse && (
            <g transform={`translate(${currentMouse.x}, ${currentMouse.y})`}>
              <circle 
                r="12" 
                fill="none" 
                stroke="#10b981" 
                strokeWidth="2" 
                strokeDasharray="4,2"
                className="pointer-events-none animate-pulse"
              />
              <circle 
                r="4" 
                fill="#10b981" 
                className="pointer-events-none"
              />
              <line x1="-18" y1="0" x2="18" y2="0" stroke="#10b981" strokeWidth="1" strokeOpacity="0.5" />
              <line x1="0" y1="-18" x2="0" y2="18" stroke="#10b981" strokeWidth="1" strokeOpacity="0.5" />
            </g>
          )}

          {/* 选择模式光标 */}
          {mode === 'select' && currentMouse && !dragStart && (
            <g transform={`translate(${currentMouse.x}, ${currentMouse.y})`}>
              <rect 
                x="-10" y="-10" width="20" height="20" 
                fill="none" 
                stroke="#ef4444" 
                strokeWidth="1.5" 
                strokeDasharray="3,2"
                className="pointer-events-none animate-pulse"
              />
              <line x1="-14" y1="0" x2="14" y2="0" stroke="#ef4444" strokeWidth="0.5" strokeOpacity="0.5" />
              <line x1="0" y1="-14" x2="0" y2="14" stroke="#ef4444" strokeWidth="0.5" strokeOpacity="0.5" />
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

        {/* 模式指示器 */}
        <div className="absolute top-4 right-4 bg-white/90 backdrop-blur p-3 rounded-lg shadow-lg text-xs pointer-events-none">
          <div className="flex items-center gap-2 mb-2">
            {mode === 'draw' && <Plus className="w-4 h-4 text-blue-600" />}
            {mode === 'select' && <MousePointer2 className="w-4 h-4 text-blue-600" />}
            {mode === 'pressure' && <Target className="w-4 h-4 text-green-600" />}
            <span className="font-semibold text-gray-700">
              {mode === 'draw' && '绘制管道'}
              {mode === 'select' && '选择模式'}
              {mode === 'pressure' && '设置压力'}
            </span>
          </div>
          <div className="text-gray-500">
            Scale: 1 格 = {SCALE} m
          </div>
        </div>
      </div>
    </div>
  );
}

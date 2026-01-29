'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Rect, Text as KonvaText, Group, Circle } from 'react-konva';
import { v4 as uuid } from 'uuid';
import {
  FloorItem,
  FurnitureShape,
  FurnitureType,
  RoomShape,
  RoomType,
  computeMetrics,
  defaultEstimateConfig,
  toLayout,
  fromLayout,
} from './useFloorPlan';

type Props = {
  width?: number;
  height?: number;
  gridSize?: number;
  onChange?: (payload: { items: FloorItem[]; layout: ReturnType<typeof toLayout>; metrics: ReturnType<typeof computeMetrics> }) => void;
  initialLayout?: ReturnType<typeof toLayout>;
  estimateConfig?: Partial<typeof defaultEstimateConfig>;
};

const ROOM_TYPES: { label: string; type: RoomType; color: string }[] = [
  { label: 'Bedroom', type: 'bedroom', color: '#e0f2fe' },
  { label: 'Bathroom', type: 'bathroom', color: '#fee2e2' },
  { label: 'Kitchen', type: 'kitchen', color: '#fef9c3' },
  { label: 'Living', type: 'living', color: '#dcfce7' },
  { label: 'Laundry', type: 'laundry', color: '#ede9fe' },
];

const FURNITURE_TYPES: { label: string; type: FurnitureType; color: string }[] = [
  { label: 'Bed', type: 'bed', color: '#bfdbfe' },
  { label: 'Sofa', type: 'sofa', color: '#fecdd3' },
  { label: 'Table', type: 'table', color: '#fde68a' },
  { label: 'Desk', type: 'desk', color: '#ddd6fe' },
  { label: 'Toilet', type: 'toilet', color: '#fecaca' },
  { label: 'Shower', type: 'shower', color: '#c7d2fe' },
  { label: 'Fridge', type: 'fridge', color: '#bbf7d0' },
  { label: 'Oven', type: 'oven', color: '#fef3c7' },
  { label: 'Window', type: 'window', color: '#bae6fd' },
  { label: 'Clutter', type: 'clutter', color: '#fef2f2' },
];

export default function FloorPlanBuilder({
  width = 900,
  height = 520,
  gridSize = 25,
  onChange,
  initialLayout,
  estimateConfig,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [viewportWidth, setViewportWidth] = useState<number>(width);
  const [items, setItems] = useState<FloorItem[]>(() => (initialLayout ? fromLayout(initialLayout) : []));
  const cfg = useMemo(() => ({ ...defaultEstimateConfig, ...estimateConfig }), [estimateConfig]);
  const snap = useCallback((value: number) => Math.round(value / gridSize) * gridSize, [gridSize]);
  const stageRef = useRef<any>(null);
  const [scale, setScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setViewportWidth(el.clientWidth || width);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);

  const clampScale = (s: number) => Math.min(3, Math.max(0.4, s));
  const zoomTo = useCallback(
    (nextScale: number, pointer?: { x: number; y: number }) => {
      const stage = stageRef.current;
      if (!stage) {
        setScale(clampScale(nextScale));
        return;
      }
      const oldScale = scale;
      const newScale = clampScale(nextScale);
      const pos = pointer || { x: width / 2, y: height / 2 };
      const mousePointTo = {
        x: (pos.x - stagePos.x) / oldScale,
        y: (pos.y - stagePos.y) / oldScale,
      };
      const newPos = {
        x: pos.x - mousePointTo.x * newScale,
        y: pos.y - mousePointTo.y * newScale,
      };
      setScale(newScale);
      setStagePos(newPos);
    },
    [height, scale, stagePos.x, stagePos.y, width]
  );

  const handleWheel = useCallback(
    (e: any) => {
      e.evt.preventDefault();
      const direction = e.evt.deltaY > 0 ? -1 : 1;
      const scaleBy = 1.05;
      const stage = stageRef.current;
      const pointer = stage?.getPointerPosition();
      if (!pointer) return;
      const nextScale = direction > 0 ? scale * scaleBy : scale / scaleBy;
      zoomTo(nextScale, pointer);
    },
    [scale, zoomTo]
  );

  const handleZoomButton = (factor: number) => {
    zoomTo(scale * factor);
  };

  const overlaps = (a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }, pad = 6) => {
    return !(
      a.x + a.width + pad <= b.x ||
      b.x + b.width + pad <= a.x ||
      a.y + a.height + pad <= b.y ||
      b.y + b.height + pad <= a.y
    );
  };

  const findNonOverlappingPosition = (
    kind: 'room' | 'furniture',
    widthPx: number,
    heightPx: number
  ): { x: number; y: number } => {
    const step = gridSize;
    const maxX = Math.max(step, viewportWidth - widthPx - step);
    const maxY = Math.max(step, height - heightPx - step);
    const existingRooms = items.filter((i): i is RoomShape => i.kind === 'room');
    const existingFurniture = items.filter((i): i is FurnitureShape => i.kind === 'furniture');

    for (let yPos = step; yPos <= maxY; yPos += step) {
      for (let xPos = step; xPos <= maxX; xPos += step) {
        const candidate = { x: xPos, y: yPos, width: widthPx, height: heightPx };
        const collides =
          kind === 'room'
            ? existingRooms.some((r) => overlaps(candidate, r))
            : existingFurniture.some((f) => overlaps(candidate, f));
        if (!collides) {
          return { x: snap(xPos), y: snap(yPos) };
        }
      }
    }
    // Fallback: drop in top-left snapped
    return { x: snap(40), y: snap(40) };
  };

  const emit = useCallback(
    (next: FloorItem[]) => {
      const layout = toLayout(next);
      const metrics = computeMetrics(next, cfg);
      onChange?.({ items: next, layout, metrics });
    },
    [cfg, onChange]
  );

  const addRoom = (type: RoomType) => {
    const defaultSize: Record<RoomType, { w: number; h: number }> = {
      bedroom: { w: 180, h: 140 },
      bathroom: { w: 120, h: 100 },
      kitchen: { w: 200, h: 140 },
      living: { w: 220, h: 160 },
      laundry: { w: 120, h: 100 },
      hallway: { w: 180, h: 60 },
      other: { w: 150, h: 120 },
    };
    const size = defaultSize[type] ?? { w: 150, h: 120 };
    const pos = findNonOverlappingPosition('room', size.w, size.h);
    const room: RoomShape = {
      id: uuid(),
      kind: 'room',
      roomType: type,
      x: pos.x,
      y: pos.y,
      width: size.w,
      height: size.h,
    };
    const next = [...items, room];
    setItems(next);
    emit(next);
  };

  const addFurniture = (type: FurnitureType) => {
    const defaultSize: Record<FurnitureType, { w: number; h: number }> = {
      bed: { w: 80, h: 60 },
      sofa: { w: 90, h: 60 },
      table: { w: 60, h: 60 },
      desk: { w: 60, h: 40 },
      wardrobe: { w: 50, h: 50 },
      toilet: { w: 30, h: 30 },
      shower: { w: 40, h: 40 },
      fridge: { w: 40, h: 40 },
      oven: { w: 40, h: 40 },
      window: { w: 80, h: 10 },
      clutter: { w: 30, h: 30 },
      other: { w: 40, h: 40 },
    };
    const size = defaultSize[type] ?? { w: 40, h: 40 };
    const pos = findNonOverlappingPosition('furniture', size.w, size.h);
    const f: FurnitureShape = {
      id: uuid(),
      kind: 'furniture',
      furnitureType: type,
      x: pos.x,
      y: pos.y,
      width: size.w,
      height: size.h,
    };
    const next = [...items, f];
    setItems(next);
    emit(next);
  };

  const updateItem = (id: string, partial: Partial<FloorItem>) => {
    const next = items.map((i) => (i.id === id ? ({ ...i, ...partial } as FloorItem) : i));
    setItems(next);
    emit(next);
  };

  const deleteItem = (id: string) => {
    const next = items.filter((i) => i.id !== id);
    setItems(next);
    emit(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2 overflow-x-auto whitespace-nowrap pb-1 pr-1">
        {ROOM_TYPES.map((r) => (
          <button
            key={r.type}
            type="button"
            className="px-3 py-1 rounded-full border border-black/10 text-sm bg-white hover:border-emerald-600"
            onClick={() => addRoom(r.type)}
          >
            {r.label}
          </button>
        ))}
        {FURNITURE_TYPES.map((f) => (
          <button
            key={f.type}
            type="button"
            className="px-3 py-1 rounded-full border border-black/10 text-sm bg-white hover:border-emerald-600"
            onClick={() => addFurniture(f.type)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div ref={containerRef} className="relative rounded-2xl border border-black/10 bg-white/90">
        {(() => {
          const viewWidth = viewportWidth / scale;
          const viewHeight = height / scale;
          const worldLeft = -stagePos.x / scale;
          const worldTop = -stagePos.y / scale;
          const startX = Math.floor(worldLeft / gridSize) - 2;
          const endX = Math.floor((worldLeft + viewWidth) / gridSize) + 2;
          const startY = Math.floor(worldTop / gridSize) - 2;
          const endY = Math.floor((worldTop + viewHeight) / gridSize) + 2;
          return (
            <Stage
              ref={stageRef}
              width={viewportWidth}
              height={height}
              className="rounded-2xl"
              style={{ backgroundColor: '#f8fafc' }}
              scaleX={scale}
              scaleY={scale}
              x={stagePos.x}
              y={stagePos.y}
              draggable
              onDragEnd={(e) => setStagePos({ x: e.target.x(), y: e.target.y() })}
              onWheel={handleWheel}
            >
              <Layer>
                <Rect
                  x={(startX - 2) * gridSize}
                  y={(startY - 2) * gridSize}
                  width={(endX - startX + 4) * gridSize}
                  height={(endY - startY + 4) * gridSize}
                  fill="#f8fafc"
                />
                {Array.from({ length: endX - startX + 1 }).map((_, i) => {
                  const x = (startX + i) * gridSize;
                  return <Rect key={`v-${i}`} x={x} y={startY * gridSize} width={1} height={(endY - startY) * gridSize} fill="#e5e7eb" />;
                })}
                {Array.from({ length: endY - startY + 1 }).map((_, i) => {
                  const y = (startY + i) * gridSize;
                  return <Rect key={`h-${i}`} x={startX * gridSize} y={y} width={(endX - startX) * gridSize} height={1} fill="#e5e7eb" />;
                })}
              </Layer>
              <Layer>
                {items.map((item) => {
                  const isRoom = item.kind === 'room';
                  const color = isRoom
                    ? ROOM_TYPES.find((r) => r.type === (item as RoomShape).roomType)?.color || '#e5e7eb'
                    : FURNITURE_TYPES.find((f) => f.type === (item as FurnitureShape).furnitureType)?.color || '#f1f5f9';
                  return (
                    <Group
                      key={item.id}
                      draggable
                      x={item.x}
                      y={item.y}
                      onDragEnd={(e) =>
                        updateItem(item.id, {
                          x: snap(e.target.x()),
                          y: snap(e.target.y()),
                        })
                      }
                      onDblClick={() => deleteItem(item.id)}
                    >
                      <Rect width={item.width} height={item.height} fill={color} stroke="#1f2937" strokeWidth={1} cornerRadius={4} />
                      <KonvaText
                        text={isRoom ? (item as RoomShape).roomType : (item as FurnitureShape).furnitureType}
                        fontSize={12}
                        padding={4}
                        fill="#0f172a"
                      />
                      {/* Resize handle (bottom-right) */}
                      <Circle
                        x={item.width}
                        y={item.height}
                        radius={6}
                        fill="#0f172a"
                        draggable
                        onDragMove={(e) => {
                          const newW = Math.max(20, snap(e.target.x()));
                          const newH = Math.max(20, snap(e.target.y()));
                          updateItem(item.id, { width: newW, height: newH });
                        }}
                        onDragEnd={(e) => {
                          const newW = Math.max(20, snap(e.target.x()));
                          const newH = Math.max(20, snap(e.target.y()));
                          updateItem(item.id, { width: newW, height: newH });
                        }}
                      />
                    </Group>
                  );
                })}
              </Layer>
            </Stage>
          );
        })()}
        <div className="pointer-events-none absolute right-3 top-3 flex flex-col gap-2">
          <button
            type="button"
            className="pointer-events-auto rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm border border-black/10 hover:border-emerald-500"
            onClick={() => handleZoomButton(1.1)}
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            className="pointer-events-auto rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm border border-black/10 hover:border-emerald-500"
            onClick={() => handleZoomButton(0.9)}
            aria-label="Zoom out"
          >
            −
          </button>
        </div>
      </div>
    </div>
  );
}

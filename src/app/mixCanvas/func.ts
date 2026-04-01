import { type Canvas, Group, Polyline, type FabricObject } from "fabric";
import { globalRegistry, type FuncEntry } from "./registry";

/**
 * 位置参数
 */
type Position = { x: number; y: number };

/**
 * 绘制水平线
 * @param canvas - Fabric.js 画布
 * @param position - 位置 { x, y }
 * @param params - 其他参数 { width? }
 * @param isRender - 是否立即渲染
 */
export const drawHorizontalLine = (
  canvas: Canvas,
  position: Position,
  params: { width?: number } = {},
  isRender = true,
): FabricObject => {
  const width = params.width ?? 100;
  const line = new Polyline(
    [
      { x: position.x, y: position.y },
      { x: position.x + width, y: position.y },
    ],
    {
      stroke: "#FF6B6B",
      strokeWidth: 3,
      selectable: true,
      evented: true,
    },
  );
  if (isRender) {
    canvas.add(line);
    canvas.requestRenderAll();
  }
  return line;
};

/**
 * 绘制垂直线
 */
export const drawVerticalLine = (
  canvas: Canvas,
  position: Position,
  params: { height?: number } = {},
  isRender = true,
): FabricObject => {
  const height = params.height ?? 100;
  const line = new Polyline(
    [
      { x: position.x, y: position.y },
      { x: position.x, y: position.y + height },
    ],
    {
      stroke: "#4ECDC4",
      strokeWidth: 3,
      selectable: true,
      evented: true,
    },
  );
  if (isRender) {
    canvas.add(line);
    canvas.requestRenderAll();
  }
  return line;
};

/**
 * 绘制对角线
 */
export const drawDiagonalLine = (
  canvas: Canvas,
  position: Position,
  params: { distance?: number } = {},
  isRender = true,
): FabricObject => {
  const distance = params.distance ?? 50;
  const line = new Polyline(
    [
      { x: position.x, y: position.y },
      { x: position.x + distance, y: position.y + distance },
    ],
    {
      stroke: "#45B7D1",
      strokeWidth: 3,
      selectable: true,
      evented: true,
    },
  );
  if (isRender) {
    canvas.add(line);
    canvas.requestRenderAll();
  }
  return line;
};

/**
 * 绘制虚线
 */
export const drawDashedLine = (
  canvas: Canvas,
  position: Position,
  params: { width?: number } = {},
  isRender = true,
): FabricObject => {
  const width = params.width ?? 100;
  const line = new Polyline(
    [
      { x: position.x, y: position.y },
      { x: position.x + width, y: position.y },
    ],
    {
      stroke: "#96CEB4",
      strokeWidth: 3,
      strokeDashArray: [5, 5],
      selectable: true,
      evented: true,
    },
  );
  if (isRender) {
    canvas.add(line);
    canvas.requestRenderAll();
  }
  return line;
};

/**
 * 绘制全部（示例组合）
 */
export const drawAll = (
  canvas: Canvas,
  position: Position,
  params: Record<string, unknown> = {},
  isRender = true,
): FabricObject => {
  const { x, y } = position;
  const objects: FabricObject[] = [];

  const horizontalLine = drawHorizontalLine(canvas, { x, y }, { width: 100 }, false);
  const verticalLine = drawVerticalLine(
    canvas,
    { x: x + 20, y: y - 20 },
    {},
    false,
  );
  objects.push(horizontalLine, verticalLine);

  const group = new Group(objects, {
    left: x,
    top: y,
    selectable: true,
  });

  if (isRender) {
    canvas.add(group);
    canvas.requestRenderAll();
  }
  return group;
};

// 自动注册所有绘制函数
const allDrawFunc = {
  drawHorizontalLine,
  drawVerticalLine,
  drawDiagonalLine,
  drawDashedLine,
  drawAll,
};

globalRegistry.scanModule(
  allDrawFunc as unknown as Record<string, unknown>,
  (name) => name.startsWith("draw"),
);

/**
 * 获取所有可用的绘制函数
 * @returns 绘制函数列表
 */
export const getDrawFunctions = (): FuncEntry[] => globalRegistry.getAll();

import { type Canvas, Group, Polyline, type FabricObject } from "fabric";
import { type DrawParams, globalRegistry, type FuncEntry } from "./registry";

/**
 * 绘制水平线
 */
export const drawHorizontalLine = (
  canvas: Canvas,
  params: DrawParams,
  isRender = true,
): FabricObject => {
  const width = (params.width as number) ?? 100;
  const line = new Polyline(
    [
      { x: params.x, y: params.y },
      { x: params.x + width, y: params.y },
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
  params: DrawParams,
  isRender = true,
): FabricObject => {
  const height = 100;
  const line = new Polyline(
    [
      { x: params.x, y: params.y },
      { x: params.x, y: params.y + height },
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
  params: DrawParams,
  isRender = true,
): FabricObject => {
  const distance = 50;
  const line = new Polyline(
    [
      { x: params.x, y: params.y },
      { x: params.x + distance, y: params.y + distance },
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
  params: DrawParams,
  isRender = true,
): FabricObject => {
  const width = 100;
  const line = new Polyline(
    [
      { x: params.x, y: params.y },
      { x: params.x + width, y: params.y },
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
  params: DrawParams,
  isRender = true,
): FabricObject => {
  const { x, y } = params;
  const objects: FabricObject[] = [];

  const horizontalLine = drawHorizontalLine(canvas, { x, y, width: 100 }, false);
  const verticalLine = drawVerticalLine(
    canvas,
    { x: x + 20, y: y - 20 },
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

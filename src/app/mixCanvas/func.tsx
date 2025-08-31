import { type Canvas, Group, Line, type FabricObject } from 'fabric'

/**
 * 线条绘制参数接口
 */
export interface LineParams {
  x: number
  y: number
}

/**
 * 绘制函数接口
 */
export interface DrawFunction {
  name: string
  displayName: string
  execute: (canvas: Canvas, params: LineParams) => FabricObject | FabricObject[]
}

/**
 * 绘制水平线
 * @param canvas - Fabric.js 画布实例
 * @param params - 绘制参数
 * @returns 绘制的线条对象
 */
export const drawHorizontalLine = (canvas: Canvas, params: LineParams, isRender = true) => {
  const width = 100;
  const line = new Line([params.x, params.y, params.x + width, params.y], {
    stroke: '#FF6B6B',
    strokeWidth: 3,
    selectable: true,
    evented: true,
  })
  if (isRender) {
    canvas.add(line)
    canvas.requestRenderAll()
  }

  return line
}

/**
 * 绘制垂直线
 * @param canvas - Fabric.js 画布实例
 * @param params - 绘制参数
 * @returns 绘制的线条对象
 */
export const drawVerticalLine = (canvas: Canvas, params: LineParams, isRender = true) => {
  const height = 100;
  const line = new Line([params.x, params.y, params.x, params.y + height], {
    stroke: '#4ECDC4',
    strokeWidth: 3,
    selectable: true,
    evented: true,
  })
  if (isRender) {
    canvas.add(line)
    canvas.requestRenderAll()
  }
  return line
}

/**
 * 绘制对角线
 * @param canvas - Fabric.js 画布实例
 * @param params - 绘制参数
 * @returns 绘制的线条对象
 */
export const drawDiagonalLine = (canvas: Canvas, params: LineParams, isRender = true) => {
  const distance = 50;
  const line = new Line([params.x, params.y, params.x + distance, params.y + distance], {
    stroke: '#45B7D1',
    strokeWidth: 3,
    selectable: true,
    evented: true,
  })
  if (isRender) {
    canvas.add(line)
    canvas.requestRenderAll()
  }
  return line
}

/**
 * 绘制虚线
 * @param canvas - Fabric.js 画布实例
 * @param params - 绘制参数
 * @returns 绘制的线条对象
 */
export const drawDashedLine = (canvas: Canvas, params: LineParams, isRender = true) => {
  const width = 100;
  const line = new Line([params.x, params.y, params.x + width, params.y], {
    stroke: '#96CEB4',
    strokeWidth: 3,
    strokeDashArray: [5, 5],
    selectable: true,
    evented: true,
  })
  if (isRender) {
    canvas.add(line)
    canvas.requestRenderAll()
  }
  return line
}

export const drawAll = (canvas: Canvas, params: LineParams, isRender = true) => {
  const horizontalLine = drawHorizontalLine(canvas, params, false);
  const verticalLine = drawVerticalLine(canvas, params, false);

  // 2. 组合成一个 Group
  const group = new Group([horizontalLine, verticalLine], {
    left: params.x,
    top: params.y,
    selectable: true
  });
  if (isRender) {
    canvas.add(group);
    canvas.requestRenderAll()
  }

  return group;
}

/**
 * 获取所有可用的绘制函数
 * @returns 绘制函数列表
 */
export const getDrawFunctions = (): DrawFunction[] => [
  {
    displayName: '绘制横线',
    execute: drawHorizontalLine
  },
  {
    displayName: '绘制竖线',
    execute: drawVerticalLine
  },
  {
    displayName: '绘制对角线',
    execute: drawDiagonalLine
  },
  {
    displayName: '绘制虚线',
    execute: drawDashedLine
  },
  {
    displayName: '绘制全部',
    execute: drawAll,
  },
].map(item => ({ ...item, name: item.execute.name }))
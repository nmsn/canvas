"use client";

import type { Canvas } from "fabric";
import type {
  Connection,
  ConnectionOptions,
  ConnectionPluginOptions,
  PluginCanvasObject,
} from "./types";

const DEFAULT_OPTIONS: Required<ConnectionPluginOptions> = {
  lineColor: "#64748b",
  lineWidth: 1.5,
  curvature: 0.5,
  arrowSize: 0,
};

export class ConnectionPlugin {
  private readonly canvas: Canvas;
  private readonly options: Required<ConnectionPluginOptions>;
  private enabled = false;
  private connections: Connection[] = [];
  private readonly handleAfterRender = () => this.draw();

  constructor(canvas: Canvas, options: ConnectionPluginOptions = {}) {
    this.canvas = canvas;
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  enable() {
    if (this.enabled) return;
    this.enabled = true;
    this.canvas.on("after:render", this.handleAfterRender);
    this.canvas.requestRenderAll();
  }

  disable() {
    if (!this.enabled) return;
    this.enabled = false;
    this.canvas.off("after:render", this.handleAfterRender);
    this.clearOverlay();
    this.canvas.requestRenderAll();
  }

  isEnabled() {
    return this.enabled;
  }

  private clearOverlay() {
    const context = this.canvas.getTopContext();
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(
      0,
      0,
      this.canvas.upperCanvasEl.width,
      this.canvas.upperCanvasEl.height,
    );
    context.restore();
  }

  private draw() {
    if (!this.enabled) return;

    this.clearOverlay();
    const context = this.canvas.getTopContext();
    const zoom = this.canvas.getZoom() || 1;
    const viewportTransform = this.canvas.viewportTransform;

    context.save();

    if (viewportTransform) {
      context.transform(
        viewportTransform[0],
        viewportTransform[1],
        viewportTransform[2],
        viewportTransform[3],
        viewportTransform[4],
        viewportTransform[5],
      );
    }

    for (const conn of this.connections) {
      // 检查对象是否仍存在于画布
      if (!this.canvas.getObjects().includes(conn.from as unknown as import("fabric").FabricObject)) continue;
      if (!this.canvas.getObjects().includes(conn.to as unknown as import("fabric").FabricObject)) continue;

      const { startX, startY, endX, endY, cp1x, cp1y, cp2x, cp2y } =
        this.computeBezierPoints(conn);

      const lineColor = conn.options?.lineColor ?? this.options.lineColor;
      const lineWidth = (conn.options?.lineWidth ?? this.options.lineWidth) / zoom;

      context.strokeStyle = lineColor;
      context.lineWidth = lineWidth;
      context.setLineDash([]);

      context.beginPath();
      context.moveTo(startX, startY);
      context.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endX, endY);
      context.stroke();
    }

    context.restore();
  }

  private computeBezierPoints(conn: Connection): {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    cp1x: number;
    cp1y: number;
    cp2x: number;
    cp2y: number;
  } {
    const fromBounds = this.getSceneBounds(conn.from);
    const toBounds = this.getSceneBounds(conn.to);

    const srcCx = fromBounds.left + fromBounds.width / 2;
    const srcCy = fromBounds.top + fromBounds.height / 2;
    const tgtCx = toBounds.left + toBounds.width / 2;
    const tgtCy = toBounds.top + toBounds.height / 2;

    const curvature = conn.options?.curvature ?? this.options.curvature;

    let startX: number, startY: number, endX: number, endY: number;

    // 选择锚点 - 根据相对位置选择边缘中点
    if (tgtCx > srcCx) {
      // 源在左，目标在右 → 从源右边缘中点 到 目标左边缘中点
      startX = fromBounds.left + fromBounds.width;
      startY = fromBounds.top + fromBounds.height / 2;
      endX = toBounds.left;
      endY = toBounds.top + toBounds.height / 2;
    } else if (tgtCx < srcCx) {
      // 源在右，目标在左
      startX = fromBounds.left;
      startY = fromBounds.top + fromBounds.height / 2;
      endX = toBounds.left + toBounds.width;
      endY = toBounds.top + toBounds.height / 2;
    } else if (tgtCy > srcCy) {
      // 源在上，目标在下
      startX = srcCx;
      startY = fromBounds.top + fromBounds.height;
      endX = tgtCx;
      endY = toBounds.top;
    } else {
      // 源在下，目标在上
      startX = srcCx;
      startY = fromBounds.top;
      endX = tgtCx;
      endY = toBounds.top + toBounds.height;
    }

    // 计算控制点
    const distanceX = Math.abs(endX - startX);
    const distanceY = Math.abs(endY - startY);

    let cp1x: number, cp1y: number, cp2x: number, cp2y: number;

    if (distanceX >= distanceY) {
      // 水平关系为主 → S 弯
      const offset = distanceX * curvature;
      cp1x = startX + offset;
      cp1y = startY;
      cp2x = endX - offset;
      cp2y = endY;
    } else {
      // 垂直关系为主 → C 弯
      const offset = distanceY * curvature;
      cp1x = startX;
      cp1y = startY + offset;
      cp2x = endX;
      cp2y = endY - offset;
    }

    return { startX, startY, endX, endY, cp1x, cp1y, cp2x, cp2y };
  }

  private getSceneBounds(obj: PluginCanvasObject) {
    const bounds = obj.getBoundingRect();
    return {
      left: bounds.left,
      top: bounds.top,
      width: bounds.width,
      height: bounds.height,
    };
  }

  connect(
    source: PluginCanvasObject,
    target: PluginCanvasObject,
    options?: ConnectionOptions,
  ) {
    // 禁止自连接
    if (source === target) return;

    // 检查是否已存在相同连接
    const exists = this.connections.some(
      (c) => c.from === source && c.to === target,
    );
    if (exists) return;

    this.connections.push({ from: source, to: target, options });
    if (this.enabled) {
      this.canvas.requestRenderAll();
    }
  }

  setConnections(connections: Array<{ from: PluginCanvasObject; to: PluginCanvasObject; options?: ConnectionOptions }>) {
    this.connections = [];
    for (const conn of connections) {
      if (conn.from !== conn.to) {
        this.connections.push(conn);
      }
    }
    if (this.enabled) {
      this.canvas.requestRenderAll();
    }
  }

  disconnect(source: PluginCanvasObject, target: PluginCanvasObject) {
    const index = this.connections.findIndex(
      (c) => c.from === source && c.to === target,
    );
    if (index !== -1) {
      this.connections.splice(index, 1);
      if (this.enabled) {
        this.canvas.requestRenderAll();
      }
    }
  }

  clear() {
    this.connections = [];
    if (this.enabled) {
      this.canvas.requestRenderAll();
    }
  }

  getConnections(): Connection[] {
    return [...this.connections];
  }
}
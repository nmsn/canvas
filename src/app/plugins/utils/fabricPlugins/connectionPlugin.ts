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

    // 源锚点：4 个锚点到目标中心的距离
    const srcAnchors = [
      { x: srcCx, y: fromBounds.top },
      { x: srcCx, y: fromBounds.top + fromBounds.height },
      { x: fromBounds.left, y: srcCy },
      { x: fromBounds.left + fromBounds.width, y: srcCy },
    ];

    // 目标锚点：4 个锚点到源中心的距离
    const tgtAnchors = [
      { x: tgtCx, y: toBounds.top },
      { x: tgtCx, y: toBounds.top + toBounds.height },
      { x: toBounds.left, y: tgtCy },
      { x: toBounds.left + toBounds.width, y: tgtCy },
    ];

    // 选择距对方中心最近的锚点
    const startAnchor = this.findNearestAnchor(srcAnchors, tgtCx, tgtCy);
    const endAnchor = this.findNearestAnchor(tgtAnchors, srcCx, srcCy);

    const startX = startAnchor.x;
    const startY = startAnchor.y;
    const endX = endAnchor.x;
    const endY = endAnchor.y;

    // 计算控制点
    const distanceX = Math.abs(endX - startX);

    const offset = distanceX * curvature;
    const cp1x = startX + offset;
    const cp1y = startY;
    const cp2x = endX - offset;
    const cp2y = endY;

    return { startX, startY, endX, endY, cp1x, cp1y, cp2x, cp2y };
  }

  private findNearestAnchor(anchors: { x: number; y: number }[], targetCx: number, targetCy: number) {
    let best = anchors[0]!;
    let bestDist = Infinity;
    for (const anchor of anchors) {
      const dist = Math.hypot(anchor.x - targetCx, anchor.y - targetCy);
      if (dist < bestDist) {
        bestDist = dist;
        best = anchor;
      }
    }
    return best;
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

    // 规范化：让 A→B 和 B→A 存储为同一顺序（按 left 排序）
    const [from, to] = (source.left ?? 0) <= (target.left ?? 0)
      ? [source, target]
      : [target, source];

    // 检查是否已存在相同连接（考虑规范化）
    const exists = this.connections.some(
      (c) => c.from === from && c.to === to,
    );
    if (exists) return;

    this.connections.push({ from, to, options });
    if (this.enabled) {
      this.canvas.requestRenderAll();
    }
  }

  setConnections(connections: Array<{ from: PluginCanvasObject; to: PluginCanvasObject; options?: ConnectionOptions }>) {
    this.connections = [];
    for (const conn of connections) {
      if (conn.from !== conn.to) {
        // 规范化
        const [from, to] = (conn.from.left ?? 0) <= (conn.to.left ?? 0)
          ? [conn.from, conn.to]
          : [conn.to, conn.from];
        this.connections.push({ from, to, options: conn.options });
      }
    }
    if (this.enabled) {
      this.canvas.requestRenderAll();
    }
  }

  disconnect(source: PluginCanvasObject, target: PluginCanvasObject) {
    // 规范化（考虑 A→B 和 B→A 可能是同一连接）
    const [from, to] = (source.left ?? 0) <= (target.left ?? 0)
      ? [source, target]
      : [target, source];

    const index = this.connections.findIndex(
      (c) => c.from === from && c.to === to,
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
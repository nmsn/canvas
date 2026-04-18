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
    // 实现见 Task 3 - 目前为空
  }

  // API 方法见 Task 4
}
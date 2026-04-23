"use client";

import { Canvas, type FabricObject } from "fabric";
import type { ThumbnailPluginOptions } from "./types";

const DEFAULT_OPTIONS = {
  position: "bottom-right" as const,
  backgroundColor: "rgba(0,0,0,0.05)",
  viewportStroke: "#6366f1",
  viewportFill: "rgba(99,102,241,0.1)",
  padding: 8,
};

export class ThumbnailPlugin {
  private readonly canvas: Canvas;
  private thumbnailCanvas: Canvas | null = null;
  private container: HTMLElement | null = null;
  private viewportRect: FabricObject | null = null;
  private readonly options: Required<ThumbnailPluginOptions>;
  private enabled = false;
  private resizeObserver: ResizeObserver | null = null;

  constructor(canvas: Canvas, options: ThumbnailPluginOptions) {
    this.canvas = canvas;
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.resolveContainer(); // 验证容器
  }

  private resolveContainer(): HTMLElement {
    const { container } = this.options;

    if (typeof container === "string") {
      const el = document.querySelector(container);
      if (!el) throw new Error(`ThumbnailPlugin: container "${container}" not found`);
      return el;
    }

    if (typeof container === "function") {
      const el = container();
      if (!el || el.nodeType !== 1) {
        throw new Error("ThumbnailPlugin: container function must return a valid DOM element");
      }
      return el;
    }

    return container;
  }

  enable(): void {
    if (this.enabled) return;
    this.enabled = true;

    // Create thumbnail canvas
    this.container = this.resolveContainer();
    this.thumbnailCanvas = new Canvas(this.container.appendChild(document.createElement('canvas')) as HTMLCanvasElement);

    // Setup ResizeObserver
    this.resizeObserver = new ResizeObserver(this.handleResize);
    this.resizeObserver.observe(this.container);

    // Register canvas event listeners
    this.canvas.on("after:render", this.handleAfterRender);
    this.canvas.on("viewport:transformed", this.handleViewportTransform);
  }

  disable(): void {
    if (!this.enabled) return;
    this.enabled = false;

    // Cleanup ResizeObserver
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;

    // Unregister canvas event listeners
    this.canvas.off("after:render", this.handleAfterRender);
    this.canvas.off("viewport:transformed", this.handleViewportTransform);
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  private handleAfterRender = () => {
    // Will be implemented in later tasks
    this.syncViewport();
  };

  private handleViewportTransform = () => {
    // Will be implemented in later tasks
    this.syncViewport();
  };

  private syncViewport(): void {
    // Will be fully implemented in later tasks
  }

  private constrainViewportRect(): void {
    if (!this.viewportRect || !this.thumbnailCanvas) return;

    const bounds = this.viewportRect.getBoundingRect();
    const canvasWidth = this.thumbnailCanvas.width || 1;
    const canvasHeight = this.thumbnailCanvas.height || 1;

    let { left, top } = this.viewportRect as any;

    // 左上角约束
    left = Math.max(0, left);
    top = Math.max(0, top);

    // 右下角约束
    left = Math.min(canvasWidth - bounds.width, left);
    top = Math.min(canvasHeight - bounds.height, top);

    this.viewportRect.set({ left, top });
    this.viewportRect.setCoords();
  }

  private handleResize = (): void => {
    if (!this.container) return;
    const { width, height } = this.container.getBoundingClientRect();

    if (width === 0 || height === 0) return; // 跳过不可见状态

    this.thumbnailCanvas?.setWidth(width);
    this.thumbnailCanvas?.setHeight(height);
    this.fitToContent();
    this.syncViewport();
  };

  private fitToContent(): void {
    // Will be implemented in later tasks
  }
}
"use client";

import { Canvas, type FabricObject, util } from "fabric";
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
    // 容器验证延迟到 enable() 时进行（DOM 可能尚未挂载）
  }

  private resolveContainer(): HTMLElement {
    const { container } = this.options;

    if (typeof container === "string") {
      const el = document.querySelector(container) as HTMLElement | null;
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
    const canvasEl = document.createElement('canvas') as HTMLCanvasElement;
    this.container.appendChild(canvasEl);
    this.thumbnailCanvas = new Canvas(canvasEl);

    // Setup ResizeObserver
    this.resizeObserver = new ResizeObserver(this.handleResize);
    this.resizeObserver.observe(this.container);

    // Register canvas event listeners
    this.canvas.on("after:render", this.handleAfterRender);
  }

  disable(): void {
    if (!this.enabled) return;
    this.enabled = false;

    // Cleanup ResizeObserver
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;

    // Unregister canvas event listeners
    this.canvas.off("after:render", this.handleAfterRender);
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  private handleAfterRender = () => {
    this.syncObjects();
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

    if (this.thumbnailCanvas) {
      this.thumbnailCanvas.setDimensions({ width, height });
    }
    this.fitToContent();
    this.syncViewport();
  };

  private fitToContent(): void {
    if (!this.thumbnailCanvas) return;

    const objects = this.thumbnailCanvas.getObjects();
    if (objects.length === 0) {
      this.thumbnailCanvas.backgroundColor = this.options.backgroundColor;
      this.thumbnailCanvas.requestRenderAll();
      return;
    }

    // Calculate bounding box of all objects
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const obj of objects) {
      const bounds = obj.getBoundingRect();
      minX = Math.min(minX, bounds.left);
      minY = Math.min(minY, bounds.top);
      maxX = Math.max(maxX, bounds.left + bounds.width);
      maxY = Math.max(maxY, bounds.top + bounds.height);
    }

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    const canvasWidth = this.thumbnailCanvas.width || 1;
    const canvasHeight = this.thumbnailCanvas.height || 1;

    // Calculate scale ratio (with padding)
    const padding = this.options.padding;
    const availableWidth = canvasWidth - padding * 2;
    const availableHeight = canvasHeight - padding * 2;
    const scale = Math.min(
      availableWidth / contentWidth,
      availableHeight / contentHeight,
      1
    );

    // Center content
    const offsetX =
      (canvasWidth - contentWidth * scale) / 2 - minX * scale;
    const offsetY =
      (canvasHeight - contentHeight * scale) / 2 - minY * scale;

    this.thumbnailCanvas.setZoom(scale);
    this.thumbnailCanvas.viewportTransform = [1, 0, 0, 1, offsetX, offsetY];
    this.thumbnailCanvas.requestRenderAll();
  }

  private syncObjects(): void {
    if (!this.thumbnailCanvas) return;

    // 1. Clear thumbnail canvas
    this.thumbnailCanvas.clear();

    // 2. Iterate through main canvas objects, skip temporary objects
    const objects = this.canvas
      .getObjects()
      .filter(
        (obj: FabricObject) => !(obj as any).data?.isTemporary
      );

    // 3. Clone objects to thumbnail canvas
    const clonePromises = objects.map(
      (obj) =>
        new Promise<FabricObject>((resolve) => {
          (obj as any).clone((cloned: FabricObject) => resolve(cloned));
        })
    );

    Promise.all(clonePromises).then((clonedObjects) => {
      clonedObjects.forEach((cloned) => this.thumbnailCanvas!.add(cloned));
      this.fitToContent();
    });

    // If no objects, fitToContent anyway
    if (objects.length === 0) {
      this.fitToContent();
    }
  }
}
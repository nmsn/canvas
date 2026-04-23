"use client";

import type { Canvas, FabricObject } from "fabric";
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
    // Register canvas event listeners
    this.canvas.on("after:render", this.handleAfterRender);
    this.canvas.on("viewport:transformed", this.handleViewportTransform);
  }

  disable(): void {
    if (!this.enabled) return;
    this.enabled = false;
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
}
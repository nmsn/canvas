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
  private container: HTMLElement | null = null;
  private readonly options: Required<ThumbnailPluginOptions>;
  private enabled = false;
  private resizeObserver: ResizeObserver | null = null;
  private viewportRect: HTMLDivElement | null = null;
  private imageElement: HTMLImageElement | null = null;

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

    // Create container elements
    this.container = this.resolveContainer();

    // Create image element for canvas snapshot
    this.imageElement = document.createElement('img') as HTMLImageElement;
    this.imageElement.style.width = '100%';
    this.imageElement.style.height = '100%';
    this.imageElement.style.objectFit = 'contain';
    this.imageElement.style.display = 'block';
    this.container.appendChild(this.imageElement);

    // Create viewport rect overlay
    this.viewportRect = document.createElement('div') as HTMLDivElement;
    this.viewportRect.style.position = 'absolute';
    this.viewportRect.style.border = `2px solid ${this.options.viewportStroke}`;
    this.viewportRect.style.backgroundColor = this.options.viewportFill;
    this.viewportRect.style.pointerEvents = 'none';
    this.container.style.position = 'relative';
    this.container.appendChild(this.viewportRect);

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

    // Cleanup DOM elements
    this.container!.innerHTML = '';

    // Unregister canvas event listeners
    this.canvas.off("after:render", this.handleAfterRender);
    this.canvas.off("viewport:transformed", this.handleViewportTransform);
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  private handleAfterRender = () => {
    this.updateThumbnailImage();
    this.syncViewport();
  };

  private handleViewportTransform = () => {
    this.updateThumbnailImage();
    this.syncViewport();
  };

  private updateThumbnailImage(): void {
    if (!this.imageElement) return;

    // Use lower canvas for faster rendering (without upper canvas elements)
    const lowerCanvas = (this.canvas as any).lowerCanvasEl;
    if (!lowerCanvas) return;

    // Clone the canvas content as data URL
    const dataUrl = lowerCanvas.toDataURL({
      format: 'png',
      quality: 0.5,
      multiplier: 0.2, // Small multiplier for thumbnail
    });

    this.imageElement.src = dataUrl;
  }

  private syncViewport(): void {
    if (!this.viewportRect || !this.container) return;

    const mainViewport = this.canvas.viewportTransform;
    const mainZoom = this.canvas.getZoom();
    const containerRect = this.container.getBoundingClientRect();

    // Calculate main canvas visible area
    const visibleArea = {
      x: -mainViewport[4] / mainZoom,
      y: -mainViewport[5] / mainZoom,
      width: this.canvas.width / mainZoom,
      height: this.canvas.height / mainZoom,
    };

    // Calculate scale to fit thumbnail
    const scaleX = containerRect.width / this.canvas.width;
    const scaleY = containerRect.height / this.canvas.height;
    const scale = Math.min(scaleX, scaleY);

    // Calculate thumbnail viewport rect position
    const thumbLeft = (visibleArea.x + this.canvas.width / 2 - visibleArea.width / 2) * scale;
    const thumbTop = (visibleArea.y + this.canvas.height / 2 - visibleArea.height / 2) * scale;
    const thumbWidth = visibleArea.width * scale;
    const thumbHeight = visibleArea.height * scale;

    // Apply viewport rect styles
    this.viewportRect.style.left = `${thumbLeft}px`;
    this.viewportRect.style.top = `${thumbTop}px`;
    this.viewportRect.style.width = `${thumbWidth}px`;
    this.viewportRect.style.height = `${thumbHeight}px`;
  }

  private handleResize = (): void => {
    if (!this.container) return;
    const { width, height } = this.container.getBoundingClientRect();

    if (width === 0 || height === 0) return;

    this.updateThumbnailImage();
    this.syncViewport();
  };
}
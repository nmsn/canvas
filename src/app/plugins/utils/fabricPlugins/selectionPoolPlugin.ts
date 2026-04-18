"use client";

import type { Canvas, FabricObject, Shadow } from "fabric";
import type { PluginCanvasObject, SelectionPoolPluginOptions } from "./types";

const DEFAULT_OPTIONS: Required<SelectionPoolPluginOptions> = {
  maxSelectCount: 2,
  selectedStroke: "#6366f1",
  selectedStrokeWidth: 2,
  selectedShadow: "0 0 8px rgba(99,102,241,0.6)",
  onSelectionChange: undefined,
};

export class SelectionPoolPlugin {
  private readonly canvas: Canvas;
  private readonly options: Required<SelectionPoolPluginOptions>;
  private enabled = false;
  private selectionPool: PluginCanvasObject[] = [];
  private originalStates = new Map<PluginCanvasObject, {
    stroke?: string | number;
    strokeWidth?: number;
    shadow?: Shadow | string | null;
  }>();
  private readonly handleClick = (event: { target?: FabricObject }) =>
    this.onCanvasClick(event.target as PluginCanvasObject | undefined);

  constructor(canvas: Canvas, options: SelectionPoolPluginOptions = {}) {
    this.canvas = canvas;
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  enable() {
    if (this.enabled) return;
    this.enabled = true;
    this.canvas.on("mouse:down", this.handleClick);
    this.canvas.selection = false;
    this.canvas.getObjects().forEach((obj) => {
      (obj as PluginCanvasObject).selectable = false;
    });
  }

  disable() {
    if (!this.enabled) return;
    this.enabled = false;
    this.canvas.off("mouse:down", this.handleClick);
    this.canvas.selection = true;
    this.canvas.getObjects().forEach((obj) => {
      (obj as PluginCanvasObject).selectable = true;
    });
    this.clearSelection();
  }

  isEnabled() {
    return this.enabled;
  }

  getSelectedObjects(): PluginCanvasObject[] {
    return [...this.selectionPool];
  }

  // select/deselect/clearSelection/onCanvasClick 实现见后续任务
}
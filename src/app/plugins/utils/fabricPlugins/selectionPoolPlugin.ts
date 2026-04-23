"use client";

import { type Canvas, type FabricObject, Shadow } from "fabric";
import type { PluginCanvasObject, SelectionPoolPluginOptions } from "./types";

const DEFAULT_OPTIONS = {
  maxSelectCount: 2,
  selectedStroke: "#6366f1",
  selectedStrokeWidth: 2,
  selectedShadow: "0 0 8px rgba(99,102,241,0.6)",
} as const;

export class SelectionPoolPlugin {
  private readonly canvas: Canvas;
  private readonly options: Required<SelectionPoolPluginOptions>;
  private enabled = false;
  private selectionPool: PluginCanvasObject[] = [];
  private originalStates = new Map<PluginCanvasObject, {
    stroke?: string | number | object | null;
    strokeWidth?: number;
    shadow?: Shadow | string | null | undefined;
  }>();
  private readonly handleClick = (event: { target?: FabricObject }) =>
    this.onCanvasClick(event.target as PluginCanvasObject | undefined);

  constructor(canvas: Canvas, options: SelectionPoolPluginOptions = {}) {
    this.canvas = canvas;
    this.options = {
      maxSelectCount: options.maxSelectCount ?? DEFAULT_OPTIONS.maxSelectCount,
      selectedStroke: options.selectedStroke ?? DEFAULT_OPTIONS.selectedStroke,
      selectedStrokeWidth: options.selectedStrokeWidth ?? DEFAULT_OPTIONS.selectedStrokeWidth,
      selectedShadow: options.selectedShadow ?? DEFAULT_OPTIONS.selectedShadow,
      onSelectionChange: options.onSelectionChange ?? (() => {}),
    };
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

  select(obj: PluginCanvasObject) {
    if (this.selectionPool.includes(obj)) return;

    // 保存原始状态
    this.originalStates.set(obj, {
      stroke: obj.stroke,
      strokeWidth: obj.strokeWidth,
      shadow: obj.shadow,
    });

    // 应用选中特效
    const shadow = new Shadow(this.options.selectedShadow);
    obj.set({
      stroke: this.options.selectedStroke,
      strokeWidth: this.options.selectedStrokeWidth,
      shadow,
    });
    obj.setCoords();

    this.selectionPool.push(obj);
    this.options.onSelectionChange?.(this.getSelectedObjects());
    this.canvas.requestRenderAll();
  }

  deselect(obj: PluginCanvasObject) {
    const index = this.selectionPool.indexOf(obj);
    if (index === -1) return;

    // 恢复原始状态
    const original = this.originalStates.get(obj);
    if (original) {
      obj.set({
        stroke: original.stroke,
        strokeWidth: original.strokeWidth,
        shadow: original.shadow,
      });
      obj.setCoords();
      this.originalStates.delete(obj);
    }

    this.selectionPool.splice(index, 1);
    this.options.onSelectionChange?.(this.getSelectedObjects());
    this.canvas.requestRenderAll();
  }

  private onCanvasClick(target?: PluginCanvasObject) {
    if (!target || !this.enabled) return;

    // 过滤非业务对象
    const data = (target as PluginCanvasObject).data;
    if (data?.isGrid || data?.isPlaceholder || data?.isDimAnnotation || data?.isConnection) {
      return;
    }

    if (this.selectionPool.includes(target)) {
      // 已在池中，取消选中
      this.deselect(target);
    } else {
      // 不在池中
      if (this.selectionPool.length >= this.options.maxSelectCount) {
        // 池已满，淘汰第一个
        const oldest = this.selectionPool[0];
        if (oldest) {
          this.deselect(oldest);
        }
      }
      // 加入池
      this.select(target);
    }
  }

  clearSelection() {
    [...this.selectionPool].forEach((obj) => this.deselect(obj));
  }
}
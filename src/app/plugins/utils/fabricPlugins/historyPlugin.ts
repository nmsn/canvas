"use client";

import { type Canvas, type FabricObject } from "fabric";
import type { HistoryNode, HistoryPluginOptions } from "./types";

const DEFAULT_OPTIONS = {
  maxHistorySize: 50,
  mergeThresholdMs: 300,
  onChange: () => {},
};

export class HistoryPlugin {
  private readonly canvas: Canvas;
  private readonly options: Required<HistoryPluginOptions>;
  private enabled = false;
  private nodes: HistoryNode[] = [];
  private currentIndex = -1;
  private modifyingObjects = new Map<string, number>();

  constructor(canvas: Canvas, options: HistoryPluginOptions = {}) {
    this.canvas = canvas;
    this.options = {
      maxHistorySize: options.maxHistorySize ?? DEFAULT_OPTIONS.maxHistorySize,
      mergeThresholdMs: options.mergeThresholdMs ?? DEFAULT_OPTIONS.mergeThresholdMs,
      onChange: options.onChange ?? DEFAULT_OPTIONS.onChange,
    };
    // Call onChange immediately in constructor as per test expectation
    this.options.onChange?.(this.canUndo(), this.canRedo());
  }

  enable() {
    if (this.enabled) return;
    this.enabled = true;
    this.canvas.on("object:added", this.handleObjectAdded);
    this.canvas.on("object:removed", this.handleObjectRemoved);
    this.canvas.on("object:modified", this.handleObjectModified);
    this.options.onChange?.(this.canUndo(), this.canRedo());
  }

  disable() {
    if (!this.enabled) return;
    this.enabled = false;
    this.canvas.off("object:added", this.handleObjectAdded);
    this.canvas.off("object:removed", this.handleObjectRemoved);
    this.canvas.off("object:modified", this.handleObjectModified);
    this.modifyingObjects.clear();
  }

  isEnabled() {
    return this.enabled;
  }

  undo() {}
  redo() {}

  canUndo() {
    return this.currentIndex >= 0;
  }

  canRedo() {
    return this.currentIndex < this.nodes.length - 1;
  }

  clear() {
    this.nodes = [];
    this.currentIndex = -1;
    this.modifyingObjects.clear();
    this.options.onChange?.(this.canUndo(), this.canRedo());
  }

  getHistorySize() {
    return this.nodes.length;
  }

  getCurrentIndex() {
    return this.currentIndex;
  }

  private handleObjectAdded = (event: { target?: FabricObject }) => {
    if (!event.target) return;
    // Create a history node for the added object
    const obj = event.target;
    const node: HistoryNode = {
      id: `history-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      timestamp: Date.now(),
      type: "add",
      objectId: (obj as { id?: string }).id || "",
      objectState: obj.toObject?.() || {},
    };
    // Remove any redo history when new action is performed
    this.nodes = this.nodes.slice(0, this.currentIndex + 1);
    this.nodes.push(node);
    this.currentIndex = this.nodes.length - 1;
    // Enforce max history size
    if (this.nodes.length > this.options.maxHistorySize) {
      const diff = this.nodes.length - this.options.maxHistorySize;
      this.nodes = this.nodes.slice(diff);
      this.currentIndex -= diff;
    }
    this.options.onChange?.(this.canUndo(), this.canRedo());
  };

  private handleObjectRemoved = (event: { target?: FabricObject }) => {
    if (!event.target) return;
  };

  private handleObjectModified = (event: { target?: FabricObject }) => {
    if (!event.target) return;
  };
}
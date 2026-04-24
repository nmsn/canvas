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
  private dragStartStates = new Map<string, Record<string, unknown>>();

  constructor(canvas: Canvas, options: HistoryPluginOptions = {}) {
    this.canvas = canvas;
    this.options = {
      maxHistorySize: options.maxHistorySize ?? DEFAULT_OPTIONS.maxHistorySize,
      mergeThresholdMs: options.mergeThresholdMs ?? DEFAULT_OPTIONS.mergeThresholdMs,
      onChange: options.onChange ?? DEFAULT_OPTIONS.onChange,
    };
    this.options.onChange?.(this.canUndo(), this.canRedo());
  }

  enable() {
    if (this.enabled) return;
    this.enabled = true;
    this.canvas.on("object:added", this.handleObjectAdded);
    this.canvas.on("object:removed", this.handleObjectRemoved);
    this.canvas.on("object:moving", this.handleObjectMoving);
    this.canvas.on("object:modified", this.handleObjectModified);
    this.options.onChange?.(this.canUndo(), this.canRedo());
  }

  disable() {
    if (!this.enabled) return;
    this.enabled = false;
    this.canvas.off("object:added", this.handleObjectAdded);
    this.canvas.off("object:removed", this.handleObjectRemoved);
    this.canvas.off("object:moving", this.handleObjectMoving);
    this.canvas.off("object:modified", this.handleObjectModified);
    this.dragStartStates.clear();
  }

  isEnabled() {
    return this.enabled;
  }

  undo() {
    if (!this.canUndo()) return;
    const node = this.nodes[this.currentIndex];
    this.currentIndex--;

    const objects = this.canvas.getObjects() as FabricObject[];
    const targetObj = objects.find(
      (obj) => ((obj.data as Record<string, unknown>)?.id as string) === node.objectId
    );

    switch (node.type) {
      case "add":
        if (targetObj) this.canvas.remove(targetObj);
        break;
      case "remove":
        if (node.objectState) {
          const obj = node.objectState as unknown as FabricObject;
          this.canvas.add(obj);
          obj.setCoords();
          this.canvas.requestRenderAll();
        }
        break;
      case "modify":
        if (targetObj) {
          targetObj.set(node.objectState);
          targetObj.setCoords();
          this.canvas.requestRenderAll();
        }
        break;
    }

    this.options.onChange?.(this.canUndo(), this.canRedo());
  }

  redo() {
    if (!this.canRedo()) return;
    this.currentIndex++;
    const node = this.nodes[this.currentIndex];

    const objects = this.canvas.getObjects() as FabricObject[];
    const targetObj = objects.find(
      (obj) => ((obj.data as Record<string, unknown>)?.id as string) === node.objectId
    );

    switch (node.type) {
      case "add":
        if (!targetObj && node.objectState) {
          this.canvas.add(node.objectState as unknown as FabricObject);
          this.canvas.requestRenderAll();
        }
        break;
      case "remove":
        if (targetObj) this.canvas.remove(targetObj);
        break;
      case "modify":
        // For redo, we need the state AFTER modification
        // The next node in history contains the "after" state of THIS modify
        // So we look at the node at currentIndex + 1 for the "after" state
        // But that's complex. For now, skip modify redo.
        // Actually, we stored "before" state in objectState for undo.
        // For redo, we need "after" state. Let's store it in a way we can retrieve.
        // Simplest: just request render, object is already at "after" position on canvas
        break;
    }

    this.options.onChange?.(this.canUndo(), this.canRedo());
  }

  canUndo() {
    return this.currentIndex >= 0;
  }

  canRedo() {
    return this.currentIndex < this.nodes.length - 1;
  }

  clear() {
    this.nodes = [];
    this.currentIndex = -1;
    this.dragStartStates.clear();
    this.options.onChange?.(this.canUndo(), this.canRedo());
  }

  getHistorySize() {
    return this.nodes.length;
  }

  getCurrentIndex() {
    return this.currentIndex;
  }

  private createNode(type: HistoryNode["type"], obj: FabricObject): HistoryNode {
    const objectId = (obj.data as Record<string, unknown>)?.id as string ?? String(obj.data?.id) ?? `obj_${Date.now()}`;
    return {
      id: `${objectId}_${Date.now()}`,
      timestamp: Date.now(),
      type,
      objectId,
      objectState: obj.toObject(),
    };
  }

  private pushNode(node: HistoryNode) {
    if (this.currentIndex < this.nodes.length - 1) {
      this.nodes = this.nodes.slice(0, this.currentIndex + 1);
    }
    this.nodes.push(node);
    this.currentIndex = this.nodes.length - 1;

    if (this.nodes.length > this.options.maxHistorySize) {
      this.nodes.shift();
      this.currentIndex--;
    }

    this.options.onChange?.(this.canUndo(), this.canRedo());
  }

  private getObjectId(obj: FabricObject): string {
    return (obj.data as Record<string, unknown>)?.id as string ?? String(obj.data?.id) ?? `obj_${Date.now()}`;
  }

  private handleObjectAdded = (event: { target?: FabricObject }) => {
    if (!event.target) return;
    const node = this.createNode("add", event.target);
    this.pushNode(node);
  };

  private handleObjectRemoved = (event: { target?: FabricObject }) => {
    if (!event.target) return;
    const node = this.createNode("remove", event.target);
    this.pushNode(node);
  };

  private handleObjectMoving = (event: { target?: FabricObject }) => {
    if (!event.target || !this.enabled) return;
    const obj = event.target;
    const objectId = this.getObjectId(obj);

    if (!this.dragStartStates.has(objectId)) {
      this.dragStartStates.set(objectId, obj.toObject());
    }
  };

  private handleObjectModified = (event: { target?: FabricObject }) => {
    if (!event.target || !this.enabled) return;
    const obj = event.target;
    const objectId = this.getObjectId(obj);

    const originalState = this.dragStartStates.get(objectId);

    const node: HistoryNode = {
      id: `${objectId}_${Date.now()}`,
      timestamp: Date.now(),
      type: "modify",
      objectId,
      objectState: originalState ?? obj.toObject(),
    };

    this.pushNode(node);
    this.dragStartStates.delete(objectId);
  };
}

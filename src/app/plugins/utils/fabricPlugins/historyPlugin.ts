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
  private modifyingObjects = new Map<string, { timestamp: number; timeoutId: ReturnType<typeof setTimeout> }>();

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
    // Clear all pending timeouts
    for (const entry of this.modifyingObjects.values()) {
      clearTimeout(entry.timeoutId);
    }
    this.modifyingObjects.clear();
  }

  isEnabled() {
    return this.enabled;
  }

  undo() {
    if (!this.canUndo()) return;
    const node = this.nodes[this.currentIndex];
    this.currentIndex--;

    // Find the object on canvas
    const objects = this.canvas.getObjects() as FabricObject[];
    const targetObj = objects.find(
      (obj) => ((obj.data as Record<string, unknown>)?.id as string) === node.objectId
    );

    switch (node.type) {
      case "add":
        // Undo add = remove the object
        if (targetObj) {
          this.canvas.remove(targetObj);
        }
        break;
      case "remove":
        // Undo remove = add the object back
        // node.objectState contains the serialized form from when the object was removed
        if (node.objectState) {
          // Use canvas.add to re-add the object
          // For Fabric.js, we pass the serialized state and it creates a new object
          this.canvas.add(node.objectState as unknown as FabricObject);
          this.canvas.requestRenderAll();
        }
        break;
      case "modify":
        // Undo modify = restore previous state
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

    // Find the object on canvas
    const objects = this.canvas.getObjects() as FabricObject[];
    const targetObj = objects.find(
      (obj) => ((obj.data as Record<string, unknown>)?.id as string) === node.objectId
    );

    switch (node.type) {
      case "add":
        // Redo add = add the object back
        if (!targetObj) {
          this.canvas.add(node.objectState as unknown as FabricObject);
        }
        break;
      case "remove":
        // Redo remove = remove the object
        if (targetObj) {
          this.canvas.remove(targetObj);
        }
        break;
      case "modify":
        // Redo modify = apply the state again
        if (targetObj) {
          targetObj.set(node.objectState);
          targetObj.setCoords();
          this.canvas.requestRenderAll();
        }
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
    // Clear all pending timeouts
    for (const entry of this.modifyingObjects.values()) {
      clearTimeout(entry.timeoutId);
    }
    this.modifyingObjects.clear();
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
    // Truncate any redo history when new action is taken
    if (this.currentIndex < this.nodes.length - 1) {
      this.nodes = this.nodes.slice(0, this.currentIndex + 1);
    }
    this.nodes.push(node);
    this.currentIndex = this.nodes.length - 1;

    // Enforce max history size
    if (this.nodes.length > this.options.maxHistorySize) {
      this.nodes.shift();
      this.currentIndex--;
    }

    this.options.onChange?.(this.canUndo(), this.canRedo());
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

  private handleObjectModified = (event: { target?: FabricObject }) => {
    if (!event.target || !this.enabled) return;
    const obj = event.target;
    const objectId = (obj.data as Record<string, unknown>)?.id as string ?? String(obj.data?.id) ?? `obj_${Date.now()}`;

    const now = Date.now();
    const existingTimeout = this.modifyingObjects.get(objectId);

    // Merge rapid modifications
    if (existingTimeout && now - existingTimeout.timestamp < this.options.mergeThresholdMs) {
      // Find the last modify node for this object (search backwards from currentIndex)
      let nodeIndex = -1;
      for (let i = this.currentIndex; i >= 0; i--) {
        if (this.nodes[i].objectId === objectId && this.nodes[i].type === "modify") {
          nodeIndex = i;
          break;
        }
      }
      if (nodeIndex >= 0) {
        this.nodes[nodeIndex] = { ...this.nodes[nodeIndex], objectState: obj.toObject(), timestamp: now };
      }
      // Clear previous timeout before setting new one
      clearTimeout(existingTimeout.timeoutId);
    } else {
      const node = this.createNode("modify", obj);
      this.pushNode(node);
    }

    // Set new timeout and store both timestamp and timeoutId
    const timeoutId = setTimeout(() => {
      this.modifyingObjects.delete(objectId);
    }, this.options.mergeThresholdMs);
    this.modifyingObjects.set(objectId, { timestamp: now, timeoutId });
  };
}
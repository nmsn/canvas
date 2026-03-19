"use client";

import type { FabricObject } from "fabric";

export type PluginLogType = "info" | "move" | "snap" | "warn";

export type PluginLogger = (message: string, type?: PluginLogType) => void;

export interface DimensionPluginOptions {
  lineColor?: string;
  textColor?: string;
  gapColor?: string;
  fontSize?: number;
  offset?: number;
  tickLength?: number;
}

export interface SortableSnapPluginOptions {
  rowTolerance?: number;
  gap?: number;
  animDuration?: number;
  placeholderColor?: string;
  placeholderStroke?: string;
  rowTop?: number;
}

export interface PluginCanvasObject extends FabricObject {
  data?: Record<string, unknown> & {
    layoutWidth?: number;
    layoutHeight?: number;
  };
}

export interface RowState {
  y: number;
  objects: PluginCanvasObject[];
}

export interface PeerSlot {
  obj: PluginCanvasObject;
  idealX: number;
}

export interface PeerTarget {
  obj: PluginCanvasObject;
  x: number;
}

export interface LayoutResult {
  peerTargets: PeerTarget[];
  placeholderX: number;
}

export type LayoutSlot =
  | {
      kind: "peer";
      width: number;
      obj: PluginCanvasObject;
    }
  | {
      kind: "placeholder";
      width: number;
      obj: null;
    };

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

// Connection Plugin types
export interface ConnectionPluginOptions {
  lineColor?: string;
  lineWidth?: number;
  curvature?: number;
  arrowSize?: number;  // 预留
}

export interface ConnectionOptions {
  lineColor?: string;
  lineWidth?: number;
  curvature?: number;
}

export interface Connection {
  from: PluginCanvasObject;
  to: PluginCanvasObject;
  options?: ConnectionOptions;
}

// SelectionPoolPlugin types
export interface SelectionPoolPluginOptions {
  maxSelectCount?: number;           // 最大选中个数，默认 2
  selectedStroke?: string;           // 选中边框颜色，默认 '#6366f1'
  selectedStrokeWidth?: number;      // 选中边框宽度，默认 2
  selectedShadow?: string;           // 选中阴影，默认 '0 0 8px rgba(99,102,241,0.6)'
  onSelectionChange?: (objects: PluginCanvasObject[]) => void;  // 选中变化回调
}

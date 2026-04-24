"use client";

import { Circle, FabricText, Group, Line, Rect, type Canvas } from "fabric";
import type { PluginCanvasObject } from "./types";
import { getBusinessObjects } from "./utils";

export const SCENE_ROWS = {
  row1: 140,
};

const GRID_SIZE = 40;
const SHAPE_STROKE_WIDTH = 2;

const DEFAULT_COLORS = [
  "#1e40af",
  "#0f766e",
  "#dc2626",
  "#d97706",
  "#2563eb",
  "#7c3aed",
  "#db2777",
  "#059669",
];

const DEFAULT_LABELS = [
  "Button",
  "Input",
  "Card",
  "Modal",
  "Table",
  "Form",
  "List",
  "Badge",
  "Panel",
  "Block",
];

export function getPalette() {
  return DEFAULT_COLORS;
}

export function getLabel(index: number) {
  return DEFAULT_LABELS[index % DEFAULT_LABELS.length]!;
}

export function addGrid(canvas: Canvas, width: number, height: number) {
  const lines: Line[] = [];

  for (let x = 0; x <= width; x += GRID_SIZE) {
    const line = new Line([x, 0, x, height], {
      stroke: "#d9e0f0",
      strokeWidth: 1,
      selectable: false,
      evented: false,
    }) as Line & { data?: Record<string, unknown> };
    line.data = { isGrid: true };
    lines.push(line);
  }

  for (let y = 0; y <= height; y += GRID_SIZE) {
    const line = new Line([0, y, width, y], {
      stroke: "#d9e0f0",
      strokeWidth: 1,
      selectable: false,
      evented: false,
    }) as Line & { data?: Record<string, unknown> };
    line.data = { isGrid: true };
    lines.push(line);
  }

  canvas.add(...lines);
}

export function clearBusinessObjects(canvas: Canvas) {
  canvas
    .getObjects()
    .filter((object) => !(object as PluginCanvasObject).data?.isGrid)
    .forEach((object) => canvas.remove(object));
}

export function createLabeledRect(params: {
  left: number;
  top: number;
  width: number;
  height?: number;
  color: string;
  label: string;
}) {
  const { left, top, width, height = 60, color, label } = params;

  const object = new Group(
    [
      new Rect({
        width,
        height,
        fill: `${color}20`,
        stroke: color,
        strokeWidth: SHAPE_STROKE_WIDTH,
        rx: 10,
        ry: 10,
      }),
      new FabricText(label, {
        left: 0,
        top: 0,
        originX: "center",
        originY: "center",
        fontSize: 12,
        fontWeight: 600,
        fill: color,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      }),
    ],
    {
      left,
      top,
      stroke: color,
      strokeWidth: 1,
      subTargetCheck: false,
      hasControls: false,
      hasBorders: false,
      lockScalingX: true,
      lockScalingY: true,
      lockRotation: true,
    },
  ) as Group & PluginCanvasObject;
  object.data = {
    ...(object.data ?? {}),
    id: `rect_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    layoutWidth: width,
    layoutHeight: height,
  };
  return object;
}

export function createCircleBadge(params: {
  left: number;
  top: number;
  radius: number;
  color: string;
}) {
  const { left, top, radius, color } = params;
  const object = new Circle({
    left,
    top,
    radius,
    fill: `${color}20`,
    stroke: color,
    strokeWidth: SHAPE_STROKE_WIDTH,
    hasControls: false,
    hasBorders: false,
    lockScalingX: true,
    lockScalingY: true,
    lockRotation: true,
  }) as Circle & PluginCanvasObject;
  object.data = {
    ...(object.data ?? {}),
    id: `circle_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    layoutWidth: radius * 2,
    layoutHeight: radius * 2,
  };
  return object;
}

export function businessObjectsCount(canvas: Canvas) {
  return getBusinessObjects(canvas).length;
}

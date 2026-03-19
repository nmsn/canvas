"use client";

import type { Canvas, FabricObject } from "fabric";
import type { PluginCanvasObject } from "./types";

export function isBusinessObject(
  object: FabricObject,
): object is PluginCanvasObject {
  const data = (object as PluginCanvasObject).data;
  return !data?.isGrid && !data?.isPlaceholder && !data?.isDimAnnotation;
}

export function getBusinessObjects(canvas: Canvas): PluginCanvasObject[] {
  return canvas.getObjects().filter(isBusinessObject);
}

export function toSceneBounds(object: PluginCanvasObject) {
  const bounds = object.getBoundingRect();
  return {
    left: bounds.left,
    top: bounds.top,
    width: bounds.width,
    height: bounds.height,
  };
}

export function getScaleX(object: PluginCanvasObject) {
  return object.scaleX ?? 1;
}

export function getScaleY(object: PluginCanvasObject) {
  return object.scaleY ?? 1;
}

export function getLayoutWidth(object: PluginCanvasObject) {
  const boundsWidth = toSceneBounds(object).width;
  if (boundsWidth > 0) {
    return boundsWidth;
  }

  const renderedWidth = object.getScaledWidth();
  if (renderedWidth > 0) {
    return renderedWidth;
  }

  return (object.data?.layoutWidth ?? object.width ?? 0) * getScaleX(object);
}

export function getLayoutHeight(object: PluginCanvasObject) {
  const boundsHeight = toSceneBounds(object).height;
  if (boundsHeight > 0) {
    return boundsHeight;
  }

  const renderedHeight = object.getScaledHeight();
  if (renderedHeight > 0) {
    return renderedHeight;
  }

  return (object.data?.layoutHeight ?? object.height ?? 0) * getScaleY(object);
}

export function getVisualLeft(object: PluginCanvasObject) {
  return toSceneBounds(object).left;
}

export function getTargetPositionForVisualPlacement(
  object: PluginCanvasObject,
  visualLeft: number,
  visualTop: number,
) {
  const bounds = toSceneBounds(object);
  return {
    left: (object.left ?? 0) + (visualLeft - bounds.left),
    top: (object.top ?? 0) + (visualTop - bounds.top),
  };
}

export function cancelAnimationMap(
  animations: Record<string, { abort?: () => void }> | undefined,
) {
  if (!animations) {
    return;
  }

  Object.values(animations).forEach((animation) => animation.abort?.());
}

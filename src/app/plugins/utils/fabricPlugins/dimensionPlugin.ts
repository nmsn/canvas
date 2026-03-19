"use client";

import type { Canvas } from "fabric";
import type { DimensionPluginOptions, PluginCanvasObject } from "./types";
import { getBusinessObjects, toSceneBounds } from "./utils";

const DEFAULT_DIMENSION_OPTIONS: Required<DimensionPluginOptions> = {
  lineColor: "#1677ff",
  textColor: "#1677ff",
  gapColor: "#ea580c",
  fontSize: 11,
  offset: 16,
  tickLength: 4,
};

export class DimensionPlugin {
  private readonly canvas: Canvas;
  private readonly options: Required<DimensionPluginOptions>;
  private enabled = false;
  private readonly handleAfterRender = () => this.draw();

  constructor(canvas: Canvas, options: DimensionPluginOptions = {}) {
    this.canvas = canvas;
    this.options = { ...DEFAULT_DIMENSION_OPTIONS, ...options };
  }

  enable() {
    if (this.enabled) {
      return;
    }

    this.enabled = true;
    this.canvas.on("after:render", this.handleAfterRender);
    this.canvas.requestRenderAll();
  }

  disable() {
    if (!this.enabled) {
      return;
    }

    this.enabled = false;
    this.canvas.off("after:render", this.handleAfterRender);
    this.clearOverlay();
    this.canvas.requestRenderAll();
  }

  isEnabled() {
    return this.enabled;
  }

  private draw() {
    if (!this.enabled) {
      return;
    }

    this.clearOverlay();
    const context = this.canvas.getTopContext();
    const zoom = this.canvas.getZoom() || 1;
    const viewportTransform = this.canvas.viewportTransform;
    const objects = getBusinessObjects(this.canvas);

    context.save();

    if (viewportTransform) {
      context.transform(
        viewportTransform[0],
        viewportTransform[1],
        viewportTransform[2],
        viewportTransform[3],
        viewportTransform[4],
        viewportTransform[5],
      );
    }

    for (const object of objects) {
      const bounds = toSceneBounds(object);
      const lineWidth = 1 / zoom;
      const fontSize = this.options.fontSize / zoom;
      const offset = this.options.offset / zoom;

      context.strokeStyle = this.options.lineColor;
      context.lineWidth = lineWidth;
      context.setLineDash([]);

      this.drawMeasureLine(
        context,
        bounds.left,
        bounds.top - offset,
        bounds.left + bounds.width,
        bounds.top - offset,
        `${Math.round(bounds.width)}px`,
        true,
        zoom,
      );

      this.drawMeasureLine(
        context,
        bounds.left + bounds.width + offset,
        bounds.top,
        bounds.left + bounds.width + offset,
        bounds.top + bounds.height,
        `${Math.round(bounds.height)}px`,
        false,
        zoom,
      );

      context.fillStyle = this.options.textColor;
      context.font = `${fontSize}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      context.textAlign = "left";
      context.textBaseline = "bottom";
      context.fillText(
        `(${Math.round(object.left ?? 0)}, ${Math.round(object.top ?? 0)})`,
        bounds.left,
        bounds.top - offset - 3 / zoom,
      );
    }

    this.drawGapAnnotations(context, objects, zoom);

    context.restore();
  }

  private clearOverlay() {
    const context = this.canvas.getTopContext();
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(
      0,
      0,
      this.canvas.upperCanvasEl.width,
      this.canvas.upperCanvasEl.height,
    );
    context.restore();
  }

  private drawMeasureLine(
    context: CanvasRenderingContext2D,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    label: string,
    horizontal: boolean,
    zoom: number,
  ) {
    const tickLength = this.options.tickLength / zoom;
    const fontSize = this.options.fontSize / zoom;
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;

    context.beginPath();
    context.moveTo(x1, y1);
    context.lineTo(x2, y2);

    if (horizontal) {
      context.moveTo(x1, y1 - tickLength);
      context.lineTo(x1, y1 + tickLength);
      context.moveTo(x2, y2 - tickLength);
      context.lineTo(x2, y2 + tickLength);
    } else {
      context.moveTo(x1 - tickLength, y1);
      context.lineTo(x1 + tickLength, y1);
      context.moveTo(x2 - tickLength, y2);
      context.lineTo(x2 + tickLength, y2);
    }

    context.stroke();

    context.font = `${fontSize}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    context.fillStyle = this.options.textColor;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(label, midX, midY);
  }

  private drawGapAnnotations(
    context: CanvasRenderingContext2D,
    objects: PluginCanvasObject[],
    zoom: number,
  ) {
    if (objects.length < 2) {
      return;
    }

    const boundsList = objects
      .map((object) => ({
        object,
        bounds: toSceneBounds(object),
      }))
      .sort((left, right) => left.bounds.left - right.bounds.left);

    const tickLength = this.options.tickLength / zoom;
    const labelOffset = 14 / zoom;
    const lineWidth = 1 / zoom;
    const fontSize = this.options.fontSize / zoom;

    context.strokeStyle = this.options.gapColor;
    context.fillStyle = this.options.gapColor;
    context.lineWidth = lineWidth;
    context.setLineDash([4 / zoom, 4 / zoom]);
    context.font = `${fontSize}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    context.textAlign = "center";
    context.textBaseline = "bottom";

    for (let index = 0; index < boundsList.length - 1; index += 1) {
      const current = boundsList[index]!.bounds;
      const next = boundsList[index + 1]!.bounds;
      const verticalOverlap =
        Math.min(current.top + current.height, next.top + next.height) -
        Math.max(current.top, next.top);

      if (verticalOverlap <= 0) {
        continue;
      }

      const gapLeft = current.left + current.width;
      const gapRight = next.left;
      const gapWidth = gapRight - gapLeft;
      const lineY =
        Math.max(current.top + current.height, next.top + next.height) +
        labelOffset;

      context.beginPath();
      context.moveTo(gapLeft, lineY);
      context.lineTo(gapRight, lineY);
      context.moveTo(gapLeft, lineY - tickLength);
      context.lineTo(gapLeft, lineY + tickLength);
      context.moveTo(gapRight, lineY - tickLength);
      context.lineTo(gapRight, lineY + tickLength);
      context.stroke();

      context.fillText(
        `${Math.round(gapWidth)}px`,
        (gapLeft + gapRight) / 2,
        lineY - 2 / zoom,
      );
    }
  }
}

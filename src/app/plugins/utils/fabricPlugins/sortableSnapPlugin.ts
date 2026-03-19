"use client";

import { Rect, type Canvas, type FabricObject, util } from "fabric";
import type {
  LayoutResult,
  LayoutSlot,
  PeerSlot,
  PeerTarget,
  PluginCanvasObject,
  PluginLogger,
  RowState,
  SortableSnapPluginOptions,
} from "./types";
import {
  cancelAnimationMap,
  getBusinessObjects,
  getLayoutHeight,
  getLayoutWidth,
  getTargetPositionForVisualPlacement,
  getVisualLeft,
  isBusinessObject,
  toSceneBounds,
} from "./utils";

const DEFAULT_SORTABLE_OPTIONS: Required<SortableSnapPluginOptions> = {
  rowTolerance: 20,
  gap: 12,
  animDuration: 180,
  placeholderColor: "rgba(22,119,255,0.12)",
  placeholderStroke: "rgba(22,119,255,0.4)",
  rowTop: 140,
};

export class SortableSnapPlugin {
  private readonly canvas: Canvas;
  private readonly options: Required<SortableSnapPluginOptions>;
  private readonly log?: PluginLogger;
  private readonly onRowsChange?: (rows: number) => void;
  private readonly peerAnimations = new WeakMap<
    PluginCanvasObject,
    Record<string, { abort?: () => void }>
  >();
  private readonly settleAnimations = new WeakMap<
    PluginCanvasObject,
    Record<string, { abort?: () => void }>
  >();
  private enabled = false;
  private rows: RowState[] = [];
  private dragging = false;
  private dragTarget: PluginCanvasObject | null = null;
  private dragRow: RowState | null = null;
  private placeholder: Rect | null = null;
  private peerSlots: PeerSlot[] = [];
  private currentInsertIndex = -1;
  private readonly handleObjectMoving = (event: { target?: FabricObject }) =>
    this.onObjectMoving(event.target as PluginCanvasObject | undefined);
  private readonly handleMouseUp = () => this.onMouseUp();

  constructor(
    canvas: Canvas,
    options: SortableSnapPluginOptions = {},
    hooks: {
      log?: PluginLogger;
      onRowsChange?: (rows: number) => void;
    } = {},
  ) {
    this.canvas = canvas;
    this.options = { ...DEFAULT_SORTABLE_OPTIONS, ...options };
    this.log = hooks.log;
    this.onRowsChange = hooks.onRowsChange;
  }

  enable() {
    if (this.enabled) {
      return;
    }

    this.enabled = true;
    this.canvas.on("object:moving", this.handleObjectMoving);
    this.canvas.on("mouse:up", this.handleMouseUp);
    this.initRows();
    this.normalizeLayout(false);
  }

  disable() {
    if (!this.enabled) {
      return;
    }

    this.enabled = false;
    this.canvas.off("object:moving", this.handleObjectMoving);
    this.canvas.off("mouse:up", this.handleMouseUp);
    this.cleanupDrag();
    this.rows = [];
    this.onRowsChange?.(0);
  }

  isEnabled() {
    return this.enabled;
  }

  getRows() {
    return this.rows;
  }

  normalizeLayout(animated = false) {
    if (this.rows.length === 0) {
      this.initRows();
      return;
    }

    this.rows.forEach((row) => this.reflowRow(row, animated));
    this.canvas.requestRenderAll();
  }

  initRows() {
    const objects = getBusinessObjects(this.canvas);
    if (objects.length === 0) {
      this.rows = [];
      this.onRowsChange?.(0);
      this.log?.("initRows: 0 行，共 0 个元素", "info");
      return;
    }

    const sortedObjects = [...objects].sort(
      (left, right) => (left.left ?? 0) - (right.left ?? 0),
    );
    const singleRow: RowState = {
      y: this.options.rowTop,
      objects: sortedObjects,
    };
    this.rows = [singleRow];
    this.reflowRow(singleRow, this.enabled);
    this.onRowsChange?.(1);
    this.log?.(`initRows: 1 行，共 ${objects.length} 个元素`, "info");
  }

  private onObjectMoving(target?: PluginCanvasObject) {
    if (!target || !isBusinessObject(target) || !this.enabled) {
      return;
    }

    if (!this.dragging || this.dragTarget !== target) {
      this.startDrag(target);
    }

    if (!this.dragging || !this.dragRow || !this.dragTarget) {
      return;
    }

    const lockedPosition = getTargetPositionForVisualPlacement(
      target,
      getVisualLeft(target),
      this.dragRow.y,
    );
    target.set({
      left: lockedPosition.left,
      top: lockedPosition.top,
    });
    target.setCoords();

    const targetBounds = toSceneBounds(target);
    const insertIndex = this.computeInsertIndex(
      targetBounds.left,
      targetBounds.width,
      this.peerSlots,
    );

    if (insertIndex === this.currentInsertIndex) {
      return;
    }

    this.currentInsertIndex = insertIndex;
    this.applyLayout(insertIndex, target);
    this.log?.(`插入位置 -> [${insertIndex}]`, "move");
  }

  private startDrag(target: PluginCanvasObject) {
    this.cleanupDrag();

    const row = this.rows.find((candidate) =>
      candidate.objects.includes(target),
    );
    if (!row) {
      this.log?.("元素不在任何行中，跳过拖动接管", "warn");
      return;
    }

    this.dragging = true;
    this.dragTarget = target;
    this.dragRow = row;
    this.peerSlots = this.computePeerSlots(row, target);
    this.currentInsertIndex = -1;
    this.createPlaceholder(target);
    this.log?.(`开始拖动，锁定到行 y=${row.y}`, "info");
  }

  private computePeerSlots(row: RowState, dragTarget: PluginCanvasObject) {
    const peers = row.objects.filter((object) => object !== dragTarget);
    let cursor = this.computeCenteredStartX(row.objects);
    return peers.map((object) => {
      const slot = {
        obj: object,
        idealX: cursor,
      };
      cursor += getLayoutWidth(object) + this.options.gap;
      return slot;
    });
  }

  private computeInsertIndex(
    dragLeft: number,
    dragWidth: number,
    peers: PeerSlot[],
  ) {
    const dragCenterX = dragLeft + dragWidth / 2;
    for (const [index, peer] of peers.entries()) {
      const peerCenterX = peer.idealX + getLayoutWidth(peer.obj) / 2;
      if (dragCenterX < peerCenterX) {
        return index;
      }
    }
    return peers.length;
  }

  private computeLayout(
    insertIndex: number,
    dragTarget: PluginCanvasObject,
    peers: PeerSlot[],
  ): LayoutResult {
    const dragWidth = getLayoutWidth(dragTarget);
    const slots: LayoutSlot[] = [
      ...peers.map((peer) => ({
        kind: "peer" as const,
        width: getLayoutWidth(peer.obj),
        obj: peer.obj,
      })),
    ];
    slots.splice(insertIndex, 0, {
      kind: "placeholder" as const,
      width: dragWidth,
      obj: null,
    });

    const startX = this.computeSequenceStartX(slots.map((slot) => slot.width));
    let cursor = startX;
    const peerTargets: PeerTarget[] = [];
    let placeholderX = startX;

    slots.forEach((slot) => {
      if (slot.kind === "placeholder") {
        placeholderX = cursor;
      } else {
        peerTargets.push({
          obj: slot.obj,
          x: cursor,
        });
      }

      cursor += slot.width + this.options.gap;
    });

    return { peerTargets, placeholderX };
  }

  private applyLayout(insertIndex: number, dragTarget: PluginCanvasObject) {
    if (!this.dragRow || !this.placeholder) {
      return;
    }

    const { peerTargets, placeholderX } = this.computeLayout(
      insertIndex,
      dragTarget,
      this.peerSlots,
    );

    const placeholderPosition = getTargetPositionForVisualPlacement(
      this.placeholder,
      placeholderX,
      this.dragRow.y,
    );
    this.placeholder.set({
      left: placeholderPosition.left,
      top: placeholderPosition.top,
    });
    this.placeholder.setCoords();

    peerTargets.forEach(({ obj, x }) => {
      cancelAnimationMap(this.peerAnimations.get(obj));
      const targetPosition = getTargetPositionForVisualPlacement(
        obj,
        x,
        this.dragRow!.y,
      );
      const animations = obj.animate(
        { left: targetPosition.left, top: targetPosition.top },
        {
          duration: this.options.animDuration,
          easing: util.ease.easeOutCubic,
          onChange: () => {
            obj.setCoords();
            this.canvas.requestRenderAll();
          },
          onComplete: () => {
            obj.setCoords();
          },
        },
      );
      this.peerAnimations.set(obj, animations);
    });

    this.canvas.requestRenderAll();
  }

  private onMouseUp() {
    if (!this.dragging || !this.dragTarget || !this.dragRow) {
      return;
    }

    const target = this.dragTarget;
    const row = this.dragRow;
    const insertIndex =
      this.currentInsertIndex < 0
        ? this.peerSlots.length
        : this.currentInsertIndex;
    const { placeholderX } = this.computeLayout(
      insertIndex,
      target,
      this.peerSlots,
    );
    const settlePosition = getTargetPositionForVisualPlacement(
      target,
      placeholderX,
      row.y,
    );

    this.log?.(`释放 -> 吸附到 x=${Math.round(placeholderX)}`, "snap");

    cancelAnimationMap(this.settleAnimations.get(target));
    const animations = target.animate(
      {
        left: settlePosition.left,
        top: settlePosition.top,
      },
      {
        duration: this.options.animDuration,
        easing: util.ease.easeOutCubic,
        onChange: () => {
          target.setCoords();
          this.canvas.requestRenderAll();
        },
        onComplete: () => {
          target.setCoords();
          this.canvas.requestRenderAll();
        },
      },
    );
    this.settleAnimations.set(target, animations);

    const nextRowObjects = row.objects.filter((object) => object !== target);
    nextRowObjects.splice(insertIndex, 0, target);
    row.objects = nextRowObjects;
    this.reflowRow(row, true);

    this.removePlaceholder();
    this.dragging = false;
    this.dragTarget = null;
    this.dragRow = null;
    this.peerSlots = [];
    this.currentInsertIndex = -1;
    this.onRowsChange?.(this.rows.length);
  }

  private createPlaceholder(target: PluginCanvasObject) {
    const placeholder = new Rect({
      left: target.left ?? 0,
      top: target.top ?? 0,
      width: getLayoutWidth(target),
      height: getLayoutHeight(target),
      rx: 10,
      ry: 10,
      fill: this.options.placeholderColor,
      stroke: this.options.placeholderStroke,
      strokeWidth: 1.5,
      strokeDashArray: [6, 4],
      selectable: false,
      evented: false,
      opacity: 0,
    }) as Rect & { data?: Record<string, unknown> };

    placeholder.data = {
      isPlaceholder: true,
      layoutWidth: getLayoutWidth(target),
      layoutHeight: getLayoutHeight(target),
    };
    this.placeholder = placeholder;
    this.canvas.add(placeholder);
    this.canvas.sendObjectToBack(placeholder);

    this.canvas
      .getObjects()
      .filter((object) => (object as PluginCanvasObject).data?.isGrid)
      .forEach((gridObject) => this.canvas.sendObjectToBack(gridObject));

    util.animate({
      startValue: 0,
      endValue: 1,
      duration: 120,
      onChange: (value) => {
        if (!this.placeholder) {
          return;
        }
        this.placeholder.set("opacity", value);
        this.canvas.requestRenderAll();
      },
    });
  }

  private removePlaceholder() {
    const placeholder = this.placeholder;
    if (!placeholder) {
      return;
    }

    this.placeholder = null;
    util.animate({
      startValue: placeholder.opacity ?? 1,
      endValue: 0,
      duration: 120,
      onChange: (value) => {
        placeholder.set("opacity", value);
        this.canvas.requestRenderAll();
      },
      onComplete: () => {
        this.canvas.remove(placeholder);
        this.canvas.requestRenderAll();
      },
    });
  }

  private cleanupDrag() {
    this.dragging = false;
    this.dragTarget = null;
    this.dragRow = null;
    this.peerSlots = [];
    this.currentInsertIndex = -1;
    this.removePlaceholder();
  }

  private reflowRow(row: RowState, animated: boolean) {
    const startX = this.computeCenteredStartX(row.objects);
    let cursor = startX;

    row.objects.forEach((object) => {
      cancelAnimationMap(this.peerAnimations.get(object));
      cancelAnimationMap(this.settleAnimations.get(object));

      const nextLeft = cursor;
      const nextTop = row.y;
      const objectWidth = getLayoutWidth(object);
      const targetPosition = getTargetPositionForVisualPlacement(
        object,
        nextLeft,
        nextTop,
      );
      cursor += objectWidth + this.options.gap;

      if (animated) {
        const animations = object.animate(
          { left: targetPosition.left, top: targetPosition.top },
          {
            duration: this.options.animDuration,
            easing: util.ease.easeOutCubic,
            onChange: () => {
              object.setCoords();
              this.canvas.requestRenderAll();
            },
            onComplete: () => {
              object.setCoords();
              this.canvas.requestRenderAll();
            },
          },
        );
        this.settleAnimations.set(object, animations);
      } else {
        object.set({ left: targetPosition.left, top: targetPosition.top });
        object.setCoords();
      }
    });

    if (!animated) {
      this.canvas.requestRenderAll();
    }
  }

  private computeCenteredStartX(objects: PluginCanvasObject[]) {
    const totalWidth = this.computeSequenceWidth(
      objects.map((object) => getLayoutWidth(object)),
    );
    return (this.canvas.getWidth() - totalWidth) / 2;
  }

  private computeSequenceStartX(widths: number[]) {
    const totalWidth = this.computeSequenceWidth(widths);
    return (this.canvas.getWidth() - totalWidth) / 2;
  }

  private computeSequenceWidth(widths: number[]) {
    return widths.reduce((sum, width, index) => {
      return sum + width + (index > 0 ? this.options.gap : 0);
    }, 0);
  }
}

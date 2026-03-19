'use client'

import {
  Group,
  Line,
  Rect,
  Circle,
  FabricText,
  type Canvas,
  type FabricObject,
  util,
} from 'fabric'

export type PluginLogType = 'info' | 'move' | 'snap' | 'warn'

export type PluginLogger = (message: string, type?: PluginLogType) => void

export interface DimensionPluginOptions {
  lineColor?: string
  textColor?: string
  fontSize?: number
  offset?: number
  tickLength?: number
}

export interface SortableSnapPluginOptions {
  rowTolerance?: number
  gap?: number
  animDuration?: number
  placeholderColor?: string
  placeholderStroke?: string
  rowTop?: number
}

export interface PluginCanvasObject extends FabricObject {
  data?: Record<string, unknown>
}

interface RowState {
  y: number
  objects: PluginCanvasObject[]
}

interface PeerSlot {
  obj: PluginCanvasObject
  idealX: number
}

interface PeerTarget {
  obj: PluginCanvasObject
  x: number
}

interface LayoutResult {
  peerTargets: PeerTarget[]
  placeholderX: number
}

const DEFAULT_DIMENSION_OPTIONS: Required<DimensionPluginOptions> = {
  lineColor: '#1677ff',
  textColor: '#1677ff',
  fontSize: 11,
  offset: 16,
  tickLength: 4,
}

const DEFAULT_SORTABLE_OPTIONS: Required<SortableSnapPluginOptions> = {
  rowTolerance: 20,
  gap: 12,
  animDuration: 180,
  placeholderColor: 'rgba(22,119,255,0.12)',
  placeholderStroke: 'rgba(22,119,255,0.4)',
  rowTop: 140,
}

function isBusinessObject(object: FabricObject): object is PluginCanvasObject {
  const data = (object as PluginCanvasObject).data
  return !data?.isGrid && !data?.isPlaceholder && !data?.isDimAnnotation
}

function getBusinessObjects(canvas: Canvas): PluginCanvasObject[] {
  return canvas.getObjects().filter(isBusinessObject)
}

function toSceneBounds(object: PluginCanvasObject) {
  const bounds = object.getBoundingRect()
  return {
    left: bounds.left,
    top: bounds.top,
    width: bounds.width,
    height: bounds.height,
  }
}

function cancelAnimationMap(
  animations: Record<string, { abort?: () => void }> | undefined,
) {
  if (!animations) {
    return
  }

  Object.values(animations).forEach((animation) => animation.abort?.())
}

export class DimensionPlugin {
  private readonly canvas: Canvas
  private readonly options: Required<DimensionPluginOptions>
  private enabled = false
  private readonly handleAfterRender = () => this.draw()

  constructor(canvas: Canvas, options: DimensionPluginOptions = {}) {
    this.canvas = canvas
    this.options = { ...DEFAULT_DIMENSION_OPTIONS, ...options }
  }

  enable() {
    if (this.enabled) {
      return
    }

    this.enabled = true
    this.canvas.on('after:render', this.handleAfterRender)
    this.canvas.requestRenderAll()
  }

  disable() {
    if (!this.enabled) {
      return
    }

    this.enabled = false
    this.canvas.off('after:render', this.handleAfterRender)
    this.clearOverlay()
    this.canvas.requestRenderAll()
  }

  isEnabled() {
    return this.enabled
  }

  private draw() {
    if (!this.enabled) {
      return
    }

    const context = this.canvas.getTopContext()
    const zoom = this.canvas.getZoom() || 1
    const viewportTransform = this.canvas.viewportTransform
    const objects = getBusinessObjects(this.canvas)

    context.save()

    if (viewportTransform) {
      context.transform(
        viewportTransform[0],
        viewportTransform[1],
        viewportTransform[2],
        viewportTransform[3],
        viewportTransform[4],
        viewportTransform[5],
      )
    }

    for (const object of objects) {
      const bounds = toSceneBounds(object)
      const lineWidth = 1 / zoom
      const fontSize = this.options.fontSize / zoom
      const offset = this.options.offset / zoom

      context.strokeStyle = this.options.lineColor
      context.lineWidth = lineWidth
      context.setLineDash([])

      this.drawMeasureLine(
        context,
        bounds.left,
        bounds.top - offset,
        bounds.left + bounds.width,
        bounds.top - offset,
        `${Math.round(bounds.width)}px`,
        true,
        zoom,
      )

      this.drawMeasureLine(
        context,
        bounds.left + bounds.width + offset,
        bounds.top,
        bounds.left + bounds.width + offset,
        bounds.top + bounds.height,
        `${Math.round(bounds.height)}px`,
        false,
        zoom,
      )

      context.fillStyle = this.options.textColor
      context.font = `${fontSize}px ui-monospace, SFMono-Regular, Menlo, monospace`
      context.textAlign = 'left'
      context.textBaseline = 'bottom'
      context.fillText(
        `(${Math.round(object.left ?? 0)}, ${Math.round(object.top ?? 0)})`,
        bounds.left,
        bounds.top - offset - 3 / zoom,
      )
    }

    context.restore()
  }

  private clearOverlay() {
    const context = this.canvas.getTopContext()
    context.save()
    context.setTransform(1, 0, 0, 1, 0, 0)
    context.clearRect(0, 0, this.canvas.upperCanvasEl.width, this.canvas.upperCanvasEl.height)
    context.restore()
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
    const tickLength = this.options.tickLength / zoom
    const fontSize = this.options.fontSize / zoom
    const midX = (x1 + x2) / 2
    const midY = (y1 + y2) / 2

    context.beginPath()
    context.moveTo(x1, y1)
    context.lineTo(x2, y2)

    if (horizontal) {
      context.moveTo(x1, y1 - tickLength)
      context.lineTo(x1, y1 + tickLength)
      context.moveTo(x2, y2 - tickLength)
      context.lineTo(x2, y2 + tickLength)
    } else {
      context.moveTo(x1 - tickLength, y1)
      context.lineTo(x1 + tickLength, y1)
      context.moveTo(x2 - tickLength, y2)
      context.lineTo(x2 + tickLength, y2)
    }

    context.stroke()

    context.font = `${fontSize}px ui-monospace, SFMono-Regular, Menlo, monospace`
    const textWidth = context.measureText(label).width
    const padding = 4 / zoom

    context.fillStyle = 'rgba(8,12,24,0.88)'
    context.fillRect(
      midX - textWidth / 2 - padding,
      midY - fontSize / 2 - padding / 2,
      textWidth + padding * 2,
      fontSize + padding,
    )

    context.fillStyle = this.options.textColor
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(label, midX, midY)
  }
}

export class SortableSnapPlugin {
  private readonly canvas: Canvas
  private readonly options: Required<SortableSnapPluginOptions>
  private readonly log?: PluginLogger
  private readonly onRowsChange?: (rows: number) => void
  private readonly peerAnimations = new WeakMap<
    PluginCanvasObject,
    Record<string, { abort?: () => void }>
  >()
  private readonly settleAnimations = new WeakMap<
    PluginCanvasObject,
    Record<string, { abort?: () => void }>
  >()
  private enabled = false
  private rows: RowState[] = []
  private dragging = false
  private dragTarget: PluginCanvasObject | null = null
  private dragRow: RowState | null = null
  private placeholder: Rect | null = null
  private peerSlots: PeerSlot[] = []
  private currentInsertIndex = -1
  private readonly handleObjectMoving = (event: { target?: FabricObject }) =>
    this.onObjectMoving(event.target as PluginCanvasObject | undefined)
  private readonly handleMouseUp = () => this.onMouseUp()

  constructor(
    canvas: Canvas,
    options: SortableSnapPluginOptions = {},
    hooks: {
      log?: PluginLogger
      onRowsChange?: (rows: number) => void
    } = {},
  ) {
    this.canvas = canvas
    this.options = { ...DEFAULT_SORTABLE_OPTIONS, ...options }
    this.log = hooks.log
    this.onRowsChange = hooks.onRowsChange
  }

  enable() {
    if (this.enabled) {
      return
    }

    this.enabled = true
    this.canvas.on('object:moving', this.handleObjectMoving)
    this.canvas.on('mouse:up', this.handleMouseUp)
    this.initRows()
  }

  disable() {
    if (!this.enabled) {
      return
    }

    this.enabled = false
    this.canvas.off('object:moving', this.handleObjectMoving)
    this.canvas.off('mouse:up', this.handleMouseUp)
    this.cleanupDrag()
    this.rows = []
    this.onRowsChange?.(0)
  }

  isEnabled() {
    return this.enabled
  }

  getRows() {
    return this.rows
  }

  initRows() {
    const objects = getBusinessObjects(this.canvas)
    if (objects.length === 0) {
      this.rows = []
      this.onRowsChange?.(0)
      this.log?.('initRows: 0 行，共 0 个元素', 'info')
      return
    }

    const sortedObjects = [...objects].sort((left, right) => (left.left ?? 0) - (right.left ?? 0))
    const singleRow: RowState = { y: this.options.rowTop, objects: sortedObjects }
    this.rows = [singleRow]
    this.reflowRow(singleRow, this.enabled)
    this.onRowsChange?.(1)
    this.log?.(`initRows: 1 行，共 ${objects.length} 个元素`, 'info')
  }

  private onObjectMoving(target?: PluginCanvasObject) {
    if (
      !target ||
      !isBusinessObject(target) ||
      !this.enabled
    ) {
      return
    }

    if (!this.dragging || this.dragTarget !== target) {
      this.startDrag(target)
    }

    if (!this.dragging || !this.dragRow || !this.dragTarget) {
      return
    }

    target.set({
      top: this.dragRow.y,
    })
    target.setCoords()

    const insertIndex = this.computeInsertIndex(
      target.left ?? 0,
      target.getScaledWidth(),
      this.peerSlots,
    )

    if (insertIndex === this.currentInsertIndex) {
      return
    }

    this.currentInsertIndex = insertIndex
    this.applyLayout(insertIndex, target)
    this.log?.(`插入位置 -> [${insertIndex}]`, 'move')
  }

  private startDrag(target: PluginCanvasObject) {
    this.cleanupDrag()

    const row = this.rows.find((candidate) => candidate.objects.includes(target))
    if (!row) {
      this.log?.('元素不在任何行中，跳过拖动接管', 'warn')
      return
    }

    this.dragging = true
    this.dragTarget = target
    this.dragRow = row
    this.peerSlots = this.computePeerSlots(row, target)
    this.currentInsertIndex = -1
    this.createPlaceholder(target)
    this.log?.(`开始拖动，锁定到行 y=${row.y}`, 'info')
  }

  private computePeerSlots(row: RowState, dragTarget: PluginCanvasObject) {
    const peers = row.objects.filter((object) => object !== dragTarget)
    let cursor = this.computeCenteredStartX(row.objects)
    return peers.map((object) => {
      const slot = {
        obj: object,
        idealX: cursor,
      }
      cursor += object.getScaledWidth() + this.options.gap
      return slot
    })
  }

  private computeInsertIndex(dragLeft: number, dragWidth: number, peers: PeerSlot[]) {
    const dragCenterX = dragLeft + dragWidth / 2
    for (const [index, peer] of peers.entries()) {
      const peerCenterX = peer.idealX + peer.obj.getScaledWidth() / 2
      if (dragCenterX < peerCenterX) {
        return index
      }
    }
    return peers.length
  }

  private computeLayout(
    insertIndex: number,
    dragTarget: PluginCanvasObject,
    peers: PeerSlot[],
  ): LayoutResult {
    const dragWidth = dragTarget.getScaledWidth()
    const fallbackStartX = dragTarget.left ?? 0
    const startX = peers[0]?.idealX ?? fallbackStartX
    let cursor = startX
    const peerTargets: PeerTarget[] = []

    peers.forEach((peer, index) => {
      if (index === insertIndex) {
        cursor += dragWidth + this.options.gap
      }

      peerTargets.push({
        obj: peer.obj,
        x: cursor,
      })

      cursor += peer.obj.getScaledWidth() + this.options.gap
    })

    let placeholderX = startX
    if (insertIndex === 0) {
      placeholderX = startX
    } else if (insertIndex >= peers.length) {
      const lastPeerTarget = peerTargets.at(-1)
      const lastPeer = peers.at(-1)
      placeholderX = lastPeerTarget && lastPeer
        ? lastPeerTarget.x + lastPeer.obj.getScaledWidth() + this.options.gap
        : fallbackStartX
    } else {
      placeholderX = peerTargets[insertIndex]!.x - dragWidth - this.options.gap
    }

    return { peerTargets, placeholderX }
  }

  private applyLayout(insertIndex: number, dragTarget: PluginCanvasObject) {
    if (!this.dragRow || !this.placeholder) {
      return
    }

    const { peerTargets, placeholderX } = this.computeLayout(
      insertIndex,
      dragTarget,
      this.peerSlots,
    )

    this.placeholder.set({
      left: placeholderX,
      top: this.dragRow.y,
    })
    this.placeholder.setCoords()

    peerTargets.forEach(({ obj, x }) => {
      cancelAnimationMap(this.peerAnimations.get(obj))
      const animations = obj.animate(
        { left: x, top: this.dragRow!.y },
        {
          duration: this.options.animDuration,
          easing: util.ease.easeOutCubic,
          onChange: () => {
            obj.setCoords()
            this.canvas.requestRenderAll()
          },
          onComplete: () => {
            obj.setCoords()
          },
        },
      )
      this.peerAnimations.set(obj, animations)
    })

    this.canvas.requestRenderAll()
  }

  private onMouseUp() {
    if (!this.dragging || !this.dragTarget || !this.dragRow) {
      return
    }

    const target = this.dragTarget
    const row = this.dragRow
    const insertIndex =
      this.currentInsertIndex < 0 ? this.peerSlots.length : this.currentInsertIndex
    const { placeholderX } = this.computeLayout(insertIndex, target, this.peerSlots)

    this.log?.(`释放 -> 吸附到 x=${Math.round(placeholderX)}`, 'snap')

    cancelAnimationMap(this.settleAnimations.get(target))
    const animations = target.animate(
      {
        left: placeholderX,
        top: row.y,
      },
      {
        duration: this.options.animDuration,
        easing: util.ease.easeOutCubic,
        onChange: () => {
          target.setCoords()
          this.canvas.requestRenderAll()
        },
        onComplete: () => {
          target.setCoords()
          this.canvas.requestRenderAll()
        },
      },
    )
    this.settleAnimations.set(target, animations)

    const nextRowObjects = row.objects.filter((object) => object !== target)
    nextRowObjects.splice(insertIndex, 0, target)
    row.objects = nextRowObjects
    this.reflowRow(row, true)

    this.removePlaceholder()
    this.dragging = false
    this.dragTarget = null
    this.dragRow = null
    this.peerSlots = []
    this.currentInsertIndex = -1
    this.onRowsChange?.(this.rows.length)
  }

  private createPlaceholder(target: PluginCanvasObject) {
    const placeholder = new Rect({
      left: target.left ?? 0,
      top: target.top ?? 0,
      width: target.getScaledWidth(),
      height: target.getScaledHeight(),
      rx: 10,
      ry: 10,
      fill: this.options.placeholderColor,
      stroke: this.options.placeholderStroke,
      strokeWidth: 1.5,
      strokeDashArray: [6, 4],
      selectable: false,
      evented: false,
      opacity: 0,
    }) as Rect & { data?: Record<string, unknown> }

    placeholder.data = { isPlaceholder: true }
    this.placeholder = placeholder
    this.canvas.add(placeholder)
    this.canvas.sendObjectToBack(placeholder)

    this.canvas
      .getObjects()
      .filter((object) => (object as PluginCanvasObject).data?.isGrid)
      .forEach((gridObject) => this.canvas.sendObjectToBack(gridObject))

    util.animate({
      startValue: 0,
      endValue: 1,
      duration: 120,
      onChange: (value) => {
        if (!this.placeholder) {
          return
        }
        this.placeholder.set('opacity', value)
        this.canvas.requestRenderAll()
      },
    })
  }

  private removePlaceholder() {
    const placeholder = this.placeholder
    if (!placeholder) {
      return
    }

    this.placeholder = null
    util.animate({
      startValue: placeholder.opacity ?? 1,
      endValue: 0,
      duration: 120,
      onChange: (value) => {
        placeholder.set('opacity', value)
        this.canvas.requestRenderAll()
      },
      onComplete: () => {
        this.canvas.remove(placeholder)
        this.canvas.requestRenderAll()
      },
    })
  }

  private cleanupDrag() {
    this.dragging = false
    this.dragTarget = null
    this.dragRow = null
    this.peerSlots = []
    this.currentInsertIndex = -1
    this.removePlaceholder()
  }

  private reflowRow(row: RowState, animated: boolean) {
    const startX = this.computeCenteredStartX(row.objects)
    let cursor = startX

    row.objects.forEach((object) => {
      cancelAnimationMap(this.peerAnimations.get(object))
      cancelAnimationMap(this.settleAnimations.get(object))

      const nextLeft = cursor
      const nextTop = row.y
      cursor += object.getScaledWidth() + this.options.gap

      if (animated) {
        const animations = object.animate(
          { left: nextLeft, top: nextTop },
          {
            duration: this.options.animDuration,
            easing: util.ease.easeOutCubic,
            onChange: () => {
              object.setCoords()
              this.canvas.requestRenderAll()
            },
            onComplete: () => {
              object.setCoords()
              this.canvas.requestRenderAll()
            },
          },
        )
        this.settleAnimations.set(object, animations)
      } else {
        object.set({ left: nextLeft, top: nextTop })
        object.setCoords()
      }
    })

    if (!animated) {
      this.canvas.requestRenderAll()
    }
  }

  private computeCenteredStartX(objects: PluginCanvasObject[]) {
    const totalWidth = objects.reduce((sum, object, index) => {
      const width = object.getScaledWidth()
      return sum + width + (index > 0 ? this.options.gap : 0)
    }, 0)
    return (this.canvas.getWidth() - totalWidth) / 2
  }
}

export const SCENE_ROWS = {
  row1: 140,
}

const GRID_SIZE = 40

const DEFAULT_COLORS = [
  '#1e40af',
  '#0f766e',
  '#dc2626',
  '#d97706',
  '#2563eb',
  '#7c3aed',
  '#db2777',
  '#059669',
]

const DEFAULT_LABELS = [
  'Button',
  'Input',
  'Card',
  'Modal',
  'Table',
  'Form',
  'List',
  'Badge',
  'Panel',
  'Block',
]

export function getPalette() {
  return DEFAULT_COLORS
}

export function getLabel(index: number) {
  return DEFAULT_LABELS[index % DEFAULT_LABELS.length]!
}

export function addGrid(canvas: Canvas, width: number, height: number) {
  const lines: Line[] = []

  for (let x = 0; x <= width; x += GRID_SIZE) {
    const line = new Line([x, 0, x, height], {
      stroke: '#d9e0f0',
      strokeWidth: 1,
      selectable: false,
      evented: false,
    }) as Line & { data?: Record<string, unknown> }
    line.data = { isGrid: true }
    lines.push(line)
  }

  for (let y = 0; y <= height; y += GRID_SIZE) {
    const line = new Line([0, y, width, y], {
      stroke: '#d9e0f0',
      strokeWidth: 1,
      selectable: false,
      evented: false,
    }) as Line & { data?: Record<string, unknown> }
    line.data = { isGrid: true }
    lines.push(line)
  }

  canvas.add(...lines)
}

export function clearBusinessObjects(canvas: Canvas) {
  canvas
    .getObjects()
    .filter((object) => !(object as PluginCanvasObject).data?.isGrid)
    .forEach((object) => canvas.remove(object))
}

export function createLabeledRect(params: {
  left: number
  top: number
  width: number
  height?: number
  color: string
  label: string
}) {
  const { left, top, width, height = 60, color, label } = params

  return new Group(
    [
      new Rect({
        width,
        height,
        fill: `${color}20`,
        stroke: color,
        strokeWidth: 2,
        rx: 10,
        ry: 10,
      }),
      new FabricText(label, {
        left: width / 2,
        top: height / 2,
        originX: 'center',
        originY: 'center',
        fontSize: 12,
        fontWeight: 600,
        fill: color,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      }),
    ],
    {
      left,
      top,
      subTargetCheck: false,
    },
  )
}

export function createCircleBadge(params: {
  left: number
  top: number
  radius: number
  color: string
}) {
  const { left, top, radius, color } = params
  return new Circle({
    left,
    top,
    radius,
    fill: `${color}20`,
    stroke: color,
    strokeWidth: 2,
  })
}

export function businessObjectsCount(canvas: Canvas) {
  return getBusinessObjects(canvas).length
}

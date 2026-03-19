'use client'

import Link from 'next/link'
import {
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
  type PropsWithChildren,
} from 'react'
import { Canvas } from 'fabric'
import {
  DimensionPlugin,
  SortableSnapPlugin,
  addGrid,
  businessObjectsCount,
  clearBusinessObjects,
  createCircleBadge,
  createLabeledRect,
  getLabel,
  getPalette,
  SCENE_ROWS,
  type PluginLogType,
} from './utils/fabricPlugins'

const CANVAS_WIDTH = 760
const CANVAS_HEIGHT = 480
const OBJECT_GAP = 14

type LogItem = {
  id: number
  type: PluginLogType
  message: string
  time: string
}

type StatsState = {
  count: number
  rows: number
  selected: string
}

function getObjectLayoutWidth(object: { data?: Record<string, unknown>; width?: number; scaleX?: number | null; getScaledWidth: () => number }) {
  const layoutWidth = typeof object.data?.layoutWidth === 'number'
    ? object.data.layoutWidth
    : object.width
  return layoutWidth ? layoutWidth * (object.scaleX ?? 1) : object.getScaledWidth()
}

const PRESET_ONE = [
  { width: 104, color: '#1d4ed8', label: '组件 A' },
  { width: 128, color: '#0f766e', label: '组件 B' },
  { width: 92, color: '#dc2626', label: '组件 C' },
]

function nowText() {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date())
}

export default function PluginsPage() {
  const canvasElementRef = useRef<HTMLCanvasElement | null>(null)
  const canvasRef = useRef<Canvas | null>(null)
  const dimensionPluginRef = useRef<DimensionPlugin | null>(null)
  const sortablePluginRef = useRef<SortableSnapPlugin | null>(null)
  const rowOneCursorRef = useRef(60)
  const labelIndexRef = useRef(0)
  const logIdRef = useRef(0)

  const [selectedColor, setSelectedColor] = useState(getPalette()[0]!)
  const [logs, setLogs] = useState<LogItem[]>([])
  const [stats, setStats] = useState<StatsState>({
    count: 0,
    rows: 0,
    selected: '—',
  })
  const [dimensionEnabled, setDimensionEnabled] = useState(false)
  const [sortableEnabled, setSortableEnabled] = useState(false)

  const appendLog = (message: string, type: PluginLogType = 'info') => {
    const item: LogItem = {
      id: ++logIdRef.current,
      type,
      message,
      time: nowText(),
    }

    setLogs((current) => [...current.slice(-59), item])
  }

  const updateStats = () => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const activeObject = canvas.getActiveObject()
    const selected = activeObject
      ? `(${Math.round(activeObject.left ?? 0)}, ${Math.round(activeObject.top ?? 0)}) ${Math.round(activeObject.getScaledWidth())}×${Math.round(activeObject.getScaledHeight())}`
      : '—'

    setStats({
      count: businessObjectsCount(canvas),
      rows: sortablePluginRef.current?.getRows().length ?? 0,
      selected,
    })
  }

  const syncRowCursorFromCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const businessObjects = canvas
      .getObjects()
      .filter((object) => !(object as { data?: Record<string, unknown> }).data?.isGrid)

    if (businessObjects.length === 0) {
      rowOneCursorRef.current = 60
      return
    }

    const rightMost = businessObjects.reduce((max, object) => {
      const objectRight = (object.left ?? 0) + getObjectLayoutWidth(object)
      return Math.max(max, objectRight)
    }, 0)

    rowOneCursorRef.current = rightMost + OBJECT_GAP
  }

  useEffect(() => {
    const canvasElement = canvasElementRef.current
    if (!canvasElement) {
      return
    }

    const canvas = new Canvas(canvasElement, {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      backgroundColor: '#f8fbff',
      preserveObjectStacking: true,
      selection: false,
    })

    canvasRef.current = canvas
    addGrid(canvas, CANVAS_WIDTH, CANVAS_HEIGHT)

    const dimensionPlugin = new DimensionPlugin(canvas, {
      lineColor: '#2563eb',
      textColor: '#2563eb',
      offset: 18,
    })
    const sortablePlugin = new SortableSnapPlugin(
      canvas,
      {
        gap: OBJECT_GAP,
        rowTolerance: 24,
        animDuration: 180,
        placeholderColor: 'rgba(37,99,235,0.12)',
        placeholderStroke: 'rgba(37,99,235,0.38)',
        rowTop: SCENE_ROWS.row1,
      },
      {
        log: appendLog,
        onRowsChange: () => updateStats(),
      },
    )

    dimensionPluginRef.current = dimensionPlugin
    sortablePluginRef.current = sortablePlugin

    const handleCanvasMutation = () => updateStats()
    canvas.on('selection:created', handleCanvasMutation)
    canvas.on('selection:updated', handleCanvasMutation)
    canvas.on('selection:cleared', handleCanvasMutation)
    canvas.on('object:modified', handleCanvasMutation)
    canvas.on('object:moving', handleCanvasMutation)
    canvas.on('object:added', handleCanvasMutation)
    canvas.on('object:removed', handleCanvasMutation)

    loadPresetOne(canvas, sortablePlugin, appendLog, rowOneCursorRef)
    updateStats()

    return () => {
      dimensionPlugin.disable()
      sortablePlugin.disable()
      canvas.dispose()
      canvasRef.current = null
      dimensionPluginRef.current = null
      sortablePluginRef.current = null
    }
  }, [])

  const addRect = () => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const width = 92 + (labelIndexRef.current % 4) * 12
    const object = createLabeledRect({
      left: rowOneCursorRef.current,
      top: SCENE_ROWS.row1,
      width,
      color: selectedColor,
      label: getLabel(labelIndexRef.current),
    })

    labelIndexRef.current += 1
    rowOneCursorRef.current += getObjectLayoutWidth(object) + OBJECT_GAP
    canvas.add(object)
    if (sortablePluginRef.current?.isEnabled()) {
      sortablePluginRef.current.initRows()
      sortablePluginRef.current.normalizeLayout(false)
      syncRowCursorFromCanvas()
    }
    canvas.setActiveObject(object)
    canvas.requestRenderAll()
    appendLog('添加矩形到单行画布', 'info')
    updateStats()
  }

  const addCircleToRowOne = () => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const radius = 28 + (labelIndexRef.current % 3) * 6
    const object = createCircleBadge({
      left: rowOneCursorRef.current,
      top: SCENE_ROWS.row1 + 2,
      radius,
      color: selectedColor,
    })

    labelIndexRef.current += 1
    rowOneCursorRef.current += getObjectLayoutWidth(object) + OBJECT_GAP
    canvas.add(object)
    if (sortablePluginRef.current?.isEnabled()) {
      sortablePluginRef.current.initRows()
      sortablePluginRef.current.normalizeLayout(false)
      syncRowCursorFromCanvas()
    }
    canvas.setActiveObject(object)
    canvas.requestRenderAll()
    appendLog('添加圆形到行 1', 'info')
    updateStats()
  }

  const clearScene = () => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    clearBusinessObjects(canvas)
    rowOneCursorRef.current = 60
    labelIndexRef.current = 0
    sortablePluginRef.current?.isEnabled() && sortablePluginRef.current.initRows()
    canvas.discardActiveObject()
    canvas.requestRenderAll()
    appendLog('画布已清空', 'warn')
    updateStats()
  }

  const handleLoadPresetOne = () => {
    const canvas = canvasRef.current
    const sortablePlugin = sortablePluginRef.current
    if (!canvas || !sortablePlugin) {
      return
    }

    loadPresetOne(canvas, sortablePlugin, appendLog, rowOneCursorRef)
    syncRowCursorFromCanvas()
    labelIndexRef.current = PRESET_ONE.length
    updateStats()
  }

  const toggleDimensionPlugin = (enabled: boolean) => {
    const plugin = dimensionPluginRef.current
    if (!plugin) {
      return
    }

    if (enabled) {
      plugin.enable()
    } else {
      plugin.disable()
    }

    setDimensionEnabled(enabled)
    appendLog(`尺寸标注插件${enabled ? '已开启' : '已关闭'}`, 'info')
  }

  const toggleSortablePlugin = (enabled: boolean) => {
    const plugin = sortablePluginRef.current
    if (!plugin) {
      return
    }

    if (enabled) {
      plugin.enable()
      plugin.normalizeLayout(false)
      syncRowCursorFromCanvas()
    } else {
      plugin.disable()
    }

    setSortableEnabled(enabled)
    appendLog(`换位吸附插件${enabled ? '已开启' : '已关闭'}`, 'info')
    updateStats()
  }

  const zoomCanvas = (nextZoom: number) => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    canvas.setZoom(nextZoom)
    canvas.requestRenderAll()
    appendLog(`画布缩放到 ${Math.round(nextZoom * 100)}%`, 'info')
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#f8fbff,_#eef4ff_48%,_#e8eefb)] text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col px-4 py-4 md:px-6">
        <header className="mb-4 flex flex-col gap-3 rounded-[24px] border border-white/70 bg-white/80 px-5 py-4 shadow-[0_20px_80px_rgba(37,99,235,0.12)] backdrop-blur md:flex-row md:items-center">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.35em] text-blue-700">
              fabric.plugins
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              Fabric.js 插件演示页
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              按照 PRD 实现 `DimensionPlugin` 和 `SortableSnapPlugin`，并修复旧 demo 的 Fabric 版本与布局稳定性问题。
            </p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <span className={`rounded-full border px-3 py-1 text-[11px] font-medium ${dimensionEnabled ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
              DimensionPlugin
            </span>
            <span className={`rounded-full border px-3 py-1 text-[11px] font-medium ${sortableEnabled ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
              SortableSnapPlugin
            </span>
            <Link
              href="/"
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-600 transition hover:border-slate-300 hover:text-slate-950"
            >
              返回首页
            </Link>
          </div>
        </header>

        <div className="grid flex-1 gap-4 xl:grid-cols-[280px_minmax(0,1fr)_260px]">
          <aside className="rounded-[24px] border border-white/70 bg-white/82 p-4 shadow-[0_16px_60px_rgba(15,23,42,0.08)] backdrop-blur">
            <SectionTitle title="插件控制" />
            <PluginCard
              active={dimensionEnabled}
              description="在 upper canvas 上叠加绘制宽度、高度与坐标标注。"
              title="尺寸标注"
              checked={dimensionEnabled}
              onChange={toggleDimensionPlugin}
            />
            <PluginCard
              active={sortableEnabled}
              description="横向拖动锁轴、插入排序预览、释放后平滑吸附。"
              title="换位吸附"
              checked={sortableEnabled}
              onChange={toggleSortablePlugin}
            />

            <SectionTitle title="添加元素" className="mt-6" />
            <div className="grid gap-2">
              <SidebarButton onClick={addRect}>＋ 矩形</SidebarButton>
              <SidebarButton onClick={addCircleToRowOne}>＋ 圆形</SidebarButton>
            </div>

            <SectionTitle title="填充颜色" className="mt-6" />
            <div className="flex flex-wrap gap-2">
              {getPalette().map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`切换颜色 ${color}`}
                  onClick={() => setSelectedColor(color)}
                  className={`h-7 w-7 rounded-full border-2 transition ${selectedColor === color ? 'scale-110 border-slate-950' : 'border-white hover:scale-105'}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>

            <SectionTitle title="场景预设" className="mt-6" />
            <div className="grid gap-2">
              <SidebarButton onClick={handleLoadPresetOne}>重置单行排布</SidebarButton>
              <SidebarButton danger onClick={clearScene}>清空画布</SidebarButton>
            </div>
          </aside>

          <section className="flex min-h-[720px] flex-col rounded-[28px] border border-white/70 bg-white/72 shadow-[0_22px_80px_rgba(15,23,42,0.09)] backdrop-blur">
            <div className="flex flex-wrap items-center gap-3 border-b border-slate-200/80 px-5 py-4">
              <span className="text-[11px] font-semibold uppercase tracking-[0.35em] text-slate-500">
                Canvas
              </span>
              <span className="text-sm text-slate-500">
                拖动元素体验锁轴换位和占位吸附，开启尺寸标注后可验证 overlay 绘制。
              </span>
              <div className="ml-auto flex gap-2">
                <ToolbarButton onClick={() => zoomCanvas(0.8)}>80%</ToolbarButton>
                <ToolbarButton onClick={() => zoomCanvas(1)}>100%</ToolbarButton>
                <ToolbarButton onClick={() => zoomCanvas(1.2)}>120%</ToolbarButton>
              </div>
            </div>

            <div className="flex flex-1 items-center justify-center p-5">
              <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-[#f8fbff] shadow-[0_18px_60px_rgba(37,99,235,0.12)]">
                <canvas ref={canvasElementRef} />
              </div>
            </div>

            <div className="grid gap-3 border-t border-slate-200/80 px-5 py-4 text-xs text-slate-600 md:grid-cols-3">
              <Stat label="对象数" value={String(stats.count)} accent="text-blue-700" />
              <Stat label="行数" value={String(stats.rows)} accent="text-emerald-700" />
              <Stat label="选中" value={stats.selected} accent="text-slate-900" />
            </div>
          </section>

          <aside className="rounded-[24px] border border-white/70 bg-[#0f172a] p-4 text-slate-100 shadow-[0_16px_60px_rgba(15,23,42,0.18)]">
            <div className="flex items-center justify-between">
              <SectionTitle dark title="Event Log" />
              <button
                type="button"
                onClick={() => setLogs([])}
                className="text-[11px] uppercase tracking-[0.25em] text-slate-400 transition hover:text-rose-300"
              >
                clear
              </button>
            </div>

            <div className="mt-4 flex h-[640px] flex-col gap-2 overflow-y-auto pr-1">
              {logs.length === 0 ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-6 text-center text-xs leading-6 text-slate-500">
                  暂无事件
                  <br />
                  开启插件后开始拖动元素
                </div>
              ) : (
                logs.map((item) => (
                  <div
                    key={item.id}
                    className={`rounded-2xl border px-3 py-2 text-xs leading-5 ${logStyle(item.type)}`}
                  >
                    <div className="font-medium text-slate-300">{item.time}</div>
                    <div>{item.message}</div>
                  </div>
                ))
              )}
            </div>
          </aside>
        </div>
      </div>
    </main>
  )
}

function loadPresetOne(
  canvas: Canvas,
  sortablePlugin: SortableSnapPlugin,
  appendLog: (message: string, type?: PluginLogType) => void,
  rowOneCursorRef: MutableRefObject<number>,
) {
  clearBusinessObjects(canvas)

  let cursor = 60
  PRESET_ONE.forEach((item) => {
    const object = createLabeledRect({
      left: cursor,
      top: SCENE_ROWS.row1,
      width: item.width,
      color: item.color,
      label: item.label,
    })
    canvas.add(object)
    cursor += getObjectLayoutWidth(object) + OBJECT_GAP
  })

  rowOneCursorRef.current = cursor
  sortablePlugin.isEnabled() && sortablePlugin.initRows()
  canvas.discardActiveObject()
  canvas.requestRenderAll()
  appendLog('加载单行排布', 'info')
}

function SectionTitle(props: { title: string; className?: string; dark?: boolean }) {
  return (
    <div
      className={`text-[11px] font-semibold uppercase tracking-[0.35em] ${props.dark ? 'text-slate-500' : 'text-slate-500'} ${props.className ?? ''}`}
    >
      {props.title}
    </div>
  )
}

function PluginCard(props: {
  active: boolean
  title: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className={`mt-3 rounded-[22px] border p-4 transition ${props.active ? 'border-blue-200 bg-blue-50/80' : 'border-slate-200 bg-slate-50/80'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">{props.title}</div>
          <p className="mt-1 text-xs leading-5 text-slate-600">{props.description}</p>
        </div>
        <label className="relative mt-1 inline-flex cursor-pointer items-center">
          <input
            type="checkbox"
            className="peer sr-only"
            aria-label={`${props.title}开关`}
            checked={props.checked}
            onChange={(event) => props.onChange(event.target.checked)}
          />
          <span className="h-6 w-11 rounded-full bg-slate-300 transition peer-checked:bg-blue-600" />
          <span className="absolute left-1 h-4 w-4 rounded-full bg-white transition peer-checked:translate-x-5" />
        </label>
      </div>
    </div>
  )
}

function SidebarButton(
  props: PropsWithChildren<{ onClick: () => void; danger?: boolean }>,
) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
        props.danger
          ? 'border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300 hover:bg-rose-100'
          : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white hover:text-slate-950'
      }`}
    >
      {props.children}
    </button>
  )
}

function ToolbarButton(props: PropsWithChildren<{ onClick: () => void }>) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-600 transition hover:border-slate-300 hover:text-slate-950"
    >
      {props.children}
    </button>
  )
}

function Stat(props: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-400">
        {props.label}
      </div>
      <div className={`mt-2 text-sm font-semibold ${props.accent}`}>{props.value}</div>
    </div>
  )
}

function logStyle(type: PluginLogType) {
  switch (type) {
    case 'snap':
      return 'border-emerald-900/60 bg-emerald-950/40 text-emerald-300'
    case 'move':
      return 'border-slate-700 bg-slate-900/70 text-slate-300'
    case 'warn':
      return 'border-rose-900/60 bg-rose-950/40 text-rose-300'
    default:
      return 'border-blue-900/60 bg-blue-950/40 text-blue-300'
  }
}

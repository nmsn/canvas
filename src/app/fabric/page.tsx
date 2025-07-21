'use client'

import { useEffect, useRef, useState, type FC } from 'react'
import { Canvas, Rect, type FabricObject, util } from 'fabric'

/**
 * 页面属性类型定义
 */
type PageProps = Record<string, never>

/**
 * 正方形配置接口
 */
interface SquareConfig {
  id: string
  color: string
  size: number
  label: string
}

/**
 * 预定义的正方形配置
 */
const SQUARE_CONFIGS: SquareConfig[] = [
  { id: '1', color: '#ff6b6b', size: 60, label: '红色方块' },
  { id: '2', color: '#4ecdc4', size: 60, label: '青色方块' },
  { id: '3', color: '#45b7d1', size: 60, label: '蓝色方块' },
  { id: '4', color: '#96ceb4', size: 60, label: '绿色方块' },
  { id: '5', color: '#feca57', size: 60, label: '黄色方块' },
  { id: '6', color: '#ff9ff3', size: 60, label: '粉色方块' },
]

/**
 * 画布中正方形的位置信息接口
 */
interface CanvasSquare {
  id: string
  fabricObject: Rect
  config: SquareConfig
  position: number // 在横向排列中的位置索引
}

/**
 * Fabric.js 画布页面组件
 */
const FabricPage: FC<PageProps> = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fabricCanvasRef = useRef<Canvas | null>(null)
  const [draggedSquare, setDraggedSquare] = useState<SquareConfig | null>(null)
  const [canvasSquares, setCanvasSquares] = useState<CanvasSquare[]>([])
  const [isDraggingInCanvas, setIsDraggingInCanvas] = useState(false)
  const [draggedCanvasSquare, setDraggedCanvasSquare] = useState<CanvasSquare | null>(null)

  /**
   * 初始化 Fabric.js 画布
   */
  useEffect(() => {
    if (typeof window === 'undefined' || !canvasRef.current) return

    // 创建 Fabric.js 画布实例
    const canvas = new Canvas(canvasRef.current, {
      width: 800,
      height: 600,
      backgroundColor: '#f8f9fa',
      selection: false, // 禁用框选
    })

    // 添加画布点击事件监听器
    canvas.on('mouse:down', (e: { target: FabricObject | undefined }) => handleCanvasClick(e as { target?: Rect }))

    // 添加对象移动结束事件监听器
    canvas.on('object:moving', handleObjectMoving)
    canvas.on('object:modified', handleObjectMoved)

    fabricCanvasRef.current = canvas

    // 清理函数
    return () => {
      canvas.off('mouse:down', handleCanvasClick)
      canvas.off('object:moving', handleObjectMoving)
      canvas.off('object:modified', handleObjectMoved)
      canvas.dispose().catch((err) => console.error(err))
    }
  }, [])

  /**
   * 处理对象移动中事件
   * @param e - Fabric.js 事件对象
   */
  const handleObjectMoving = (e: { target: FabricObject }) => {
    // 限制移动范围，保持在画布内
    const obj = e.target
    const canvas = fabricCanvasRef.current
    if (!canvas || !obj) return

    // 限制移动边界
    obj.set({
      left: Math.max(0, Math.min((canvas.width || 800) - (obj.width || 0), obj.left || 0)),
      top: Math.max(0, Math.min((canvas.height || 600) - (obj.height || 0), obj.top || 0)),
    })
  }

  /**
   * 处理对象移动结束事件
   * @param e - Fabric.js 事件对象
   */
  const handleObjectMoved = (e: { target: FabricObject }) => {
    const movedObject = e.target
    if (!movedObject) return

    // 找到被移动的正方形
    const movedSquare = canvasSquares.find(s => s.fabricObject === movedObject)
    if (!movedSquare) return

    // 计算最接近的位置索引
    const currentX = movedObject.left || 0
    const targetIndex = Math.round((currentX - 50) / (movedSquare.config.size + 20))
    const clampedIndex = Math.max(0, Math.min(canvasSquares.length - 1, targetIndex))

    // 如果位置发生变化，重新排序
    if (clampedIndex !== movedSquare.position) {
      const newSquares = [...canvasSquares]
      const currentIndex = newSquares.findIndex(s => s.id === movedSquare.id)

      if (currentIndex !== -1) {
        // 移除当前元素
        const [removedSquare] = newSquares.splice(currentIndex, 1)
        // 插入到新位置
        if (removedSquare) {
          newSquares.splice(clampedIndex, 0, removedSquare)
        }

        setCanvasSquares(newSquares)

        // 延迟重新排列，使用动画
        setTimeout(() => {
          void rearrangeSquares(true)
        }, 50)
      }
    } else {
      // 如果位置没有变化，回到原位置
      void rearrangeSquares(true)
    }
  }

  /**
   * 当画布中的正方形数组发生变化时，重新排列位置
   */
  useEffect(() => {
    void rearrangeSquares(false)
  }, [canvasSquares.length])

  /**
   * 处理拖拽开始事件
   * @param square - 被拖拽的正方形配置
   */
  const handleDragStart = (square: SquareConfig) => {
    setDraggedSquare(square)
  }

  /**
   * 处理拖拽结束事件
   */
  const handleDragEnd = () => {
    setDraggedSquare(null)
  }

  /**
   * 计算正方形在画布中的横向排列位置
   * @param index - 正方形在数组中的索引
   * @param squareSize - 正方形的尺寸
   * @returns 计算后的 x 坐标
   */
  const calculateSquarePosition = (index: number, squareSize: number): number => {
    const spacing = 20 // 间距
    const startX = 50 // 起始 x 坐标
    return startX + index * (squareSize + spacing)
  }

  /**
   * 重新排列画布中的所有正方形
   * @param animated - 是否使用动画效果
   */
  const rearrangeSquares = (animated = false) => {
    if (!fabricCanvasRef.current) return

    canvasSquares.forEach((square, index) => {
      const newX = calculateSquarePosition(index, square.config.size)
      const yPosition = 100 // 固定的 y 坐标

      if (animated) {
        // 使用动画移动到新位置
        square.fabricObject.animate({
          left: newX,
          top: yPosition,
        }, {
          duration: 300,
          easing: util.ease.easeOutCubic,
          onChange: () => fabricCanvasRef.current?.renderAll(),
        })
      } else {
        // 直接设置位置
        square.fabricObject.set({
          left: newX,
          top: yPosition,
        })
      }

      square.position = index
    })

    if (!animated) {
      fabricCanvasRef.current.renderAll()
    }
  }

  /**
   * 处理画布区域的拖拽放置事件
   * @param e - 拖拽事件对象
   */
  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault()

    if (!draggedSquare || !fabricCanvasRef.current) return

    // 计算新正方形的位置
    const newIndex = canvasSquares.length
    const xPosition = calculateSquarePosition(newIndex, draggedSquare.size)
    const yPosition = 100

    // 创建 Fabric.js 矩形对象
    const fabricRect = new Rect({
      left: xPosition,
      top: yPosition,
      width: draggedSquare.size,
      height: draggedSquare.size,
      fill: draggedSquare.color,
      stroke: '#333',
      strokeWidth: 2,
      selectable: true,
      moveable: true, // 允许拖拽移动
      hasControls: false, // 禁用缩放控制
      hasBorders: true,
      lockRotation: true, // 禁用旋转
      lockScalingX: true, // 禁用水平缩放
      lockScalingY: true, // 禁用垂直缩放
    })

    // 创建画布正方形对象
    const newCanvasSquare: CanvasSquare = {
      id: `canvas-${Date.now()}-${Math.random()}`,
      fabricObject: fabricRect,
      config: draggedSquare,
      position: newIndex,
    }

    // 添加事件监听器
    fabricRect.on('mousedown', () => handleSquareMouseDown(newCanvasSquare))
    fabricRect.on('mouseover', () => handleSquareMouseOver(newCanvasSquare))
    fabricRect.on('mouseout', () => handleSquareMouseOut(newCanvasSquare))

    // 添加到画布和状态
    fabricCanvasRef.current.add(fabricRect)
    setCanvasSquares(prev => [...prev, newCanvasSquare])
    fabricCanvasRef.current.renderAll()

    // 重置拖拽状态
    setDraggedSquare(null)
  }

  /**
   * 处理画布区域的拖拽悬停事件
   * @param e - 拖拽事件对象
   */
  const handleCanvasDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  /**
   * 处理画布中正方形的鼠标按下事件
   * @param square - 被点击的正方形
   */
  const handleSquareMouseDown = (square: CanvasSquare) => {
    if (!isDraggingInCanvas) {
      setDraggedCanvasSquare(square)
      setIsDraggingInCanvas(true)
      // 高亮显示被选中的正方形
      square.fabricObject.set({ stroke: '#007bff', strokeWidth: 3 })
      fabricCanvasRef.current?.renderAll()
    }
  }

  /**
   * 处理画布中正方形的鼠标悬停事件
   * @param square - 悬停的正方形
   */
  const handleSquareMouseOver = (square: CanvasSquare) => {
    if (isDraggingInCanvas && draggedCanvasSquare && draggedCanvasSquare.id !== square.id) {
      // 高亮显示可交换的目标正方形
      square.fabricObject.set({ stroke: '#28a745', strokeWidth: 3 })
      fabricCanvasRef.current?.renderAll()
    }
  }

  /**
   * 处理画布中正方形的鼠标离开事件
   * @param square - 离开的正方形
   */
  const handleSquareMouseOut = (square: CanvasSquare) => {
    if (isDraggingInCanvas && draggedCanvasSquare && draggedCanvasSquare.id !== square.id) {
      // 恢复正常边框
      square.fabricObject.set({ stroke: '#333', strokeWidth: 2 })
      fabricCanvasRef.current?.renderAll()
    }
  }

  /**
   * 处理画布点击事件（用于完成位置交换或取消选择）
   */
  const handleCanvasClick = (e: { target?: Rect }) => {
    if (!isDraggingInCanvas || !draggedCanvasSquare) return

    const clickedObject = e.target
    if (clickedObject && clickedObject !== draggedCanvasSquare.fabricObject) {
      // 找到被点击的正方形
      const targetSquare = canvasSquares.find(s => s.fabricObject === clickedObject)
      if (targetSquare) {
        // 交换位置
        swapSquarePositions(draggedCanvasSquare, targetSquare)
      }
    }

    // 重置拖拽状态和边框样式
    resetDragState()
  }

  /**
   * 交换两个正方形的位置
   * @param square1 - 第一个正方形
   * @param square2 - 第二个正方形
   */
  const swapSquarePositions = (square1: CanvasSquare, square2: CanvasSquare) => {
    const newSquares = [...canvasSquares]
    const index1 = newSquares.findIndex(s => s.id === square1.id)
    const index2 = newSquares.findIndex(s => s.id === square2.id)

    if (index1 !== -1 && index2 !== -1) {
      // 安全地交换数组中的位置
      const square1Data = newSquares[index1]
      const square2Data = newSquares[index2]
      if (square1Data && square2Data) {
        newSquares[index1] = square2Data
        newSquares[index2] = square1Data
        setCanvasSquares(newSquares)

        // 重新计算并设置位置（使用动画）
        setTimeout(() => void rearrangeSquares(true), 0)
      }
    }
  }

  /**
   * 重置拖拽状态
   */
  const resetDragState = () => {
    // 恢复所有正方形的边框样式
    canvasSquares.forEach(square => {
      square.fabricObject.set({ stroke: '#333', strokeWidth: 2 })
    })

    setIsDraggingInCanvas(false)
    setDraggedCanvasSquare(null)
    fabricCanvasRef.current?.renderAll()
  }

  /**
   * 清空画布
   */
  const clearCanvas = () => {
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.clear()
      fabricCanvasRef.current.backgroundColor = '#f8f9fa'
      fabricCanvasRef.current.renderAll()
      setCanvasSquares([])
      resetDragState()
    }
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* 左侧工具栏 */}
      <div className="w-1/3 bg-white border-r border-gray-300 p-6 overflow-y-auto">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">拖拽工具</h2>
          <p className="text-sm text-gray-600 mb-6">
            将下方的正方形拖拽到右侧画布中，可以在画布中移动和调整大小
          </p>
        </div>

        {/* 正方形列表 */}
        <div className="space-y-4">
          {SQUARE_CONFIGS.map((square) => (
            <div
              key={square.id}
              className="flex items-center p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors cursor-move"
              draggable
              onDragStart={() => handleDragStart(square)}
              onDragEnd={handleDragEnd}
            >
              {/* 正方形预览 */}
              <div
                className="w-12 h-12 rounded border-2 border-gray-300 mr-4 flex-shrink-0"
                style={{ backgroundColor: square.color }}
              />

              {/* 正方形信息 */}
              <div className="flex-1">
                <div className="font-medium text-gray-800">{square.label}</div>
                <div className="text-sm text-gray-500">
                  大小: {square.size}x{square.size}px
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 操作按钮 */}
        <div className="mt-8">
          <button
            onClick={clearCanvas}
            className="w-full px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
          >
            清空画布
          </button>
        </div>
      </div>

      {/* 右侧画布区域 */}
      <div className="flex-1 p-6">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-gray-800 mb-2">Fabric.js 画布</h2>
          <p className="text-sm text-gray-600">
            正方形会自动横向排列，间距为20px。可以拖拽正方形改变顺序，或点击正方形后再点击另一个正方形交换位置。
          </p>
          {isDraggingInCanvas && (
            <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
              选择模式：点击另一个正方形来交换位置，或点击空白区域取消选择
            </div>
          )}
        </div>

        {/* 画布容器 */}
        <div
          className="border-2 border-dashed border-gray-300 rounded-lg p-4 bg-white"
          onDrop={handleCanvasDrop}
          onDragOver={handleCanvasDragOver}
        >
          <canvas
            ref={canvasRef}
            className="border border-gray-200 rounded shadow-sm"
          />
        </div>

        {/* 状态提示 */}
        {draggedSquare && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-blue-800 text-sm">
              正在拖拽: {draggedSquare.label} - 请拖拽到画布中释放
            </p>
          </div>
        )}

        {canvasSquares.length > 0 && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800 text-sm">
              画布中共有 {canvasSquares.length} 个正方形，支持拖拽排序和点击交换位置
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default FabricPage
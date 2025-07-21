'use client'

import { useEffect, useRef, useState, useCallback, type FC } from 'react'
import { Canvas, Rect, type FabricObject, util } from 'fabric'

const PADDING = 20;
const SQUARE_WIDTH = 80;
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 400;
/**
 * 正方形配置接口
 */
interface SquareConfig {
  id: string
  color: string
  size: number
  position: number
}

/**
 * 画布正方形数据结构
 */
interface CanvasSquare {
  id: string
  config: SquareConfig
  fabricObject: Rect
  position: number
}

/**
 * 页面属性接口
 */
type PageProps = Record<string, never>

/**
 * Fabric.js 网格拖拽页面组件
 * @returns JSX 元素
 */
const FabricGridPage: FC<PageProps> = () => {
  // Canvas 引用
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fabricCanvasRef = useRef<Canvas | null>(null)

  // 画布中的正方形状态
  const [canvasSquares, setCanvasSquares] = useState<CanvasSquare[]>([])

  // 拖拽状态
  const [isDragging, setIsDragging] = useState(false)
  const [draggedSquare, setDraggedSquare] = useState<CanvasSquare | null>(null)

  /**
   * 预定义的正方形配置
   */
  const squareConfigs: SquareConfig[] = [
    { id: '1', color: '#FF6B6B', size: 80, position: 0 },
    { id: '2', color: '#4ECDC4', size: 80, position: 1 },
    { id: '3', color: '#45B7D1', size: 80, position: 2 },
    { id: '4', color: '#96CEB4', size: 80, position: 3 },
  ]

  /**
   * 获取垂直居中位置
   * @returns 垂直居中的 y 坐标
   */
  const getVerticalCenterPosition = useCallback((): number => {
    return (CANVAS_HEIGHT - SQUARE_WIDTH) / 2
  }, [])

  /**
   * 计算正方形的 x 坐标位置
   * @param index - 位置索引
   * @param size - 正方形大小
   * @param totalCount - 正方形总数
   * @returns x 坐标
   */
  const calculateSquarePosition = useCallback((index: number, size: number, totalCount?: number): number => {
    const spacing = PADDING // 间距
    const count = totalCount ?? canvasSquares.length
    const totalWidth = count * size + (count - 1) * spacing
    const startX = (CANVAS_WIDTH - totalWidth) / 2 // 水平居中起始位置
    return startX + index * (size + spacing)
  }, [canvasSquares.length])

  /**
   * 计算目标位置索引
   * @param currentX - 当前 x 坐标
   * @param size - 正方形大小
   * @param totalCount - 正方形总数
   * @returns 目标索引
   */
  const calculateTargetIndex = useCallback((currentX: number, size: number, totalCount?: number): number => {
    const spacing = PADDING
    const count = totalCount ?? canvasSquares.length
    const totalWidth = count * size + (count - 1) * spacing
    const startX = (CANVAS_WIDTH - totalWidth) / 2

    // 计算拖拽元素中心点相对于起始位置的偏移
    const draggedCenterX = currentX + size / 2
    const relativeX = draggedCenterX - (startX + size / 2)

    // 计算目标索引，当拖拽元素中心点超过目标位置中心点时触发交换
    const index = Math.floor(relativeX / (size + spacing) + 0.5)
    return Math.max(0, Math.min(count - 1, index))
  }, [canvasSquares.length])

  /**
   * 更新正方形顺序
   * @param draggedSquare - 被拖拽的正方形
   * @param targetIndex - 目标索引
   */
  const updateSquareOrder = useCallback((draggedSquare: CanvasSquare, targetIndex: number) => {
    const newSquares = [...canvasSquares]
    const currentIndex = newSquares.findIndex(s => s.id === draggedSquare.id)

    if (currentIndex !== -1 && currentIndex !== targetIndex) {
      // 移除当前元素
      const [removedSquare] = newSquares.splice(currentIndex, 1)

      // 插入到新位置
      if (removedSquare) {
        newSquares.splice(targetIndex, 0, removedSquare)

        // 更新位置索引
        newSquares.forEach((square, index) => {
          square.position = index
        })

        setCanvasSquares(newSquares)
      }
    }
    
    return newSquares;
  }, [canvasSquares])

  /**
   * 重新排列画布中的所有正方形
   * @param animated - 是否使用动画效果
   */
  const rearrangeSquares = useCallback((animated = false, squares: CanvasSquare[]) => {
    if (!fabricCanvasRef.current) return

    const centerY = getVerticalCenterPosition()

    squares.forEach((square, index) => {
      const newX = calculateSquarePosition(index, square.config.size)

      if (animated) {
        // 使用动画移动到新位置
        square.fabricObject.animate({
          left: newX,
          top: centerY,
        }, {
          duration: 300,
          easing: util.ease.easeOutCubic,
          onChange: () => fabricCanvasRef.current?.requestRenderAll(),
        })
      } else {
        // 直接设置位置
        square.fabricObject.set({
          left: newX,
          top: centerY,
        })
      }
    })

    if (!animated) {
      fabricCanvasRef.current.requestRenderAll()
    }
  }, [getVerticalCenterPosition, calculateSquarePosition])

  /**
   * 实时更新正方形位置（拖拽时让出位置）
   * @param targetIndex - 目标位置索引
   * @param draggedSquare - 被拖拽的正方形数据
   */
  const updateSquarePositionsRealtime = useCallback((targetIndex: number, draggedSquare: CanvasSquare) => {
    const centerY = getVerticalCenterPosition()
    const originalIndex = draggedSquare.position

    // 为其他正方形让出位置
    canvasSquares.forEach((square, currentIndex) => {
      if (square.id === draggedSquare.id) return

      let newIndex = currentIndex

      // 从左向右拖拽（原位置 < 目标位置）
      if (originalIndex < targetIndex) {
        // 在原位置和目标位置之间的元素需要向左移动
        if (currentIndex > originalIndex && currentIndex <= targetIndex) {
          newIndex = currentIndex - 1
        }
      }
      // 从右向左拖拽（原位置 > 目标位置）
      else if (originalIndex > targetIndex) {
        // 在目标位置和原位置之间的元素需要向右移动
        if (currentIndex >= targetIndex && currentIndex < originalIndex) {
          newIndex = currentIndex + 1
        }
      }

      const newX = calculateSquarePosition(newIndex, square.config.size)

      // 平滑移动到新位置
      square.fabricObject.animate({
        left: newX,
        top: centerY,
      }, {
        duration: 150,
        easing: util.ease.easeOutQuad,
        onChange: () => fabricCanvasRef.current?.requestRenderAll(),
      })
    })
  }, [canvasSquares, getVerticalCenterPosition, calculateSquarePosition])

  /**
   * 初始化画布中的正方形
   * @param canvas - Fabric.js 画布实例
   */
  const initializeSquares = useCallback((canvas: Canvas) => {
    const squares: CanvasSquare[] = []
    const totalCount = squareConfigs.length

    squareConfigs.forEach((config, index) => {
      // 直接计算位置，避免依赖循环
      const spacing = PADDING
      const totalWidth = totalCount * config.size + (totalCount - 1) * spacing
      const startX = (CANVAS_WIDTH - totalWidth) / 2
      const xPosition = startX + index * (config.size + spacing)
      const yPosition = (CANVAS_HEIGHT - SQUARE_WIDTH) / 2

      //创建 Fabric.js 矩形对象
      const fabricRect = new Rect({
        left: xPosition,
        top: yPosition,
        width: config.size,
        height: config.size,
        fill: config.color,
        stroke: '#333',
        strokeWidth: 2,
        selectable: true,
        moveable: true,
        hasControls: false, // 禁用缩放控制
        hasBorders: true,
        lockRotation: true, // 禁用旋转
        lockScalingX: true, // 禁用水平缩放
        lockScalingY: true, // 禁用垂直缩放
        lockMovementY: true, // 禁用垂直移动
        cornerStyle: 'circle',
        cornerSize: 8,
      })

      // 添加到画布
      canvas.add(fabricRect)

      // 创建画布正方形数据
      const canvasSquare: CanvasSquare = {
        id: config.id,
        config,
        fabricObject: fabricRect,
        position: index,
      }

      squares.push(canvasSquare)
    })

    setCanvasSquares(squares)
    canvas.requestRenderAll()
  }, [])

  /**
   * 处理鼠标按下事件
   * @param e - Fabric.js 事件对象
   */
  const handleMouseDown = useCallback((e: { target?: FabricObject }) => {
    const target = e.target

    if (target) {
      const square = canvasSquares.find(s => s.fabricObject === target)
      if (square) {
        setIsDragging(true)
        setDraggedSquare(square)
      }
    }
  }, [canvasSquares])

  /**
   * 处理鼠标释放事件
   */
  const handleMouseUp = useCallback((e: { target?: FabricObject }) => {
    setIsDragging(false)
    setDraggedSquare(null)
    if (e.target && e.target?.opacity !== 1) {
      e.target.opacity = 1;
    }
  }, [])

  /**
   * 处理对象移动中事件
   * @param e - Fabric.js 事件对象
   */
  const handleObjectMoving = useCallback((e: { target: FabricObject }) => {
    const obj = e.target
    const canvas = fabricCanvasRef.current
    if (!canvas || !obj || !isDragging || !draggedSquare) return
    if (e.target) {
      e.target.opacity = 0.5;
    }

    const centerY = getVerticalCenterPosition()

    // 限制移动边界，只允许水平移动
    obj.set({
      left: Math.max(0, Math.min(CANVAS_WIDTH - (obj.width || 0), obj.left || 0)),
      top: centerY, // 动态垂直居中位置
    })

    // 实时计算目标位置并更新其他正方形位置
    const currentX = obj.left || 0
    const targetIndex = calculateTargetIndex(currentX, draggedSquare.config.size)
    updateSquarePositionsRealtime(targetIndex, draggedSquare)

  }, [isDragging, draggedSquare, getVerticalCenterPosition, calculateTargetIndex, updateSquarePositionsRealtime])

  /**
   * 处理对象移动结束事件
   * @param e - Fabric.js 事件对象
   */
  const handleObjectModified = useCallback((e: { target: FabricObject }) => {
    const movedObject = e.target
    if (!movedObject || !draggedSquare) return
    if (e.target) {
      e.target.opacity = 1;
    }

    // 计算最终位置并重新排列
    const currentX = movedObject.left || 0
    const targetIndex = calculateTargetIndex(currentX, draggedSquare.config.size)
    // 更新正方形顺序
    const newSquares = updateSquareOrder(draggedSquare, targetIndex)

    // 重新排列所有正方形到正确位置
    // setTimeout(() => {
    //   rearrangeSquares(true)
    // }, 50)
    rearrangeSquares(true, newSquares)
  }, [draggedSquare, calculateTargetIndex, updateSquareOrder, rearrangeSquares])



  /**
   * 初始化 Fabric.js 画布
   */
  useEffect(() => {
    if (!canvasRef.current) return

    // 创建 Fabric.js 画布实例
    const canvas = new Canvas(canvasRef.current, {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      backgroundColor: '#f8f9fa',
      selection: false, // 禁用框选
    })
    fabricCanvasRef.current = canvas

    // 初始化正方形

    return () => {
      canvas?.dispose().catch((err) => console.log(err))
    };
  }, [])

  useEffect(() => {
    // 添加事件监听器
    fabricCanvasRef.current?.on('object:moving', handleObjectMoving)
    fabricCanvasRef.current?.on('object:modified', handleObjectModified)
    fabricCanvasRef.current?.on('mouse:down', handleMouseDown)
    fabricCanvasRef.current?.on('mouse:up', handleMouseUp)

    // 清理函数
    return () => {
      fabricCanvasRef.current?.off('object:moving', handleObjectMoving)
      fabricCanvasRef.current?.off('object:modified', handleObjectModified)
      fabricCanvasRef.current?.off('mouse:down', handleMouseDown)
      fabricCanvasRef.current?.off('mouse:up', handleMouseUp)

    }
  }, [handleMouseDown, handleMouseUp, handleObjectModified, handleObjectMoving]);

  /**
   * 清空画布
   */
  const clearCanvas = () => {
    if (fabricCanvasRef.current) {
      // 移除占位符状态
      setIsDragging(false)
      setDraggedSquare(null)
      fabricCanvasRef.current?.clear?.()
      setCanvasSquares([])
    }
  }

  /**
   * 重置画布
   */
  const resetCanvas = () => {
    if (fabricCanvasRef.current) {
      setIsDragging(false)
      setDraggedSquare(null)

      fabricCanvasRef.current?.clear?.()
      initializeSquares(fabricCanvasRef.current)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-4">
            Fabric.js 网格拖拽排序
          </h1>
          <p className="text-gray-600">
            拖拽正方形可以改变它们的顺序，其他正方形会自动让出位置。释放后所有正方形会重新排列到一条直线上。
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-gray-800 mb-2">画布区域</h2>
            <p className="text-sm text-gray-600">
              4个不同颜色的正方形，支持拖拽换位排序。画布尺寸可变，正方形始终保持水平和垂直居中。
            </p>

            {isDragging && draggedSquare && (
              <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
                正在拖拽: {draggedSquare.config.color} 正方形
              </div>
            )}
          </div>

          {/* 画布容器 */}
          <div className="border-2 border-gray-200 rounded-lg p-4 bg-gray-50">
            <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className="border border-gray-300" />
          </div>

          {/* 控制按钮 */}
          <div className="mt-4 flex gap-4 flex-wrap">
            <button
              onClick={resetCanvas}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              重置画布
            </button>
            <button
              onClick={clearCanvas}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
            >
              清空画布
            </button>
          </div>

          {/* 状态信息 */}
          {canvasSquares.length > 0 && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-800 text-sm">
                画布中共有 {canvasSquares.length} 个正方形，当前顺序：
                {canvasSquares.map((square, index) => (
                  <span key={square.id} className="ml-2">
                    <span
                      className="inline-block w-4 h-4 rounded"
                      style={{ backgroundColor: square.config.color }}
                    ></span>
                    {index < canvasSquares.length - 1 ? ' → ' : ''}
                  </span>
                ))}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default FabricGridPage
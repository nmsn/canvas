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
 * 拖拽源正方形配置
 */
interface DragSourceSquare {
  id: string
  color: string
  size: number
  label: string
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
  
  // 外部拖拽状态
  const [isExternalDragging, setIsExternalDragging] = useState(false)
  const [draggedSourceSquare, setDraggedSourceSquare] = useState<DragSourceSquare | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number>(-1)
  
  // 选中状态
  const [selectedSquare, setSelectedSquare] = useState<CanvasSquare | null>(null)
  
  // 用于区分点击和拖拽的状态
  const [mouseDownPosition, setMouseDownPosition] = useState<{ x: number; y: number } | null>(null)
  const [hasMoved, setHasMoved] = useState(false)

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
   * 拖拽源正方形配置
   */
  const dragSourceSquares: DragSourceSquare[] = [
    { id: 'source-1', color: '#FFD93D', size: 80, label: '黄色正方形' },
    { id: 'source-2', color: '#6BCF7F', size: 80, label: '绿色正方形' },
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
   * 根据鼠标位置计算插入索引（用于外部拖拽）
   * @param mouseX - 鼠标 x 坐标
   * @param mouseY - 鼠标 y 坐标
   * @param size - 正方形大小
   * @returns 插入索引
   */
  const calculateInsertIndex = useCallback((mouseX: number, mouseY: number, size: number): number => {
    if (!canvasRef.current) return canvasSquares.length
    
    const canvasRect = canvasRef.current.getBoundingClientRect()
    const canvasX = mouseX - canvasRect.left
    const canvasY = mouseY - canvasRect.top
    
    // 检查是否在画布范围内
    if (canvasX < 0 || canvasX > CANVAS_WIDTH || canvasY < 0 || canvasY > CANVAS_HEIGHT) {
      return -1 // 不在画布范围内
    }
    
    const spacing = PADDING
    const newCount = canvasSquares.length + 1 // 包含即将插入的正方形
    const totalWidth = newCount * size + (newCount - 1) * spacing
    const startX = (CANVAS_WIDTH - totalWidth) / 2
    
    // 计算插入位置
    const relativeX = canvasX - startX
    const index = Math.floor(relativeX / (size + spacing) + 0.5)
    return Math.max(0, Math.min(canvasSquares.length, index))
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
      const newX = calculateSquarePosition(index, square.config.size, squares.length)

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
   * 为外部拖拽让出位置
   * @param insertIndex - 插入位置索引
   */
  const makeSpaceForExternalDrag = useCallback((insertIndex: number) => {
    if (!fabricCanvasRef.current || insertIndex < 0) return
    
    const centerY = getVerticalCenterPosition()
    const newCount = canvasSquares.length + 1
    
    canvasSquares.forEach((square, currentIndex) => {
      let newIndex = currentIndex
      
      // 如果当前索引大于等于插入位置，需要向右移动
      if (currentIndex >= insertIndex) {
        newIndex = currentIndex + 1
      }
      
      const newX = calculateSquarePosition(newIndex, square.config.size, newCount)
      
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
   * 添加新的正方形到画布
   * @param sourceSquare - 拖拽源正方形
   * @param insertIndex - 插入位置索引
   */
  const addSquareToCanvas = useCallback((sourceSquare: DragSourceSquare, insertIndex: number) => {
    if (!fabricCanvasRef.current) return
    
    const canvas = fabricCanvasRef.current
    const centerY = getVerticalCenterPosition()
    const newCount = canvasSquares.length + 1
    const xPosition = calculateSquarePosition(insertIndex, sourceSquare.size, newCount)
    
    // 创建新的配置
    const newConfig: SquareConfig = {
      id: `${Date.now()}-${sourceSquare.id}`,
      color: sourceSquare.color,
      size: sourceSquare.size,
      position: insertIndex,
    }
    
    // 创建 Fabric.js 矩形对象
    const fabricRect = new Rect({
      left: xPosition,
      top: centerY,
      width: newConfig.size,
      height: newConfig.size,
      fill: newConfig.color,
      stroke: '#333',
      strokeWidth: 2,
      selectable: true,
      moveable: true,
      hasControls: false,
      hasBorders: true,
      lockRotation: true,
      lockScalingX: true,
      lockScalingY: true,
      lockMovementY: true,
      cornerStyle: 'circle',
      cornerSize: 8,
    })
    
    // 添加到画布
    canvas.add(fabricRect)
    
    // 创建画布正方形数据
    const newCanvasSquare: CanvasSquare = {
      id: newConfig.id,
      config: newConfig,
      fabricObject: fabricRect,
      position: insertIndex,
    }
    
    // 更新状态
    const newSquares = [...canvasSquares]
    newSquares.splice(insertIndex, 0, newCanvasSquare)
    
    // 更新所有正方形的位置索引
    newSquares.forEach((square, index) => {
      square.position = index
    })
    
    setCanvasSquares(newSquares)
    
    // 重新排列所有正方形
    setTimeout(() => {
      rearrangeSquares(true, newSquares)
    }, 50)
    
    canvas.requestRenderAll()
  }, [canvasSquares, getVerticalCenterPosition, calculateSquarePosition, rearrangeSquares])

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
   * 更新选中状态的视觉效果
   * @param square - 要更新的正方形
   * @param isSelected - 是否选中
   */
  const updateSelectionVisual = useCallback((square: CanvasSquare, isSelected: boolean) => {
    if (isSelected) {
      square.fabricObject.set({
        stroke: '#3B82F6', // 蓝色边框
        strokeWidth: 4, // 2px 边框效果
      })
    } else {
      square.fabricObject.set({
        stroke: '#333', // 恢复原始边框颜色
        strokeWidth: 2, // 恢复原始边框宽度
      })
    }
    fabricCanvasRef.current?.requestRenderAll()
  }, [])

  /**
   * 处理元素选中/取消选中
   * @param square - 要选中的正方形
   */
  const handleSquareSelection = useCallback((square: CanvasSquare) => {
    // 如果当前已有选中的元素，先取消其选中状态
    if (selectedSquare && selectedSquare.id !== square.id) {
      updateSelectionVisual(selectedSquare, false)
    }
    
    // 如果点击的是当前选中的元素，则取消选中
    if (selectedSquare && selectedSquare.id === square.id) {
      updateSelectionVisual(square, false)
      setSelectedSquare(null)
    } else {
      // 否则选中新元素
      updateSelectionVisual(square, true)
      setSelectedSquare(square)
    }
  }, [selectedSquare, updateSelectionVisual])

  /**
   * 处理鼠标按下事件
   * @param e - Fabric.js 事件对象
   */
  const handleMouseDown = useCallback((e: { target?: FabricObject; pointer?: { x: number; y: number } }) => {
    const target = e.target
    const pointer = e.pointer

    // 记录鼠标按下位置，用于区分点击和拖拽
    if (pointer) {
      setMouseDownPosition({ x: pointer.x, y: pointer.y })
    }
    setHasMoved(false)

    if (target) {
      const square = canvasSquares.find(s => s.fabricObject === target)
      if (square) {
        setDraggedSquare(square)
      }
    } else {
      // 点击空白区域，取消所有选中状态
      if (selectedSquare) {
        updateSelectionVisual(selectedSquare, false)
        setSelectedSquare(null)
      }
    }
  }, [canvasSquares, selectedSquare, updateSelectionVisual])

  /**
   * 处理鼠标释放事件
   */
  const handleMouseUp = useCallback((e: { target?: FabricObject; pointer?: { x: number; y: number } }) => {
    const target = e.target
    const pointer = e.pointer
    
    // 判断是否为点击操作（没有移动或移动距离很小）
    const isClick = !hasMoved && mouseDownPosition && pointer && 
      Math.abs(pointer.x - mouseDownPosition.x) < 5 && 
      Math.abs(pointer.y - mouseDownPosition.y) < 5
    
    if (isClick && target && draggedSquare) {
      // 这是一个点击操作，处理选中逻辑
      handleSquareSelection(draggedSquare)
    }
    
    // 重置状态
    setIsDragging(false)
    setDraggedSquare(null)
    setMouseDownPosition(null)
    setHasMoved(false)
    
    if (e.target && e.target?.opacity !== 1) {
      e.target.opacity = 1;
    }
  }, [hasMoved, mouseDownPosition, draggedSquare, handleSquareSelection])

  /**
   * 处理对象移动中事件
   * @param e - Fabric.js 事件对象
   */
  const handleObjectMoving = useCallback((e: { target: FabricObject }) => {
    const obj = e.target
    const canvas = fabricCanvasRef.current
    
    // 标记已经移动，用于区分点击和拖拽
    setHasMoved(true)
    
    if (!canvas || !obj || !draggedSquare) return
    
    // 开始拖拽时设置拖拽状态
    if (!isDragging) {
      setIsDragging(true)
    }
    
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
    rearrangeSquares(true, newSquares)
  }, [draggedSquare, calculateTargetIndex, updateSquareOrder, rearrangeSquares])

  /**
   * 处理外部拖拽开始
   * @param sourceSquare - 拖拽源正方形
   */
  const handleExternalDragStart = useCallback((sourceSquare: DragSourceSquare) => {
    setIsExternalDragging(true)
    setDraggedSourceSquare(sourceSquare)
  }, [])

  /**
   * 处理外部拖拽结束
   */
  const handleExternalDragEnd = useCallback(() => {
    setIsExternalDragging(false)
    setDraggedSourceSquare(null)
    setDragOverIndex(-1)
    
    // 恢复所有正方形到原始位置
    if (canvasSquares.length > 0) {
      rearrangeSquares(true, canvasSquares)
    }
  }, [canvasSquares, rearrangeSquares])

  /**
   * 处理外部拖拽移动
   * @param e - 拖拽事件
   */
  const handleExternalDragMove = useCallback((e: DragEvent) => {
    if (!isExternalDragging || !draggedSourceSquare) return
    
    const insertIndex = calculateInsertIndex(e.clientX, e.clientY, draggedSourceSquare.size)
    
    if (insertIndex !== dragOverIndex) {
      setDragOverIndex(insertIndex)
      
      if (insertIndex >= 0) {
        makeSpaceForExternalDrag(insertIndex)
      } else {
        // 鼠标移出画布，恢复原始位置
        rearrangeSquares(true, canvasSquares)
      }
    }
  }, [isExternalDragging, draggedSourceSquare, dragOverIndex, calculateInsertIndex, makeSpaceForExternalDrag, canvasSquares, rearrangeSquares])

  /**
   * 处理外部拖拽放置
   * @param e - 拖拽事件
   */
  const handleExternalDrop = useCallback((e: DragEvent) => {
    e.preventDefault()
    
    if (!isExternalDragging || !draggedSourceSquare) return
    
    const insertIndex = calculateInsertIndex(e.clientX, e.clientY, draggedSourceSquare.size)
    
    if (insertIndex >= 0) {
      addSquareToCanvas(draggedSourceSquare, insertIndex)
    }
    
    handleExternalDragEnd()
  }, [isExternalDragging, draggedSourceSquare, calculateInsertIndex, addSquareToCanvas, handleExternalDragEnd])

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
    initializeSquares(canvas)

    return () => {
      canvas?.dispose().catch((err) => console.log(err))
    };
  }, [initializeSquares])

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

  // 添加全局拖拽事件监听
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault()
      handleExternalDragMove(e)
    }
    
    const handleDrop = (e: DragEvent) => {
      handleExternalDrop(e)
    }
    
    if (isExternalDragging) {
      document.addEventListener('dragover', handleDragOver)
      document.addEventListener('drop', handleDrop)
      
      return () => {
        document.removeEventListener('dragover', handleDragOver)
        document.removeEventListener('drop', handleDrop)
      }
    }
  }, [isExternalDragging, handleExternalDragMove, handleExternalDrop])

  /**
   * 清空画布
   */
  const clearCanvas = () => {
    if (fabricCanvasRef.current) {
      // 移除占位符状态
      setIsDragging(false)
      setDraggedSquare(null)
      setSelectedSquare(null) // 清空选中状态
      setMouseDownPosition(null)
      setHasMoved(false)
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
      setSelectedSquare(null) // 清空选中状态
      setMouseDownPosition(null)
      setHasMoved(false)

      fabricCanvasRef.current?.clear?.()
      initializeSquares(fabricCanvasRef.current)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-4">
            Fabric.js 网格拖拽排序
          </h1>
          <p className="text-gray-600">
            左侧拖拽源可以拖拽到右侧画布中，画布内的正方形可以拖拽重新排序。拖拽时其他正方形会自动让出位置。
          </p>
        </div>

        <div className="flex gap-6">
          {/* 左侧拖拽源列表 */}
          <div className="w-64 bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">拖拽源</h2>
            <p className="text-sm text-gray-600 mb-4">
              拖拽下方的正方形到右侧画布中
            </p>
            
            <div className="space-y-4">
              {dragSourceSquares.map((sourceSquare) => (
                <div
                  key={sourceSquare.id}
                  className="flex items-center gap-3 p-3 border-2 border-gray-200 rounded-lg hover:border-gray-300 transition-colors cursor-move"
                  draggable
                  onDragStart={() => handleExternalDragStart(sourceSquare)}
                  onDragEnd={handleExternalDragEnd}
                >
                  <div
                    className="w-12 h-12 rounded border-2 border-gray-300 flex-shrink-0"
                    style={{ backgroundColor: sourceSquare.color }}
                  ></div>
                  <div>
                    <div className="font-medium text-gray-800">{sourceSquare.label}</div>
                    <div className="text-sm text-gray-500">{sourceSquare.color}</div>
                  </div>
                </div>
              ))}
            </div>
            
            {isExternalDragging && draggedSourceSquare && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="text-sm text-blue-800">
                  正在拖拽: {draggedSourceSquare.label}
                </div>
                {dragOverIndex >= 0 && (
                  <div className="text-xs text-blue-600 mt-1">
                    将插入到位置: {dragOverIndex + 1}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 右侧画布区域 */}
          <div className="flex-1 bg-white rounded-lg shadow-lg p-6">
            <div className="mb-4">
              <h2 className="text-xl font-bold text-gray-800 mb-2">画布区域</h2>
              <p className="text-sm text-gray-600">
                画布中的正方形支持拖拽换位排序，从左侧拖拽新的正方形可以添加到画布中。
              </p>

              {isDragging && draggedSquare && (
                <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
                  正在拖拽: {draggedSquare.config.color} 正方形
                </div>
              )}
            </div>

            {/* 画布容器 */}
            <div className="border-2 border-gray-200 rounded-lg p-4 bg-gray-50">
              <canvas 
                ref={canvasRef} 
                width={CANVAS_WIDTH} 
                height={CANVAS_HEIGHT} 
                className="border border-gray-300"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleExternalDrop(e.nativeEvent)}
              />
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
                        className={`inline-block w-4 h-4 rounded ${
                          selectedSquare && selectedSquare.id === square.id 
                            ? 'ring-2 ring-blue-500 ring-offset-1' 
                            : ''
                        }`}
                        style={{ backgroundColor: square.config.color }}
                      ></span>
                      {index < canvasSquares.length - 1 ? ' → ' : ''}
                    </span>
                  ))}
                </p>
                {selectedSquare && (
                  <p className="text-blue-800 text-sm mt-2">
                    当前选中: <span
                      className="inline-block w-4 h-4 rounded ml-1 mr-1"
                      style={{ backgroundColor: selectedSquare.config.color }}
                    ></span>
                    {selectedSquare.config.color} 正方形
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default FabricGridPage

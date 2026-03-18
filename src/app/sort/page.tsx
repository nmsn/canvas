'use client'

import Link from "next/link";
import React, { useState, useRef } from 'react'

interface SquareItem {
  id: string
  color: string
  name: string
}

interface DragState {
  draggedItem: SquareItem | null
  draggedOverId: string | null
  sourceArea: 'left' | 'right'
}

const COLORS = [
  { color: '#FF6B6B', name: '红色' },
  { color: '#4ECDC4', name: '青色' },
  { color: '#45B7D1', name: '蓝色' },
  { color: '#96CEB4', name: '绿色' },
  { color: '#FECA57', name: '黄色' },
  { color: '#FF9FF3', name: '粉色' },
  { color: '#54A0FF', name: '天蓝' },
  { color: '#5F27CD', name: '紫色' }
]

export default function SortPage() {
  const [leftItems, setLeftItems] = useState<SquareItem[]>(
    COLORS.map((item, index) => ({
      id: `left-${index}`,
      color: item.color,
      name: item.name
    }))
  )

  const [rightItems, setRightItems] = useState<SquareItem[]>([])
  const [dragState, setDragState] = useState<DragState>({
    draggedItem: null,
    draggedOverId: null,
    sourceArea: 'left'
  })

  const [isAnimating, setIsAnimating] = useState(false)
  const [isAreaAnimating, setIsAreaAnimating] = useState(false)
  const [itemPositions, setItemPositions] = useState<Record<string, number>>({})
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [insertPosition, setInsertPosition] = useState<number | null>(null)
  const [draggingItem, setDraggingItem] = useState<SquareItem | null>(null)

  const rightAreaRef = useRef<HTMLDivElement>(null)

  const handleDragStart = (item: SquareItem, sourceArea: 'left' | 'right') => {
    setDragState({
      draggedItem: item,
      draggedOverId: null,
      sourceArea
    })
    setDraggingItem(item)
  }

  const handleDragOver = (e: React.DragEvent, targetIndex?: number) => {
    e.preventDefault()

    if (targetIndex !== undefined) {
      setDragOverIndex(targetIndex)

      // 计算插入位置 - 根据鼠标在元素上的精确位置决定左侧或右侧
      const rect = e.currentTarget.getBoundingClientRect()
      const x = e.clientX - rect.left
      const width = rect.width

      // 更精确的位置判断：鼠标在元素左侧1/3区域插入到当前位置，右侧2/3区域插入到下一个位置
      const insertAt = x < width * 0.33 ? targetIndex : targetIndex + 1
      setInsertPosition(insertAt)
    } else {
      // 拖拽到右侧区域空白处 - 根据鼠标位置精确计算插入位置
      const rect = e.currentTarget.getBoundingClientRect()
      const x = e.clientX - rect.left
      const elementWidth = 80 // 每个元素宽度
      const spacing = 16 // 元素间距
      const totalItemWidth = elementWidth + spacing

      if (rightItems.length === 0) {
        setInsertPosition(0)
      } else {
        // 计算基于实际元素位置的插入位置
        const containerWidth = rect.width
        const totalElementsWidth = rightItems.length * totalItemWidth - spacing
        const startX = (containerWidth - totalElementsWidth) / 2

        let insertAt = 0
        for (let i = 0; i <= rightItems.length; i++) {
          const elementCenter = startX + i * totalItemWidth - spacing / 2
          if (x <= elementCenter) {
            insertAt = i
            break
          }
          if (i === rightItems.length) {
            insertAt = rightItems.length
          }
        }
        setInsertPosition(insertAt)
      }
    }
  }

  const handleDragLeave = () => {
    setDragState(prev => ({ ...prev, draggedOverId: null }))
    setDragOverIndex(null)
    setInsertPosition(null)
  }

  const handleDrop = (e: React.DragEvent, targetIndex?: number) => {
    e.preventDefault()

    const { draggedItem, sourceArea } = dragState
    if (!draggedItem) return

    let insertIndex: number

    if (targetIndex !== undefined) {
      insertIndex = targetIndex
    } else {
      // 根据鼠标位置判断插入位置
      const rect = rightAreaRef.current?.getBoundingClientRect()
      if (rect) {
        const mouseX = e.clientX - rect.left

        if (rightItems.length === 0) {
          insertIndex = 0
        } else {
          // 计算鼠标在水平方向的位置比例
          const relativeX = mouseX / rect.width

          // 更精确的位置计算
          if (relativeX <= 0.2) {
            insertIndex = 0 // 左侧释放，放在第一个位置
          } else if (relativeX >= 0.8) {
            insertIndex = rightItems.length // 右侧释放，放在最后一个位置
          } else {
            // 中间区域释放，根据相对位置计算插入点
            insertIndex = Math.round(relativeX * rightItems.length)
          }
        }
      } else {
        insertIndex = rightItems.length
      }
    }

    // 确保插入索引在有效范围内
    insertIndex = Math.max(0, Math.min(insertIndex, rightItems.length))

    // 检查是否需要真正改变位置
    let shouldReorder = true;
    if (sourceArea === 'right') {
      const currentIndex = rightItems.findIndex(item => item.id === draggedItem.id);
      if (currentIndex === insertIndex || (currentIndex === insertIndex - 1 && insertIndex > 0)) {
        shouldReorder = false;
      }
    }

    // 如果不需要重新排序，则直接返回
    if (!shouldReorder) {
      setDragState({
        draggedItem: null,
        draggedOverId: null,
        sourceArea: 'left'
      })
      return;
    }

    // 更新元素位置状态
    const newItemPositions: Record<string, number> = {}
    rightItems.forEach((item, idx) => {
      if (sourceArea === 'right') {
        // 右侧内部重新排序
        const currentIndex = rightItems.findIndex(i => i.id === draggedItem.id)
        if (currentIndex !== -1) {
          // 计算元素的新位置
          if (idx < currentIndex && idx >= insertIndex) {
            // 元素向右移动
            newItemPositions[item.id] = idx + 1
          } else if (idx > currentIndex && idx <= insertIndex) {
            // 元素向左移动
            newItemPositions[item.id] = idx - 1
          } else {
            // 元素位置不变
            newItemPositions[item.id] = idx
          }
        }
      } else {
        // 从左侧拖到右侧
        newItemPositions[item.id] = idx >= insertIndex ? idx + 1 : idx
      }
    })

    // 添加新拖拽的元素位置
    newItemPositions[draggedItem.id] = insertIndex
    setItemPositions(newItemPositions)


    setIsAnimating(true)
    setIsAreaAnimating(true)

    if (sourceArea === 'left') {
      // 从左侧拖到右侧
      setLeftItems(prev => prev.filter(item => item.id !== draggedItem.id))

      setRightItems(prev => {
        const newItems = [...prev]
        newItems.splice(insertIndex, 0, draggedItem)
        return newItems
      })
    } else {
      // 右侧内部重新排序
      const currentIndex = rightItems.findIndex(item => item.id === draggedItem.id)
      if (currentIndex === -1) return

      setRightItems(prev => {
        const newItems = [...prev]
        newItems.splice(currentIndex, 1)

        // 调整插入位置，如果移除的位置在插入位置之前
        let adjustedInsertIndex = insertIndex
        if (currentIndex < adjustedInsertIndex) {
          adjustedInsertIndex--
        }

        newItems.splice(adjustedInsertIndex, 0, draggedItem)
        return newItems
      })
    }

    setTimeout(() => {
      setIsAnimating(false)
      setIsAreaAnimating(false)
      setItemPositions({})
    }, 500)

    setDragState({
      draggedItem: null,
      draggedOverId: null,
      sourceArea: 'left'
    })
    setDragOverIndex(null)
    setInsertPosition(null)
    setDraggingItem(null)
  }

  const handleDragEnd = () => {
    setDragState({
      draggedItem: null,
      draggedOverId: null,
      sourceArea: 'left'
    })
    setDragOverIndex(null)
    setInsertPosition(null)
    setDraggingItem(null)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex items-center gap-4">
          <Link
            href="/"
            className="text-gray-600 hover:text-gray-800 transition-colors"
          >
            ← 返回首页
          </Link>
        </div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-4">
            拖拽排序示例
          </h1>
          <p className="text-gray-600">
            将左侧的彩色正方形拖拽到右侧区域，可以重新排序
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 左侧列表 */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold text-gray-700 mb-4">
              可用正方形 ({leftItems.length})
            </h2>
            <div className="grid grid-cols-4 gap-3">
              {leftItems.map((item) => (
                <div
                  key={item.id}
                  className={`aspect-square rounded-lg cursor-grab active:cursor-grabbing transition-all duration-200 hover:scale-105 shadow-md hover:shadow-lg ${draggingItem?.id === item.id ? 'opacity-0 scale-0' : ''
                    }`}
                  style={{ backgroundColor: item.color }}
                  draggable
                  onDragStart={() => handleDragStart(item, 'left')}
                  onDragEnd={handleDragEnd}
                  title={item.name}
                />
              ))}
            </div>
          </div>

          {/* 右侧区域 */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold text-gray-700 mb-4">
              排序区域 ({rightItems.length})
            </h2>
            <div
              ref={rightAreaRef}
              className={`min-h-96 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center p-4 transition-all duration-500 ease-out ${isAreaAnimating ? 'scale-[1.02] shadow-lg' : 'scale-100 shadow-md'}`}
              onDragOver={(e) => handleDragOver(e)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e)}
              onDragEnter={() => {
                // 拖拽到右侧区域空白处
                if (rightItems.length === 0) {
                  setInsertPosition(0)
                } else {
                  setInsertPosition(rightItems.length)
                }
              }}
            >
              {rightItems.length === 0 ? (
                <div className="text-gray-400 text-center">
                  <div className="text-6xl mb-4">📦</div>
                  <p>拖拽正方形到这里</p>
                </div>
              ) : (
                <div className="flex items-center justify-center transition-all duration-500 ease-out">
                  {rightItems.map((item, index) => (
                    <React.Fragment key={item.id}>
                      {/* 实际元素作为占位符 - 拖拽时显示在目标位置 */}
                      {insertPosition === index && draggingItem && (
                        <div
                          className="w-16 h-16 rounded-lg transition-all duration-300 ease-in-out flex-shrink-0 cursor-grabbing"
                          style={{
                            backgroundColor: draggingItem.color,
                            opacity: 0.5,
                            margin: '0.25rem',
                            transform: 'scale(0.9)'
                          }}
                        />
                      )}

                      {/* 实际元素 - 拖拽时半透明显示，否则正常显示 */}
                      <div
                        className={`flex items-center transition-all duration-300 ease-in-out transform ${isAnimating ? 'scale-105' : 'scale-100'
                          } ${dragOverIndex === index ? 'scale-110' : ''
                          }`}
                        style={{
                          transitionProperty: 'transform, opacity, margin-left',
                          transitionDuration: '300ms',
                          transitionTimingFunction: 'ease-in-out',
                          margin: '0.25rem',
                          marginLeft: insertPosition !== null && insertPosition <= index && draggingItem ? '1rem' : '0.25rem',
                          transform: itemPositions[item.id] !== undefined ? `translateX(${(itemPositions[item.id]! - index) * 100}%)` : 'translateX(0)',
                          zIndex: 1
                        }}
                      >
                        <div
                          className={`w-16 h-16 rounded-lg cursor-grab active:cursor-grabbing shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105 ${dragOverIndex === index ? 'ring-4 ring-blue-400 ring-opacity-50' : ''
                            } ${draggingItem?.id === item.id ? 'opacity-0 scale-0 w-[1px]' : ''}`}
                          style={{
                            backgroundColor: item.color,
                            opacity: draggingItem?.id === item.id ? 0 : 1
                          }}
                          draggable
                          onDragStart={() => handleDragStart(item, 'right')}
                          onDragEnd={handleDragEnd}
                          onDragOver={(e) => handleDragOver(e, index)}
                          onDrop={(e) => {
                            e.stopPropagation()
                            handleDrop(e, index)
                          }}
                          onDragEnter={() => setDragOverIndex(index)}
                          onDragLeave={() => setDragOverIndex(null)}
                          title={item.name}
                        />
                      </div>
                    </React.Fragment>
                  ))}

                  {/* 末尾占位符 - 只在最后位置显示 */}
                  {insertPosition === rightItems.length && draggingItem && (
                    <div
                      className="w-16 h-16 rounded-lg transition-all duration-300 ease-in-out flex-shrink-0 cursor-grabbing"
                      style={{
                        backgroundColor: draggingItem.color,
                        opacity: 0.5,
                        margin: '0.25rem',
                        transform: 'scale(0.9)'
                      }}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="mt-8 flex justify-center space-x-4">
          <button
            onClick={() => {
              setLeftItems(COLORS.map((item, index) => ({
                id: `left-${index}`,
                color: item.color,
                name: item.name
              })))
              setRightItems([])
            }}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            重置
          </button>
        </div>
      </div>
    </div>
  )
}
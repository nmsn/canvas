'use client'

import { useEffect, useRef, useState, useCallback, type FC } from 'react'
import { Canvas, type Line, type FabricObject } from 'fabric'
import hljs from 'highlight.js/lib/core';
import typescript from 'highlight.js/lib/languages/typescript.js';
import 'highlight.js/styles/github-dark.css';
import { getDrawFunctions, type DrawFunction, type LineParams } from './func'

const CANVAS_WIDTH = 600
const CANVAS_HEIGHT = 400

hljs.registerLanguage('javascript', typescript);

/**
 * 绘制记录接口
 */
interface DrawRecord {
  id: string
  functionName: string
  displayName: string
  params: LineParams
  timestamp: number
  fabricObject: FabricObject | FabricObject[]
  codeSnippet: string
}

/**
 * 页面属性接口
 */
type PageProps = Record<string, never>

/**
 * Fabric.js 绘制计算页面组件
 * @returns JSX 元素
 */
const FabricCalcPage: FC<PageProps> = () => {
  // Canvas 引用
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fabricCanvasRef = useRef<Canvas | null>(null)

  // 绘制记录状态
  const [drawRecords, setDrawRecords] = useState<DrawRecord[]>([])

  // 拖拽状态
  const [isDragging, setIsDragging] = useState(false)
  const [draggedFunction, setDraggedFunction] = useState<DrawFunction | null>(null)
  const [copied, setCopied] = useState(false)

  // 获取所有绘制函数
  const drawFunctions = getDrawFunctions()

  /**
   * 获取所有绘制记录的合并代码（纯文本格式，用于复制）
   */
  const getCombinedCodePlain = useCallback(() => {
    if (drawRecords.length === 0) return ''
    return drawRecords.map(record =>
      `${record.functionName}(${JSON.stringify(record.params, null, 2)});`
    ).join('\n\n')
  }, [drawRecords])

  /**
   * 获取所有绘制记录的合并代码（高亮格式，用于显示）
   */
  const getCombinedCode = useCallback(() => {
    if (drawRecords.length === 0) return ''
    return drawRecords.map(record => {
      const codeString = `${record.functionName}(${JSON.stringify(record.params, null, 2)});`
      return hljs.highlight(codeString, { language: 'javascript' }).value
    }).join('\n\n')
  }, [drawRecords])

  /**
   * 复制代码到剪贴板
   */
  const copyCodeToClipboard = useCallback(async () => {
    const code = getCombinedCodePlain()
    if (!code) return

    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    } catch (err) {
      console.error('复制失败:', err)
    }
  }, [getCombinedCodePlain])

  /**
   * 执行绘制函数并记录
   * @param drawFunction - 要执行的绘制函数
   * @param customParams - 自定义参数
   */
  const executeDrawFunction = useCallback((drawFunction: DrawFunction, customParams: LineParams) => {
    if (!fabricCanvasRef.current) return

    const params = customParams
    const fabricObject = drawFunction.execute(fabricCanvasRef.current, customParams)

    // 创建绘制记录
    const codeString = `${drawFunction.name}(${JSON.stringify(params, null, 2)});`;
    const highlightedCode = hljs.highlight(codeString, { language: 'javascript' }).value;

    const record: DrawRecord = {
      id: `${Date.now()}-${drawFunction.name}`,
      functionName: drawFunction.name,
      displayName: drawFunction.displayName,
      params,
      timestamp: Date.now(),
      fabricObject,
      codeSnippet: highlightedCode
    }

    setDrawRecords(prev => [...prev, record])
  }, [])

  /**
   * 处理拖拽开始
   * @param drawFunction - 被拖拽的绘制函数
   */
  const handleDragStart = useCallback((drawFunction: DrawFunction) => {
    setIsDragging(true)
    setDraggedFunction(drawFunction)
  }, [])

  /**
   * 处理拖拽结束
   */
  const handleDragEnd = useCallback(() => {
    setIsDragging(false)
    setDraggedFunction(null)
  }, [])

  /**
   * 处理画布拖拽放置
   * @param e - 拖拽事件
   */
  const handleCanvasDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()

    if (!draggedFunction || !canvasRef.current) return

    const canvasRect = canvasRef.current.getBoundingClientRect()
    const dropX = e.clientX - canvasRect.left
    const dropY = e.clientY - canvasRect.top

    // 根据拖拽位置调整绘制参数
    let customParams
    switch (draggedFunction.name) {
      case 'drawHorizontalLine':
        customParams = {
          x: dropX,
          y: dropY,
        }
        break
      case 'drawVerticalLine':
        customParams = {
          x: dropX,
          y: dropY,
        }
        break
      case 'drawDiagonalLine':
        customParams = {
          x: dropX,
          y: dropY,
        }
        break
      case 'drawDashedLine':
        customParams = {
          x: dropX,
          y: dropY,
        }
        break
      default:
        customParams = { x: 0, y: 0 }
    }

    executeDrawFunction(draggedFunction, customParams)
    handleDragEnd()
  }, [draggedFunction, executeDrawFunction, handleDragEnd])

  /**
   * 删除绘制记录
   * @param recordId - 记录ID
   */
  const deleteDrawRecord = useCallback((recordId: string) => {
    const record = drawRecords.find(r => r.id === recordId)
    if (record && fabricCanvasRef.current) {
      if (Array.isArray(record.fabricObject)) {
        record.fabricObject.forEach(obj => fabricCanvasRef.current?.remove(obj))
      } else {
        fabricCanvasRef.current.remove(record.fabricObject)
      }

      fabricCanvasRef.current.requestRenderAll()
      setDrawRecords(prev => prev.filter(r => r.id !== recordId))
    }
  }, [drawRecords])

  /**
   * 更新绘制记录参数
   * @param fabricObject - Fabric.js 对象
   */
  const updateRecordParams = useCallback((fabricObject: FabricObject) => {
    setDrawRecords(prev => prev.map(record => {
      if (record.fabricObject === fabricObject) {
        // 获取线条的当前坐标
        const line = fabricObject as Line
        const updatedParams: LineParams = {
          x: Math.round((line.x1 ?? 0) + (line.left ?? 0)),
          y: Math.round((line.y1 ?? 0) + (line.top ?? 0)),
        }
        return {
          ...record,
          params: updatedParams
        }
      }
      return record
    }))
  }, [])

  /**
   * 清空画布和记录
   */
  const clearCanvas = useCallback(() => {
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.clear()
      setDrawRecords([])
    }
  }, [])

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
      selection: true,
    })
    fabricCanvasRef.current = canvas

    // 添加对象修改事件监听器
    const handleObjectModified = (e: { target?: FabricObject }) => {
      if (e.target) {
        updateRecordParams(e.target)
      }
    }

    canvas.on('object:modified', handleObjectModified)

    return () => {
      canvas.off('object:modified', handleObjectModified)
      canvas?.dispose().catch((err) => console.log(err))
    }
  }, [updateRecordParams])

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-4">
            Fabric.js 绘制计算器
          </h1>
          <p className="text-gray-600">
            这是一个交互式工具，用于通过拖放功能在画布上绘制线条并查看相应的代码生成。
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* 左侧：绘制函数列表 */}
          <div className="lg:col-span-3 bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold text-gray-700 mb-4">绘制函数</h2>
            <div className="space-y-4">
              {drawFunctions.map((func) => (
                <div
                  key={func.name}
                  className="p-4 border border-gray-200 rounded-md cursor-grab active:cursor-grabbing bg-gray-50 hover:bg-gray-100 transition-colors duration-200"
                  draggable
                  onDragStart={() => handleDragStart(func)}
                  onDragEnd={handleDragEnd}
                >
                  <div>
                    <h3 className="font-bold text-gray-800 text-lg mb-1">{func.displayName}</h3>
                    {/* <p className="text-sm text-gray-600">{func.description}</p> */}
                    <div className="text-xs text-gray-500 mt-2 font-mono">
                      {func.name}()
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {isDragging && draggedFunction && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="text-sm text-blue-800">
                  正在拖拽: {draggedFunction.displayName}
                </div>
              </div>
            )}

            <button
              onClick={clearCanvas}
              className="mt-6 w-full bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-md transition-colors duration-200"
            >
              清空画布
            </button>
          </div>

          {/* 中间：画布 */}
          <div className="lg:col-span-5 bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold text-gray-700 mb-4">画布</h2>
            <div
              className="border border-gray-300 rounded-md overflow-hidden"
              onDrop={handleCanvasDrop}
              onDragOver={(e) => e.preventDefault()}
            >
              <canvas ref={canvasRef} />
            </div>
          </div>

          {/* 右侧：绘制记录和代码 */}
          <div className="lg:col-span-4 bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">绘制记录</h2>
            <p className="text-sm text-gray-600 mb-4">
              显示画布上的绘制历史和参数
            </p>

            {drawRecords.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <div className="text-4xl mb-2">📝</div>
                <div>暂无绘制记录</div>
              </div>
            ) : (
              <>
                <div className="space-y-3 max-h-64 overflow-y-auto mb-4">
                  {drawRecords.map((record, index) => (
                    <div key={record.id} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-medium text-gray-800 text-sm">
                          #{index + 1} {record.displayName}
                        </div>
                        <button
                          onClick={() => deleteDrawRecord(record.id)}
                          className="text-red-500 hover:text-red-700 text-xs"
                        >
                          删除
                        </button>
                      </div>

                      <div className="text-xs text-gray-600 mb-2">
                        函数: <span className="font-mono">{record.functionName}</span>
                      </div>

                      <div className="text-xs text-gray-600">
                        参数:
                        <pre className="mt-1 bg-gray-50 p-2 rounded text-xs overflow-x-auto">
                          {JSON.stringify(record.params, null, 2)}
                        </pre>
                      </div>

                      <div className="text-xs text-gray-400 mt-2">
                        {new Date(record.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-gray-200 pt-4">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-sm font-medium text-gray-700">生成代码</h3>
                    <button
                      onClick={copyCodeToClipboard}
                      className="text-xs bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded transition-colors duration-200 flex items-center gap-1"
                      disabled={drawRecords.length === 0}
                    >
                      {copied ? (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          已复制
                        </>
                      ) : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                            <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                          </svg>
                          复制代码
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="bg-gray-800 text-white p-3 rounded text-xs overflow-x-auto max-h-48">
                    <code dangerouslySetInnerHTML={{ __html: getCombinedCode() }} />
                  </pre>
                </div>
              </>
            )}

            {drawRecords.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="text-sm text-gray-600">
                  总计: {drawRecords.length} 个绘制对象
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default FabricCalcPage
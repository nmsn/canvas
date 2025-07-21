'use client'

import { useEffect, useRef, type FC } from 'react'
import { StaticCanvas, Canvas, Rect } from 'fabric'

/**
 * Fabric.js 测试页面组件
 * 在画布上绘制一个红色正方形
 */
const FabricTestPage: FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fabricCanvasRef = useRef<Canvas | null>(null)

  /**
   * 初始化 Fabric.js 画布并绘制红色正方形
   */
  useEffect(() => {
    if (!canvasRef.current) return

    // 创建 Fabric.js 画布实例
    const canvas = new Canvas(canvasRef.current, {
      width: 800,
      height: 600,
      backgroundColor: '#f8f9fa',
    })

    fabricCanvasRef.current = canvas

    // 创建红色正方形
    const redSquare = new Rect({
      left: 350,
      top: 250,
      width: 100,
      height: 100,
      fill: 'red',
      stroke: '#333',
      strokeWidth: 2,
    })

    // 将正方形添加到画布
    canvas.add(redSquare)

    // 确保画布正确渲染
    setTimeout(() => {
      canvas.renderAll()
    }, 0)

    // 清理函数
    return () => {
      canvas.dispose().then(e => console.log(e)).catch(e => console.error(e))
    }
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-4">
            Fabric.js 测试页面
          </h1>
          <p className="text-gray-600">
            使用 Fabric.js 在画布上绘制一个红色的正方形
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-gray-800 mb-2">画布区域</h2>
            <p className="text-sm text-gray-600">
              画布中央显示一个红色正方形
            </p>
          </div>

          {/* 画布容器 */}
          <div className="border-2 border-gray-200 rounded-lg p-4 bg-gray-50">
            <canvas
              ref={canvasRef}
              className="border border-gray-300 mx-auto block"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default FabricTestPage
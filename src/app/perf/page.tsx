'use client'

import React, { useEffect, useRef } from 'react'
import { Canvas, Rect } from 'fabric';

import html2canvas from 'html2canvas';
import { snapdom } from '@zumer/snapdom';

// 生成随机颜色
const getRandomColor = (): string => {
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57', '#FF9FF3', '#54A0FF', '#5F27CD']
  return colors[Math.floor(Math.random() * colors.length)] ?? '#000000'
}

// 生成四层颜色
const colors = [getRandomColor(), getRandomColor(), getRandomColor(), getRandomColor()]

export default function PerfPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fabricCanvasRef = useRef<Canvas>(null)
  const domContainerRef = useRef<HTMLDivElement>(null)



  // 初始化Fabric.js Canvas
  useEffect(() => {
    const initFabricCanvas = () => {
      // 检查fabric是否已经加载
      if (canvasRef.current) {
        fabricCanvasRef.current = new Canvas(canvasRef.current, {
          width: 500,
          height: 400,
          backgroundColor: '#f0f0f0'
        })

        // 创建20个正方形，每个有4层嵌套
        for (let i = 0; i < 20; i++) {
          const x = (i % 5) * 100 + 50
          const y = Math.floor(i / 5) * 100 + 50

          // 创建4层正方形
          const sizes = [50, 40, 30, 20]
          sizes.forEach((size, layerIndex) => {
            const rect = new Rect({
              left: x - size / 2,
              top: y - size / 2,
              width: size,
              height: size,
              fill: colors[layerIndex] ?? '#000000',
              selectable: false
            })
            fabricCanvasRef.current?.add(rect)
          })
        }

        fabricCanvasRef.current?.renderAll()
      }
    }

    initFabricCanvas();

    // 清理函数
    return () => {
      if (fabricCanvasRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        fabricCanvasRef.current?.dispose()
        fabricCanvasRef.current = null
      }
    }
  }, [])

  const onSnapDom = async () => {
    const startTime = performance.now()
    console.log('开始执行 onSnapDom')

    if (domContainerRef.current) {
      const png = await snapdom.toPng(domContainerRef.current);
      document.body.appendChild(png);
    }

    const endTime = performance.now()
    const executionTime = endTime - startTime
    console.log(`onSnapDom 执行完成，耗时: ${executionTime.toFixed(2)}ms`)
  };

  const onHtml2Canvas = async (foreignObjectRendering?: boolean) => {
    const startTime = performance.now()
    console.log('开始执行 onHtml2Canvas')

    if (domContainerRef.current) {
      try {
        const canvas = await html2canvas(domContainerRef.current, {
          // 忽略不支持的 CSS 属性
          ignoreElements: (element) => {
            // 可以在这里过滤掉有问题的元素
            return false;
          },
          // 使用更兼容的选项
          useCORS: true,
          allowTaint: true,
          // 忽略 CSS 错误
          logging: false,
          // 设置背景色避免透明度问题
          backgroundColor: '#ffffff',
          foreignObjectRendering: foreignObjectRendering ?? false,
        });
        document.body.appendChild(canvas);
      } catch (error) {
        console.error('html2canvas 执行失败:', error);
        // 提供备选方案或错误提示
        alert('html2canvas 执行失败，可能是由于不支持的 CSS 属性。请查看控制台了解详情。');
      }
    }

    const endTime = performance.now()
    const executionTime = endTime - startTime
    console.log(`onHtml2Canvas 执行完成，耗时: ${executionTime.toFixed(2)}ms`)
  };

  const onFabric2Pic = async () => {
    const startTime = performance.now()
    console.log('开始执行 onFabric2Pic')

    if (fabricCanvasRef.current) {
      const png = fabricCanvasRef.current.toDataURL();
      console.log(png);
      // document.body.appendChild(png);
    }

    const endTime = performance.now()
    const executionTime = endTime - startTime
    console.log(`onFabric2Pic 执行完成，耗时: ${executionTime.toFixed(2)}ms`)
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">
        DOM vs Canvas 性能比较
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
        {/* DOM 实现区域 */}
        <div className="bg-white p-4 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">
            DOM 实现 (20个四层嵌套正方形)
          </h2>
          <div ref={domContainerRef} className="relative p-4" style={{ width: '500px', height: '400px', backgroundColor: '#f3f4f6' }}>
            {Array.from({ length: 20 }, (_, i) => (
              <div key={i} className="absolute" style={{
                left: `${(i % 5) * 100}px`,
                top: `${Math.floor(i / 5) * 100}px`,
              }}>
                {[50, 40, 30, 20].map((size, layerIndex) => (
                  <div
                    key={layerIndex}
                    className="absolute"
                    style={{
                      width: `${size}px`,
                      height: `${size}px`,
                      backgroundColor: colors[layerIndex] ?? '#000000',
                      left: `${(50 - size) / 2}px`,
                      top: `${(50 - size) / 2}px`,
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Canvas 实现区域 */}
        <div className="bg-white p-4 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">
            Canvas 实现 (20个四层嵌套正方形)
          </h2>
          <div className="p-4">
            <canvas
              ref={canvasRef}
              className="border border-gray-300"
              style={{ width: '500px', height: '400px' }}
            />
          </div>
        </div>
      </div>

      <div className="mt-8 text-center text-gray-600">
        <p>左侧使用DOM元素实现，右侧使用Canvas实现</p>
        <p>可以比较两种方式的渲染性能和交互体验</p>
      </div>

      <div className="mt-8 flex justify-center gap-4">
        <button
          onClick={onSnapDom}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          SnapDOM 截图
        </button>
        <button
          onClick={() => onHtml2Canvas(false)}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
        >
          Html2Canvas 截图
        </button>
        <button
          onClick={() => onHtml2Canvas(true)}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
        >
          Html2Canvas 截图 (foreignObjectRendering)
        </button>
        <button
          onClick={onFabric2Pic}
          className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
        >
          Fabric 导出
        </button>
      </div>
    </div>
  )
}
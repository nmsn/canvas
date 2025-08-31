'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Canvas, Rect } from 'fabric';

import html2canvas from 'html2canvas';
import { snapdom } from '@zumer/snapdom';

// 生成随机颜色
const getRandomColor = (): string => {
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57', '#FF9FF3', '#54A0FF', '#5F27CD']
  return colors[Math.floor(Math.random() * colors.length)] ?? '#000000'
}



export default function PerfPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fabricCanvasRef = useRef<Canvas>(null)
  const domContainerRef = useRef<HTMLDivElement>(null)

  // 存储生成的图片
  const [snapDomImage, setSnapDomImage] = useState<string>('')
  const [html2CanvasImage, setHtml2CanvasImage] = useState<string>('')
  const [fabricImage, setFabricImage] = useState<string>('')

  // 存储执行时间
  const [snapDomTime, setSnapDomTime] = useState<number>(0)
  const [html2CanvasTime, setHtml2CanvasTime] = useState<number>(0)
  const [fabricTime, setFabricTime] = useState<number>(0)

  // 存储DOM正方形数据
  const [domSquares, setDomSquares] = useState<Array<{
    id: number;
    x: number;
    y: number;
    layers: Array<{ size: number; color: string }>;
  }>>([])



  // 生成DOM正方形数据的函数
  const generateDomSquares = () => {
    const squares = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: (i % 5) * 100 + 25,
      y: Math.floor(i / 5) * 100 + 25,
      layers: [50, 40, 30, 20].map(size => ({
        size,
        color: getRandomColor()
      }))
    }))
    setDomSquares(squares)
  }

  // 在useEffect中生成DOM正方形数据
  useEffect(() => {
    generateDomSquares()
  }, [])

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
              fill: getRandomColor(),
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
      try {
        const png = await snapdom.toPng(domContainerRef.current);
        // 将图片转换为 data URL 并保存到状态
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = png.width;
        canvas.height = png.height;
        ctx?.drawImage(png, 0, 0);
        const dataUrl = canvas.toDataURL();
        setSnapDomImage(dataUrl);
      } catch (error) {
        console.error('SnapDom 执行失败:', error);
      }
    }

    const endTime = performance.now()
    const executionTime = endTime - startTime
    setSnapDomTime(executionTime)
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
        // 将 canvas 转换为 data URL 并保存到状态
        const dataUrl = canvas.toDataURL();
        setHtml2CanvasImage(dataUrl);
      } catch (error) {
        console.error('html2canvas 执行失败:', error);
        // 提供备选方案或错误提示
        alert('html2canvas 执行失败，可能是由于不支持的 CSS 属性。请查看控制台了解详情。');
      }
    }

    const endTime = performance.now()
    const executionTime = endTime - startTime
    setHtml2CanvasTime(executionTime)
    console.log(`onHtml2Canvas 执行完成，耗时: ${executionTime.toFixed(2)}ms`)
  };

  const onFabric2Pic = async () => {
    const startTime = performance.now()
    console.log('开始执行 onFabric2Pic')

    if (fabricCanvasRef.current) {
      const png = fabricCanvasRef.current.toDataURL();
      setFabricImage(png);
    }

    const endTime = performance.now()
    const executionTime = endTime - startTime
    setFabricTime(executionTime)
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
            {domSquares.map((square) => (
              <div key={square.id} className="absolute" style={{
                left: `${square.x}px`,
                top: `${square.y}px`,
              }}>
                {square.layers.map((layer, layerIndex) => (
                  <div
                    key={layerIndex}
                    className="absolute"
                    style={{
                      width: `${layer.size}px`,
                      height: `${layer.size}px`,
                      backgroundColor: layer.color,
                      left: `${(50 - layer.size) / 2}px`,
                      top: `${(50 - layer.size) / 2}px`,
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

      {/* 图片展示区域 */}
      <div className="mt-12 max-w-6xl mx-auto">
        <h2 className="text-2xl font-bold text-center mb-8 text-gray-800">
          截图结果展示
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* SnapDOM 结果 */}
          <div className="bg-white p-4 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold text-gray-700 mb-4 text-center">
              SnapDOM 截图结果
            </h3>
            <div className="flex justify-center items-center min-h-[200px] bg-gray-50 rounded">
              {snapDomImage ? (
                <img
                  src={snapDomImage}
                  alt="SnapDOM 截图"
                  className="max-w-full max-h-[300px] object-contain border"
                />
              ) : (
                <p className="text-gray-500">点击 "SnapDOM 截图" 按钮生成图片</p>
              )}
            </div>
            {snapDomTime > 0 && (
              <div className="mt-3 text-center">
                <span className="text-sm text-blue-600 font-medium">
                  执行耗时: {snapDomTime.toFixed(2)}ms
                </span>
              </div>
            )}
          </div>

          {/* Html2Canvas 结果 */}
          <div className="bg-white p-4 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold text-gray-700 mb-4 text-center">
              Html2Canvas 截图结果
            </h3>
            <div className="flex justify-center items-center min-h-[200px] bg-gray-50 rounded">
              {html2CanvasImage ? (
                <img
                  src={html2CanvasImage}
                  alt="Html2Canvas 截图"
                  className="max-w-full max-h-[300px] object-contain border"
                />
              ) : (
                <p className="text-gray-500">点击 "Html2Canvas 截图" 按钮生成图片</p>
              )}
            </div>
            {html2CanvasTime > 0 && (
              <div className="mt-3 text-center">
                <span className="text-sm text-green-600 font-medium">
                  执行耗时: {html2CanvasTime.toFixed(2)}ms
                </span>
              </div>
            )}
          </div>

          {/* Fabric 结果 */}
          <div className="bg-white p-4 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold text-gray-700 mb-4 text-center">
              Fabric 导出结果
            </h3>
            <div className="flex justify-center items-center min-h-[200px] bg-gray-50 rounded">
              {fabricImage ? (
                <img
                  src={fabricImage}
                  alt="Fabric 导出"
                  className="max-w-full max-h-[300px] object-contain border"
                />
              ) : (
                <p className="text-gray-500">点击 "Fabric 导出" 按钮生成图片</p>
              )}
            </div>
            {fabricTime > 0 && (
              <div className="mt-3 text-center">
                <span className="text-sm text-purple-600 font-medium">
                  执行耗时: {fabricTime.toFixed(2)}ms
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
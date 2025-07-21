'use client'

import { useEffect, useRef, type FC } from 'react'
import dynamic from 'next/dynamic'
import { } from 'leafer-ui';

// 导入 leafer-ui 类型，但不导入实际模块
import type { LeaferProps, RectProps } from 'leafer-ui'

// 定义 PageProps 类型
type PageProps = Record<string, never>

// 创建动态组件，确保只在客户端加载
const DynamicLeaferUI = dynamic(
  () => import('leafer-ui').then((mod) => {
    // 返回一个空组件，我们只需要导入模块
    return function DummyComponent() { return null }
  }),
  { ssr: false }
)

const Page: FC<PageProps> = () => {
  const canvasRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // 确保代码只在浏览器环境中执行
    if (typeof window === 'undefined') return

    // 动态导入 leafer-ui
    import('leafer-ui').then(({ Leafer, Rect }) => {
      const canvas = canvasRef.current
      if (!canvas) return

      const leafer = new Leafer({
        view: canvas,
        width: 600, // 不能设置为 0， 否则会变成自动布局
        height: 600,
        fill: '#f5f5f5',

        wheel: { zoomMode: true },
        zoom: { min: 0.02, max: 256 }
      } as LeaferProps)

      const rect = new Rect({
        x: 100,
        y: 100,
        width: 200,
        height: 200,
        fill: '#32cd79', // 背景色
        stroke: 'black',
        strokeWidth: 2,
        draggable: true
      } as RectProps)

      leafer.add(rect)
    })

    const cas = document.getElementById('cas');
    console.log(cas?.clientWidth, cas?.clientHeight);
  }, [])
  return (
    <>
      <div ref={canvasRef} className="w-[600px] h-[600px]">
        {/* 页面内容 */}
        {/* 空白页面 */}
      </div>
      <canvas id="cas" style={{ width: '600px', height: '600px' }} />
    </>
  )
}

export default Page

import Link from "next/link";

const pages = [
  { href: "/fabric", title: "Fabric.js 网格拖拽排序", description: "使用 Fabric.js 实现网格拖拽排序功能" },
  { href: "/plugins", title: "Fabric.js 插件页", description: "尺寸标注与横向换位吸附插件演示" },
  { href: "/mixCanvas", title: "Fabric.js 绘制计算器", description: "交互式工具，用于通过拖放功能在画布上绘制线条" },
  { href: "/perf", title: "DOM vs Canvas 性能比较", description: "比较 DOM 和 Canvas 的渲染性能和交互体验" },
  { href: "/sort", title: "拖拽排序示例", description: "纯 CSS + React 实现的拖拽排序功能" },
  { href: "/sortablejs", title: "SortableJS 示例", description: "使用 SortableJS 库实现网格拖拽" },
];

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
      <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
        <h1 className="text-5xl font-extrabold tracking-tight text-white sm:text-[5rem]">
          Canvas <span className="text-[hsl(280,100%,70%)]">Demo</span>
        </h1>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-8">
          {pages.map((page) => (
            <Link
              key={page.href}
              className="flex max-w-xs flex-col gap-4 rounded-xl bg-white/10 p-4 text-white hover:bg-white/20"
              href={page.href}
            >
              <h3 className="text-2xl font-bold">{page.title} →</h3>
              <div className="text-lg">
                {page.description}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}

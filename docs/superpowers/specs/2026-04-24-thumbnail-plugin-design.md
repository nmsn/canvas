# ThumbnailPlugin 设计规格

## 概述

**ThumbnailPlugin** — 在独立浮动面板中渲染画布内容的缩略图，视口框跟随主画布同步更新。

**是否适合插件形式**：是。功能边界清晰（只负责渲染预览），不侵入主画布逻辑，可独立启用/禁用。

---

## 架构

```
┌─────────────────────────────────────┐
│           主画布 (Canvas)            │
│  - 业务对象 (nodes/connections)     │
│  - 视口变换 (viewportTransform)       │
└──────────────┬──────────────────────┘
               │ 监听 after:render / viewport:transformed
               ▼
┌─────────────────────────────────────┐
│        ThumbnailPlugin             │
│  - 创建独立缩略图画布                │
│  - 克隆主画布对象到缩略图            │
│  - 同步视口框位置                   │
└──────────────┬──────────────────────┘
               │ 渲染到独立 DOM 容器
               ▼
┌─────────────────────────────────────┐
│     缩略图面板 (HTML Overlay)        │
│  - 固定尺寸 160×120                 │
│  - 半透明背景 + 细边框              │
│  - 固定在右下角                    │
└─────────────────────────────────────┘
```

**与其他插件的关系**：ThumnailPlugin 是纯展示型插件，不修改主画布对象，只读取状态。

---

## 接口定义

### ThumbnailPluginOptions

```typescript
export interface ThumbnailPluginOptions {
  container: HTMLElement;      // 必填：缩略图面板的父容器
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'; // 视口框对齐，默认 'bottom-right'
  backgroundColor?: string;    // 缩略图背景色，默认 'rgba(0,0,0,0.05)'
  viewportStroke?: string;     // 视口框边框色，默认 '#6366f1'
  viewportFill?: string;       // 视口框填充，默认 'rgba(99,102,241,0.1)'
  padding?: number;            // 缩略图画布内边距，默认 8
}
```

### ThumbnailPlugin

```typescript
export class ThumbnailPlugin {
  private canvas: Canvas;          // 主画布引用
  private thumbnailCanvas: Canvas;  // 缩略图画布
  private container: HTMLElement;   // 面板 DOM 容器
  private viewportRect: FabricObject; // 视口框对象
  private options: Required<ThumbnailPluginOptions>;
  private enabled = false;
  private resizeObserver: ResizeObserver;  // 监听容器尺寸变化

  constructor(canvas: Canvas, options: ThumbnailPluginOptions);

  enable(): void;   // 创建面板 + 启动同步
  disable(): void;  // 销毁面板 + 停止同步
  isEnabled(): boolean;

  private syncObjects(): void;     // 同步对象到缩略图画布
  private syncViewport(): void;   // 同步视口框位置
  private fitToContent(): void;   // 计算缩放比例，使内容完整显示
  private handleResize(): void;   // 容器尺寸变化时重新计算
  private createViewportRect(): void;
}
```

### 面板 DOM 结构

```html
<div class="thumbnail-panel">
  <canvas class="thumbnail-canvas"></canvas>
</div>
```

---

## 数据流与同步机制

### 渲染时机

- 监听主画布 `after:render` — 触发缩略图重绘
- 监听 `viewport:transformed` — 同步更新视口框位置

### 缩略图画布同步

```typescript
// 主画布 → 缩略图画布的对象同步
private syncObjects(): void {
  // 1. 清空缩略图画布
  this.thumbnailCanvas.clear();

  // 2. 遍历主画布对象，跳过临时对象（如 connection 辅助线）
  const objects = this.canvas.getObjects()
    .filter(obj => !obj.data?.isTemporary);

  // 3. 克隆对象到缩略图画布
  for (const obj of objects) {
    obj.clone((cloned: FabricObject) => {
      this.thumbnailCanvas.add(cloned);
    });
  }

  // 4. 设置缩略图画布视口变换，使其完整显示内容
  this.fitToContent();
}
```

### 视口框同步

```typescript
// 主画布视口 → 缩略图视口框
private syncViewport(): void {
  const mainViewport = this.canvas.viewportTransform;
  const mainZoom = this.canvas.getZoom();

  // 计算主画布可视区域
  const visibleArea = {
    x: -mainViewport[4] / mainZoom,
    y: -mainViewport[5] / mainZoom,
    width: this.canvas.width / mainZoom,
    height: this.canvas.height / mainZoom,
  };

  // 映射到缩略图坐标
  const thumbZoom = this.thumbnailCanvas.getZoom();
  this.viewportRect.set({
    left: visibleArea.x * thumbZoom,
    top: visibleArea.y * thumbZoom,
    width: visibleArea.width * thumbZoom,
    height: visibleArea.height * thumbZoom,
  });

  this.viewportRect.setCoords();
  this.thumbnailCanvas.requestRenderAll();
}
```

---

## 错误处理与边界情况

### 容器无效

```typescript
if (!options.container || options.container.nodeType !== 1) {
  throw new Error('ThumbnailPlugin: container must be a valid DOM element');
}
```

### 容器尺寸为 0

```typescript
private handleResize(): void {
  const { width, height } = this.container.getBoundingClientRect();

  if (width === 0 || height === 0) return; // 跳过不可见状态

  this.thumbnailCanvas.setWidth(width);
  this.thumbnailCanvas.setHeight(height);
  this.fitToContent();
  this.syncViewport();
}
```

### 视口框越界

```typescript
private syncViewport(): void {
  // 视口框永远在缩略图内容范围内
  const bounds = this.viewportRect.getBoundingRect();
  const canvasBounds = this.thumbnailCanvas.getBoundingRect();

  let { left, top } = this.viewportRect;

  // 左上角约束
  left = Math.max(0, left);
  top = Math.max(0, top);

  // 右下角约束
  left = Math.min(canvasBounds.width - bounds.width, left);
  top = Math.min(canvasBounds.height - bounds.height, top);

  this.viewportRect.set({ left, top });
}
```

### 主画布为空

```typescript
private fitToContent(): void {
  const objects = this.thumbnailCanvas.getObjects();
  if (objects.length === 0) {
    // 空画布居中显示一个占位点
    this.thumbnailCanvas.setBackgroundColor(
      this.options.backgroundColor,
      () => this.thumbnailCanvas.requestRenderAll()
    );
    return;
  }

  // 计算所有对象的包围盒，计算缩放比例
  // ...
}
```

---

## 实现计划

**开发方式**：TDD（测试驱动开发）

1. **先写测试** — 为 ThumbnailPlugin 编写完整的单元测试
   - `constructor` 异常情况
   - `enable` / `disable` 生命周期
   - `syncViewport` 视口同步逻辑
   - `handleResize` 容器尺寸变化
   - 视口框越界约束

2. **后实现功能** — 满足测试要求即可

3. **集成测试** — 与主画布及其他插件（如 ConnectionPlugin）配合正常工作

---

## 文件位置

```
src/app/plugins/utils/fabricPlugins/
├── thumbnailPlugin.ts      # 插件实现
├── thumbnailPlugin.test.ts  # 单元测试
└── index.ts                 # 导出（更新）
```

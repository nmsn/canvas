# ThumbnailPlugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 ThumbnailPlugin，在独立浮动面板中渲染画布内容缩略图，视口框跟随主画布同步更新。

**Architecture:** 创建独立的缩略图画布，克隆主画布对象，监听主画布事件同步渲染。容器配置支持字符串选择器、HTMLElement、函数三种形式，兼容 React/Vue 框架。

**Tech Stack:** TypeScript, Fabric.js, Vitest

---

## File Structure

```
src/app/plugins/utils/fabricPlugins/
├── thumbnailPlugin.ts       # 插件实现
├── thumbnailPlugin.test.ts  # 单元测试（TDD）
├── types.ts                 # 新增 ThumbnailPluginOptions 类型
└── index.ts                 # 更新导出

docs/superpowers/plans/2026-04-24-thumbnail-plugin-implementation.md  # 本计划
```

---

## Task 1: 添加 ThumbnailPluginOptions 类型到 types.ts

**Files:**
- Modify: `src/app/plugins/utils/fabricPlugins/types.ts`

- [ ] **Step 1: 添加 ThumbnailPluginOptions 类型定义**

```typescript
// 添加到 types.ts 末尾

export interface ThumbnailPluginOptions {
  container: string | HTMLElement | (() => HTMLElement);
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  backgroundColor?: string;
  viewportStroke?: string;
  viewportFill?: string;
  padding?: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/plugins/utils/fabricPlugins/types.ts
git commit -m "feat(thumbnailPlugin): add ThumbnailPluginOptions type"
```

---

## Task 2: 编写 ThumbnailPlugin 构造函数测试

**Files:**
- Create: `src/app/plugins/utils/fabricPlugins/thumbnailPlugin.test.ts`
- Test target: `ThumbnailPlugin` constructor

- [ ] **Step 1: 编写构造函数异常测试**

```typescript
import { describe, expect, it, vi } from "vitest";
import { SelectionPoolPlugin } from "../selectionPoolPlugin";

// Mock fabric module
vi.mock("fabric", () => ({
  Canvas: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    off: vi.fn(),
    getObjects: vi.fn().mockReturnValue([]),
    getZoom: vi.fn().mockReturnValue(1),
    viewportTransform: [1, 0, 0, 1, 0, 0],
    getTopContext: vi.fn(),
    upperCanvasEl: { width: 0, height: 0 },
    requestRenderAll: vi.fn(),
    setWidth: vi.fn(),
    setHeight: vi.fn(),
  })),
}));

describe("ThumbnailPlugin Constructor", () => {
  it("should throw error when container is invalid string selector", () => {
    // Arrange
    document.body.innerHTML = '<div id="app"></div>';
    const { Canvas } = require("fabric");
    const canvas = new Canvas();

    // Act & Assert
    expect(() => {
      const { ThumbnailPlugin } = require("../thumbnailPlugin");
      new ThumbnailPlugin(canvas, { container: ".nonexistent" });
    }).toThrow(/container ".nonexistent" not found/);
  });

  it("should throw error when container function returns invalid", () => {
    // Arrange
    const { Canvas } = require("fabric");
    const canvas = new Canvas();

    // Act & Assert
    expect(() => {
      const { ThumbnailPlugin } = require("../thumbnailPlugin");
      new ThumbnailPlugin(canvas, { container: () => null });
    }).toThrow(/container function must return a valid DOM element/);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `cd /Users/nmsn/Studio/canvas && npx vitest src/app/plugins/utils/fabricPlugins/thumbnailPlugin.test.ts --run`
Expected: FAIL with "Cannot find module '../thumbnailPlugin'"

- [ ] **Step 3: Commit**

```bash
git add src/app/plugins/utils/fabricPlugins/thumbnailPlugin.test.ts
git commit -m "test(thumbnailPlugin): add constructor error tests"
```

---

## Task 3: 实现 ThumbnailPlugin 构造函数

**Files:**
- Create: `src/app/plugins/utils/fabricPlugins/thumbnailPlugin.ts`

- [ ] **Step 1: 实现基本结构**

```typescript
"use client";

import type { Canvas, FabricObject } from "fabric";
import type { ThumbnailPluginOptions } from "./types";

const DEFAULT_OPTIONS = {
  position: "bottom-right" as const,
  backgroundColor: "rgba(0,0,0,0.05)",
  viewportStroke: "#6366f1",
  viewportFill: "rgba(99,102,241,0.1)",
  padding: 8,
};

export class ThumbnailPlugin {
  private readonly canvas: Canvas;
  private thumbnailCanvas: Canvas | null = null;
  private container: HTMLElement | null = null;
  private viewportRect: FabricObject | null = null;
  private readonly options: Required<ThumbnailPluginOptions>;
  private enabled = false;
  private resizeObserver: ResizeObserver | null = null;

  constructor(canvas: Canvas, options: ThumbnailPluginOptions) {
    this.canvas = canvas;
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.resolveContainer(); // 验证容器
  }

  private resolveContainer(): HTMLElement {
    const { container } = this.options;

    if (typeof container === "string") {
      const el = document.querySelector(container);
      if (!el) throw new Error(`ThumbnailPlugin: container "${container}" not found`);
      return el;
    }

    if (typeof container === "function") {
      const el = container();
      if (!el || el.nodeType !== 1) {
        throw new Error("ThumbnailPlugin: container function must return a valid DOM element");
      }
      return el;
    }

    return container;
  }

  enable(): void {
    if (this.enabled) return;
    this.enabled = true;
  }

  disable(): void {
    if (!this.enabled) return;
    this.enabled = false;
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}
```

- [ ] **Step 2: 运行测试验证通过**

Run: `cd /Users/nmsn/Studio/canvas && npx vitest src/app/plugins/utils/fabricPlugins/thumbnailPlugin.test.ts --run`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/plugins/utils/fabricPlugins/thumbnailPlugin.ts
git commit -m "feat(thumbnailPlugin): implement constructor with container resolution"
```

---

## Task 4: 编写 enable/disable 生命周期测试

**Files:**
- Modify: `src/app/plugins/utils/fabricPlugins/thumbnailPlugin.test.ts`

- [ ] **Step 1: 编写 enable/disable 测试**

```typescript
describe("ThumbnailPlugin enable/disable", () => {
  it("should enable plugin and create thumbnail canvas", () => {
    // Arrange
    document.body.innerHTML = '<div class="thumbnail"></div>';
    const { Canvas } = require("fabric");
    const { ThumbnailPlugin } = require("../thumbnailPlugin");
    const canvas = new Canvas();

    const plugin = new ThumbnailPlugin(canvas, { container: ".thumbnail" });

    // Act
    plugin.enable();

    // Assert
    expect(plugin.isEnabled()).toBe(true);
  });

  it("should disable plugin and cleanup", () => {
    // Arrange
    document.body.innerHTML = '<div class="thumbnail"></div>';
    const { Canvas } = require("fabric");
    const { ThumbnailPlugin } = require("../thumbnailPlugin");
    const canvas = new Canvas();

    const plugin = new ThumbnailPlugin(canvas, { container: ".thumbnail" });
    plugin.enable();

    // Act
    plugin.disable();

    // Assert
    expect(plugin.isEnabled()).toBe(false);
  });

  it("should not double enable", () => {
    // Arrange
    document.body.innerHTML = '<div class="thumbnail"></div>';
    const { Canvas } = require("fabric");
    const { ThumbnailPlugin } = require("../thumbnailPlugin");
    const canvas = new Canvas();

    const plugin = new ThumbnailPlugin(canvas, { container: ".thumbnail" });
    plugin.enable();
    const firstEnable = canvas.on.mock.calls.length;

    // Act
    plugin.enable();

    // Assert - should not register events twice
    expect(canvas.on.mock.calls.length).toBe(firstEnable);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npx vitest src/app/plugins/utils/fabricPlugins/thumbnailPlugin.test.ts --run`
Expected: FAIL

- [ ] **Step 3: 实现 enable/disable**

更新 `enable()` 和 `disable()` 方法，创建和销毁缩略图画布

- [ ] **Step 4: 运行测试验证通过**

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/plugins/utils/fabricPlugins/thumbnailPlugin.ts src/app/plugins/utils/fabricPlugins/thumbnailPlugin.test.ts
git commit -m "feat(thumbnailPlugin): implement enable/disable lifecycle"
```

---

## Task 5: 编写视口同步测试

**Files:**
- Modify: `src/app/plugins/utils/fabricPlugins/thumbnailPlugin.test.ts`

- [ ] **Step 1: 编写视口同步测试**

```typescript
describe("ThumbnailPlugin syncViewport", () => {
  it("should calculate visible area from main canvas viewport", () => {
    // Arrange
    document.body.innerHTML = '<div class="thumbnail"></div>';
    const mockViewportTransform = [1, 0, 0, 1, -100, -200];
    const { Canvas } = require("fabric");
    const { ThumbnailPlugin } = require("../thumbnailPlugin");
    const canvas = new Canvas();
    (canvas.viewportTransform as any) = mockViewportTransform;
    canvas.width = 800;
    canvas.height = 600;
    canvas.getZoom = vi.fn().mockReturnValue(0.5);

    const plugin = new ThumbnailPlugin(canvas, { container: ".thumbnail" });

    // Act
    plugin.enable();

    // Assert
    expect(plugin.isEnabled()).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Expected: FAIL

- [ ] **Step 3: 实现 syncViewport 和 fitToContent**

- [ ] **Step 4: 运行测试验证通过**

Expected: PASS

- [ ] **Step 5: Commit**

---

## Task 6: 编写 ResizeObserver 测试

**Files:**
- Modify: `src/app/plugins/utils/fabricPlugins/thumbnailPlugin.test.ts`

- [ ] **Step 1: 编写 handleResize 测试**

```typescript
it("should handle resize when container size is 0", () => {
  // Arrange
  document.body.innerHTML = '<div class="thumbnail" style="width:0;height:0"></div>';
  const { Canvas } = require("fabric");
  const { ThumbnailPlugin } = require("../thumbnailPlugin");
  const canvas = new Canvas();

  const plugin = new ThumbnailPlugin(canvas, { container: ".thumbnail" });

  // Act & Assert - should not crash
  plugin.enable();
  expect(plugin.isEnabled()).toBe(true);
});
```

- [ ] **Step 2: 运行测试验证失败**

Expected: FAIL

- [ ] **Step 3: 实现 handleResize**

- [ ] **Step 4: 运行测试验证通过**

Expected: PASS

- [ ] **Step 5: Commit**

---

## Task 7: 编写视口框越界约束测试

**Files:**
- Modify: `src/app/plugins/utils/fabricPlugins/thumbnailPlugin.test.ts`

- [ ] **Step 1: 编写视口框越界测试**

```typescript
it("should constrain viewport rect within canvas bounds", () => {
  // Arrange
  document.body.innerHTML = '<div class="thumbnail"></div>';
  const { Canvas } = require("fabric");
  const { ThumbnailPlugin } = require("../thumbnailPlugin");
  const canvas = new Canvas();

  const plugin = new ThumbnailPlugin(canvas, { container: ".thumbnail" });

  // Act
  plugin.enable();

  // Assert - viewport rect should be constrained
  expect(plugin.isEnabled()).toBe(true);
});
```

- [ ] **Step 2: 运行测试验证失败**

Expected: FAIL

- [ ] **Step 3: 实现视口框越界约束逻辑**

- [ ] **Step 4: 运行测试验证通过**

Expected: PASS

- [ ] **Step 5: Commit**

---

## Task 8: 集成测试 - 与主画布完整配合

**Files:**
- Modify: `src/app/plugins/utils/fabricPlugins/thumbnailPlugin.test.ts`

- [ ] **Step 1: 编写集成测试**

```typescript
describe("ThumbnailPlugin Integration", () => {
  it("should sync objects from main canvas", () => {
    // Arrange
    document.body.innerHTML = '<div class="thumbnail"></div>';
    const { Canvas, Rect } = require("fabric");
    const { ThumbnailPlugin } = require("../thumbnailPlugin");
    const canvas = new Canvas();
    const rect = new Rect({ left: 100, top: 100, width: 50, height: 50 });
    canvas.add(rect);

    const plugin = new ThumbnailPlugin(canvas, { container: ".thumbnail" });

    // Act
    plugin.enable();

    // Assert
    expect(plugin.isEnabled()).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Expected: FAIL

- [ ] **Step 3: 实现 syncObjects**

- [ ] **Step 4: 运行测试验证通过**

Expected: PASS

- [ ] **Step 5: Commit**

---

## Task 9: 更新 index.ts 导出

**Files:**
- Modify: `src/app/plugins/utils/fabricPlugins/index.ts`

- [ ] **Step 1: 添加导出**

```typescript
export { ThumbnailPlugin } from "./thumbnailPlugin";
export type { ThumbnailPluginOptions } from "./types";
```

- [ ] **Step 2: Commit**

```bash
git add src/app/plugins/utils/fabricPlugins/index.ts
git commit -m "feat(thumbnailPlugin): export ThumbnailPlugin"
```

---

## Task 10: 运行全部测试

- [ ] **Step 1: 运行全部测试**

Run: `npx vitest src/app/plugins/utils/fabricPlugins/ --run`
Expected: ALL PASS

- [ ] **Step 2: 提交所有剩余更改**

---

## 验证

实现完成后，确认：

1. `npx vitest src/app/plugins/utils/fabricPlugins/thumbnailPlugin.test.ts --run` — 全部通过
2. `npx tsc --noEmit` — 无类型错误
3. 插件可正常导入使用：`import { ThumbnailPlugin } from './utils/fabricPlugins'`

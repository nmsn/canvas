# ConnectionPlugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 `ConnectionPlugin`，在两个 Fabric 元素之间绘制贝塞尔曲线连接线，使用 Overlay 纯绘制方式。

**Architecture:** 通过 `after:render` 事件在 upperCanvas 上绘制贝塞尔曲线，连接线数据存储在插件内部 Map 中，支持声明式 `connect()/setConnections()` API，enable/disable 控制显隐。

**Tech Stack:** Fabric.js v6/v7, TypeScript, Jest (单元测试)

---

## File Map

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/app/plugins/utils/fabricPlugins/types.ts` | Modify | 新增 ConnectionPluginOptions, ConnectionOptions, Connection 类型 |
| `src/app/plugins/utils/fabricPlugins/connectionPlugin.ts` | Create | ConnectionPlugin 类主体实现 |
| `src/app/plugins/utils/fabricPlugins/index.ts` | Modify | 导出 ConnectionPlugin |
| `src/app/plugins/page.tsx` | Modify | 集成 ConnectionPlugin 到 demo 页面 |
| `src/app/plugins/utils/fabricPlugins/__tests__/connectionPlugin.test.ts` | Create | 核心算法单元测试 |

---

## Task 1: 添加类型定义

**Files:**
- Modify: `src/app/plugins/utils/fabricPlugins/types.ts:65-93` (在文件末尾添加)

**Steps:**

- [ ] **Step 1: 在 types.ts 末尾添加 Connection 相关类型**

在文件末尾（LayoutSlot 类型之后）添加：

```typescript
// Connection Plugin types
export interface ConnectionPluginOptions {
  lineColor?: string;
  lineWidth?: number;
  curvature?: number;
  arrowSize?: number;  // 预留
}

export interface ConnectionOptions {
  lineColor?: string;
  lineWidth?: number;
  curvature?: number;
}

export interface Connection {
  from: PluginCanvasObject;
  to: PluginCanvasObject;
  options?: ConnectionOptions;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/plugins/utils/fabricPlugins/types.ts
git commit -m "feat(connectionPlugin): add ConnectionPlugin types"
```

---

## Task 2: 创建 ConnectionPlugin 类骨架

**Files:**
- Create: `src/app/plugins/utils/fabricPlugins/connectionPlugin.ts`

**Steps:**

- [ ] **Step 1: 创建 connectionPlugin.ts 文件骨架**

```typescript
"use client";

import type { Canvas } from "fabric";
import type {
  Connection,
  ConnectionOptions,
  ConnectionPluginOptions,
  PluginCanvasObject,
} from "./types";

const DEFAULT_OPTIONS: Required<ConnectionPluginOptions> = {
  lineColor: "#64748b",
  lineWidth: 1.5,
  curvature: 0.5,
  arrowSize: 0,
};

export class ConnectionPlugin {
  private readonly canvas: Canvas;
  private readonly options: Required<ConnectionPluginOptions>;
  private enabled = false;
  private connections: Connection[] = [];
  private readonly handleAfterRender = () => this.draw();

  constructor(canvas: Canvas, options: ConnectionPluginOptions = {}) {
    this.canvas = canvas;
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  enable() {
    if (this.enabled) return;
    this.enabled = true;
    this.canvas.on("after:render", this.handleAfterRender);
    this.canvas.requestRenderAll();
  }

  disable() {
    if (!this.enabled) return;
    this.enabled = false;
    this.canvas.off("after:render", this.handleAfterRender);
    this.clearOverlay();
    this.canvas.requestRenderAll();
  }

  isEnabled() {
    return this.enabled;
  }

  private clearOverlay() {
    const context = this.canvas.getTopContext();
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(
      0,
      0,
      this.canvas.upperCanvasEl.width,
      this.canvas.upperCanvasEl.height,
    );
    context.restore();
  }

  private draw() {
    // 实现见 Task 3
  }

  // API 方法见 Task 4
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/plugins/utils/fabricPlugins/connectionPlugin.ts
git commit -m "feat(connectionPlugin): create ConnectionPlugin skeleton"
```

---

## Task 3: 实现核心绘制逻辑

**Files:**
- Modify: `src/app/plugins/utils/fabricPlugins/connectionPlugin.ts`

**Steps:**

- [ ] **Step 1: 实现 draw() 方法和辅助计算函数**

在 `ConnectionPlugin` 类中添加：

```typescript
  private draw() {
    if (!this.enabled) return;

    this.clearOverlay();
    const context = this.canvas.getTopContext();
    const zoom = this.canvas.getZoom() || 1;
    const viewportTransform = this.canvas.viewportTransform;

    context.save();

    if (viewportTransform) {
      context.transform(
        viewportTransform[0],
        viewportTransform[1],
        viewportTransform[2],
        viewportTransform[3],
        viewportTransform[4],
        viewportTransform[5],
      );
    }

    for (const conn of this.connections) {
      // 检查对象是否仍存在于画布
      if (!this.canvas.getObjects().includes(conn.from as unknown as import("fabric").FabricObject)) continue;
      if (!this.canvas.getObjects().includes(conn.to as unknown as import("fabric").FabricObject)) continue;

      const { startX, startY, endX, endY, cp1x, cp1y, cp2x, cp2y } =
        this.computeBezierPoints(conn);

      const lineColor = conn.options?.lineColor ?? this.options.lineColor;
      const lineWidth = (conn.options?.lineWidth ?? this.options.lineWidth) / zoom;

      context.strokeStyle = lineColor;
      context.lineWidth = lineWidth;
      context.setLineDash([]);

      context.beginPath();
      context.moveTo(startX, startY);
      context.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endX, endY);
      context.stroke();
    }

    context.restore();
  }

  private computeBezierPoints(conn: Connection): {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    cp1x: number;
    cp1y: number;
    cp2x: number;
    cp2y: number;
  } {
    const fromBounds = this.getSceneBounds(conn.from);
    const toBounds = this.getSceneBounds(conn.to);

    const srcCx = fromBounds.left + fromBounds.width / 2;
    const srcCy = fromBounds.top + fromBounds.height / 2;
    const tgtCx = toBounds.left + toBounds.width / 2;
    const tgtCy = toBounds.top + toBounds.height / 2;

    const curvature = conn.options?.curvature ?? this.options.curvature;

    let startX: number, startY: number, endX: number, endY: number;

    // 选择锚点
    if (tgtCx > srcCx) {
      // 源在左，目标在右 → 从源右边缘中点 到 目标左边缘中点
      startX = fromBounds.left + fromBounds.width;
      startY = fromBounds.top + fromBounds.height / 2;
      endX = toBounds.left;
      endY = toBounds.top + toBounds.height / 2;
    } else if (tgtCx < srcCx) {
      // 源在右，目标在左
      startX = fromBounds.left;
      startY = fromBounds.top + fromBounds.height / 2;
      endX = toBounds.left + toBounds.width;
      endY = toBounds.top + toBounds.height / 2;
    } else if (tgtCy > srcCy) {
      // 源在上，目标在下
      startX = srcCx;
      startY = fromBounds.top + fromBounds.height;
      endX = tgtCx;
      endY = toBounds.top;
    } else {
      // 源在下，目标在上
      startX = srcCx;
      startY = fromBounds.top;
      endX = tgtCx;
      endY = toBounds.top + toBounds.height;
    }

    // 计算控制点
    const distanceX = Math.abs(endX - startX);
    const distanceY = Math.abs(endY - startY);

    let cp1x: number, cp1y: number, cp2x: number, cp2y: number;

    if (distanceX >= distanceY) {
      // 水平关系为主 → S 弯
      const offset = distanceX * curvature;
      cp1x = startX + offset;
      cp1y = startY;
      cp2x = endX - offset;
      cp2y = endY;
    } else {
      // 垂直关系为主 → C 弯
      const offset = distanceY * curvature;
      cp1x = startX;
      cp1y = startY + offset;
      cp2x = endX;
      cp2y = endY - offset;
    }

    return { startX, startY, endX, endY, cp1x, cp1y, cp2x, cp2y };
  }

  private getSceneBounds(obj: PluginCanvasObject) {
    const bounds = obj.getBoundingRect();
    return {
      left: bounds.left,
      top: bounds.top,
      width: bounds.width,
      height: bounds.height,
    };
  }
```

- [ ] **Step 2: Commit**

```bash
git add src/app/plugins/utils/fabricPlugins/connectionPlugin.ts
git commit -m "feat(connectionPlugin): implement draw and bezier algorithm"
```

---

## Task 4: 实现 API 方法

**Files:**
- Modify: `src/app/plugins/utils/fabricPlugins/connectionPlugin.ts`

**Steps:**

- [ ] **Step 1: 添加 connect, setConnections, disconnect, clear, getConnections 方法**

在 `ConnectionPlugin` 类末尾添加：

```typescript
  connect(
    source: PluginCanvasObject,
    target: PluginCanvasObject,
    options?: ConnectionOptions,
  ) {
    // 禁止自连接
    if (source === target) return;

    // 检查是否已存在相同连接
    const exists = this.connections.some(
      (c) => c.from === source && c.to === target,
    );
    if (exists) return;

    this.connections.push({ from: source, to: target, options });
    if (this.enabled) {
      this.canvas.requestRenderAll();
    }
  }

  setConnections(connections: Array<{ from: PluginCanvasObject; to: PluginCanvasObject; options?: ConnectionOptions }>) {
    this.connections = [];
    for (const conn of connections) {
      if (conn.from !== conn.to) {
        this.connections.push(conn);
      }
    }
    if (this.enabled) {
      this.canvas.requestRenderAll();
    }
  }

  disconnect(source: PluginCanvasObject, target: PluginCanvasObject) {
    const index = this.connections.findIndex(
      (c) => c.from === source && c.to === target,
    );
    if (index !== -1) {
      this.connections.splice(index, 1);
      if (this.enabled) {
        this.canvas.requestRenderAll();
      }
    }
  }

  clear() {
    this.connections = [];
    if (this.enabled) {
      this.canvas.requestRenderAll();
    }
  }

  getConnections(): Connection[] {
    return [...this.connections];
  }
```

- [ ] **Step 2: Commit**

```bash
git add src/app/plugins/utils/fabricPlugins/connectionPlugin.ts
git commit -m "feat(connectionPlugin): add connect/setConnections/disconnect/clear API"
```

---

## Task 5: 导出 ConnectionPlugin

**Files:**
- Modify: `src/app/plugins/utils/fabricPlugins/index.ts:29-30`

**Steps:**

- [ ] **Step 1: 在 index.ts 添加导出**

在 `export { SortableSnapPlugin }` 之后添加：

```typescript
export { ConnectionPlugin } from "./connectionPlugin";
```

同时在文件顶部的 import type 中添加 `Connection` 和 `ConnectionPluginOptions` 的导出。

- [ ] **Step 2: Commit**

```bash
git add src/app/plugins/utils/fabricPlugins/index.ts
git commit -m "feat(connectionPlugin): export ConnectionPlugin"
```

---

## Task 6: 集成到 Demo 页面

**Files:**
- Modify: `src/app/plugins/page.tsx`
- Modify: `src/app/plugins/utils/fabricPlugins/canvasHelpers.ts` (如需添加测试对象)

**Steps:**

- [ ] **Step 1: 在 page.tsx 中集成 ConnectionPlugin**

参考现有的 DimensionPlugin 和 SortableSnapPlugin 集成方式：

1. 导入 `ConnectionPlugin`
2. 创建 ref: `connectionPluginRef`
3. 在 useEffect 中初始化 `new ConnectionPlugin(canvas, options)`
4. 添加到 ref
5. 在返回清理函数中调用 `connectionPlugin.disable()`
6. 在 UI 中添加控制按钮（开关 + connect 示例按钮）

示例代码片段：

```typescript
import { ConnectionPlugin } from './utils/fabricPlugins';

// 在 useEffect 中
const connectionPlugin = new ConnectionPlugin(canvas, {
  lineColor: '#6366f1',
  lineWidth: 1.5,
  curvature: 0.5,
});
connectionPluginRef.current = connectionPlugin;

// 添加连接示例
const connectElements = () => {
  const objects = canvas.getObjects().filter(isBusinessObject);
  if (objects.length >= 2) {
    connectionPlugin.connect(objects[0], objects[1]);
  }
};

// 在返回的 JSX 中添加按钮
<SidebarButton onClick={connectElements}>添加连接线</SidebarButton>
```

- [ ] **Step 2: Commit**

```bash
git add src/app/plugins/page.tsx
git commit -m "feat(demo): integrate ConnectionPlugin demo"
```

---

## Task 7: 单元测试（核心算法）

**Files:**
- Create: `src/app/plugins/utils/fabricPlugins/__tests__/connectionPlugin.test.ts`

**Steps:**

- [ ] **Step 1: 编写核心算法的单元测试**

测试控制点计算逻辑（不需要 Fabric Canvas，用纯函数测试）：

```typescript
import { describe, expect, it } from "vitest";

// 提取纯计算函数进行测试
function computeBezierPoints(
  srcBounds: { left: number; top: number; width: number; height: number },
  tgtBounds: { left: number; top: number; width: number; height: number },
  curvature: number,
) {
  const srcCx = srcBounds.left + srcBounds.width / 2;
  const srcCy = srcBounds.top + srcBounds.height / 2;
  const tgtCx = tgtBounds.left + tgtBounds.width / 2;
  const tgtCy = tgtBounds.top + tgtBounds.height / 2;

  let startX: number, startY: number, endX: number, endY: number;

  if (tgtCx > srcCx) {
    startX = srcBounds.left + srcBounds.width;
    startY = srcBounds.top + srcBounds.height / 2;
    endX = tgtBounds.left;
    endY = tgtBounds.top + tgtBounds.height / 2;
  } else if (tgtCx < srcCx) {
    startX = srcBounds.left;
    startY = srcBounds.top + srcBounds.height / 2;
    endX = tgtBounds.left + tgtBounds.width;
    endY = tgtBounds.top + tgtBounds.height / 2;
  } else if (tgtCy > srcCy) {
    startX = srcCx;
    startY = srcBounds.top + srcBounds.height;
    endX = tgtCx;
    endY = tgtBounds.top;
  } else {
    startX = srcCx;
    startY = srcBounds.top;
    endX = tgtCx;
    endY = tgtBounds.top + tgtBounds.height;
  }

  const distanceX = Math.abs(endX - startX);
  const distanceY = Math.abs(endY - startY);

  let cp1x: number, cp1y: number, cp2x: number, cp2y: number;

  if (distanceX >= distanceY) {
    const offset = distanceX * curvature;
    cp1x = startX + offset;
    cp1y = startY;
    cp2x = endX - offset;
    cp2y = endY;
  } else {
    const offset = distanceY * curvature;
    cp1x = startX;
    cp1y = startY + offset;
    cp2x = endX;
    cp2y = endY - offset;
  }

  return { startX, startY, endX, endY, cp1x, cp1y, cp2x, cp2y };
}

describe("computeBezierPoints", () => {
  it("水平关系：源在左目标在右，生成 S 弯", () => {
    const src = { left: 0, top: 0, width: 100, height: 50 };
    const tgt = { left: 200, top: 0, width: 100, height: 50 };
    const result = computeBezierPoints(src, tgt, 0.5);

    expect(result.startX).toBe(100); // src 右边缘
    expect(result.startY).toBe(25);  // src 高/2
    expect(result.endX).toBe(200);  // tgt 左边缘
    expect(result.endY).toBe(25);   // tgt 高/2

    // curvature=0.5, distanceX=100, offset=50
    expect(result.cp1x).toBe(150);  // startX + 50
    expect(result.cp1y).toBe(25);   // startY
    expect(result.cp2x).toBe(150);  // endX - 50
    expect(result.cp2y).toBe(25);   // endY
  });

  it("垂直关系：源在上目标在下，生成 C 弯", () => {
    const src = { left: 0, top: 0, width: 100, height: 50 };
    const tgt = { left: 0, top: 200, width: 100, height: 50 };
    const result = computeBezierPoints(src, tgt, 0.5);

    expect(result.startX).toBe(50);  // src 宽/2
    expect(result.startY).toBe(50);   // src 底边
    expect(result.endX).toBe(50);    // tgt 宽/2
    expect(result.endY).toBe(200);  // tgt 顶边

    // curvature=0.5, distanceY=150, offset=75
    expect(result.cp1x).toBe(50);   // startX
    expect(result.cp1y).toBe(125);  // startY + 75
    expect(result.cp2x).toBe(50);   // endX
    expect(result.cp2y).toBe(125);  // endY - 75
  });

  it("curvature=0 时退化为直线（控制点与端点重合）", () => {
    const src = { left: 0, top: 0, width: 100, height: 50 };
    const tgt = { left: 200, top: 0, width: 100, height: 50 };
    const result = computeBezierPoints(src, tgt, 0);

    expect(result.cp1x).toBe(result.startX);
    expect(result.cp2x).toBe(result.endX);
  });

  it("源右目标左时，方向反转", () => {
    const src = { left: 200, top: 0, width: 100, height: 50 };
    const tgt = { left: 0, top: 0, width: 100, height: 50 };
    const result = computeBezierPoints(src, tgt, 0.5);

    expect(result.startX).toBe(200); // src 左边缘
    expect(result.endX).toBe(100);    // tgt 右边缘
  });
});
```

- [ ] **Step 2: 运行测试确认通过**

检查是否有 vitest 配置，如果没有，创建 `src/app/plugins/utils/fabricPlugins/__tests__/vitest.config.ts`：

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
});
```

- [ ] **Step 3: Commit**

```bash
git add src/app/plugins/utils/fabricPlugins/__tests__/connectionPlugin.test.ts
git add src/app/plugins/utils/fabricPlugins/__tests__/vitest.config.ts
git commit -m "test(connectionPlugin): add bezier algorithm unit tests"
```

---

## Task 8: 点击创建模式（可选扩展）

**Files:**
- Modify: `src/app/plugins/utils/fabricPlugins/connectionPlugin.ts`

此为扩展功能，在主功能稳定后再实现。核心是在类中添加点击状态管理和临时连线绘制。

---

## Spec Coverage 检查

| Spec 需求 | 对应 Task |
|-----------|-----------|
| 核心 API (connect/setConnections/disconnect/clear) | Task 1, 4 |
| enable/disable 生命周期 | Task 2 |
| 自动控制点算法（S 弯/C 弯） | Task 3 |
| after:render 渲染 | Task 3 |
| upperCanvas 绘制 | Task 3 |
| viewportTransform 同步 | Task 3 |
| zoom 适配 | Task 3 |
| 类型定义 | Task 1 |
| 导出 | Task 5 |
| Demo 集成 | Task 6 |
| 单元测试 | Task 7 |
| 点击创建模式 | Task 8 (可选) |

---

Plan 完成并保存至 `docs/superpowers/plans/2026-04-18-fabric-connection-plugin.md`。

**两种执行方式：**

**1. Subagent-Driven (推荐)** — 每个 Task 由新的 subagent 执行，任务间有检查点，快速度迭代

**2. Inline Execution** — 在当前 session 中使用 executing-plans 批量执行，带检查点

选择哪种方式？
# SelectionPoolPlugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 SelectionPoolPlugin，支持点击选择元素到池中，自动淘汰最早选中的元素，支持自定义选中特效。

**Architecture:** 完全接管 Fabric 点击交互，通过 `object:added` 事件监听新元素，禁用原生选择框，提供选中池管理和特效应用。

**Tech Stack:** Fabric.js v6/v7, TypeScript, Vitest

---

## File Map

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/app/plugins/utils/fabricPlugins/types.ts` | Modify | 新增 SelectionPoolPluginOptions 类型 |
| `src/app/plugins/utils/fabricPlugins/selectionPoolPlugin.ts` | Create | SelectionPoolPlugin 主实现 |
| `src/app/plugins/utils/fabricPlugins/index.ts` | Modify | 导出 SelectionPoolPlugin |
| `src/app/plugins/page.tsx` | Modify | Demo 集成 |
| `src/app/plugins/utils/fabricPlugins/__tests__/selectionPoolPlugin.test.ts` | Create | 单元测试 |

---

## Task Groups (for Parallel Execution)

**Group A (顺序依赖):**
- Task 1 → Task 2 → Task 3

**Group B (可与 Group A 并行):**
- Task 4 → Task 7

**Group C (可与 Group A/B 并行):**
- Task 6 → Task 8

**独立任务:**
- Task 9 (demo) - 依赖 Task 8
- Task 10 (tests) - 可与其他并行

---

## Task 1: 添加类型定义

**Files:**
- Modify: `src/app/plugins/utils/fabricPlugins/types.ts:85` (末尾添加)

**Steps:**

- [ ] **Step 1: 在 types.ts 末尾添加 SelectionPoolPluginOptions 类型**

```typescript
// SelectionPoolPlugin types
export interface SelectionPoolPluginOptions {
  maxSelectCount?: number;           // 最大选中个数，默认 2
  selectedStroke?: string;           // 选中边框颜色，默认 '#6366f1'
  selectedStrokeWidth?: number;      // 选中边框宽度，默认 2
  selectedShadow?: string;           // 选中阴影，默认 '0 0 8px rgba(99,102,241,0.6)'
  onSelectionChange?: (objects: PluginCanvasObject[]) => void;  // 选中变化回调
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/plugins/utils/fabricPlugins/types.ts
git commit -m "feat(selectionPool): add SelectionPoolPluginOptions type"
```

---

## Task 2: 创建 SelectionPoolPlugin 类骨架

**Files:**
- Create: `src/app/plugins/utils/fabricPlugins/selectionPoolPlugin.ts`

**Steps:**

- [ ] **Step 1: 创建 selectionPoolPlugin.ts 骨架**

```typescript
"use client";

import type { Canvas, FabricObject, Shadow } from "fabric";
import type { PluginCanvasObject, SelectionPoolPluginOptions } from "./types";

const DEFAULT_OPTIONS: Required<SelectionPoolPluginOptions> = {
  maxSelectCount: 2,
  selectedStroke: "#6366f1",
  selectedStrokeWidth: 2,
  selectedShadow: "0 0 8px rgba(99,102,241,0.6)",
  onSelectionChange: undefined,
};

export class SelectionPoolPlugin {
  private readonly canvas: Canvas;
  private readonly options: Required<SelectionPoolPluginOptions>;
  private enabled = false;
  private selectionPool: PluginCanvasObject[] = [];
  private originalStates = new Map<PluginCanvasObject, {
    stroke?: string | number;
    strokeWidth?: number;
    shadow?: Shadow | string | null;
  }>();
  private readonly handleClick = (event: { target?: FabricObject }) =>
    this.onCanvasClick(event.target as PluginCanvasObject | undefined);

  constructor(canvas: Canvas, options: SelectionPoolPluginOptions = {}) {
    this.canvas = canvas;
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  enable() {
    if (this.enabled) return;
    this.enabled = true;
    this.canvas.on("mouse:down", this.handleClick);
    this.canvas.selection = false;
    this.canvas.getObjects().forEach((obj) => {
      (obj as PluginCanvasObject).selectable = false;
    });
  }

  disable() {
    if (!this.enabled) return;
    this.enabled = false;
    this.canvas.off("mouse:down", this.handleClick);
    this.canvas.selection = true;
    this.canvas.getObjects().forEach((obj) => {
      (obj as PluginCanvasObject).selectable = true;
    });
    this.clearSelection();
  }

  isEnabled() {
    return this.enabled;
  }

  getSelectedObjects(): PluginCanvasObject[] {
    return [...this.selectionPool];
  }

  // 实现见 Task 3, 4, 5, 6
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/plugins/utils/fabricPlugins/selectionPoolPlugin.ts
git commit -m "feat(selectionPool): create SelectionPoolPlugin skeleton"
```

---

## Task 3: 实现 select/deselect 特效

**Files:**
- Modify: `src/app/plugins/utils/fabricPlugins/selectionPoolPlugin.ts`

**Steps:**

- [ ] **Step 1: 添加 select 方法**

在 `getSelectedObjects` 后添加：

```typescript
  select(obj: PluginCanvasObject) {
    if (this.selectionPool.includes(obj)) return;

    // 保存原始状态
    this.originalStates.set(obj, {
      stroke: obj.stroke,
      strokeWidth: obj.strokeWidth,
      shadow: obj.shadow,
    });

    // 应用选中特效
    const shadow = new Shadow(this.options.selectedShadow);
    obj.set({
      stroke: this.options.selectedStroke,
      strokeWidth: this.options.selectedStrokeWidth,
      shadow,
    });
    obj.setCoords();

    this.selectionPool.push(obj);
    this.options.onSelectionChange?.(this.getSelectedObjects());
    this.canvas.requestRenderAll();
  }
```

- [ ] **Step 2: 添加 deselect 方法**

```typescript
  deselect(obj: PluginCanvasObject) {
    const index = this.selectionPool.indexOf(obj);
    if (index === -1) return;

    // 恢复原始状态
    const original = this.originalStates.get(obj);
    if (original) {
      obj.set({
        stroke: original.stroke,
        strokeWidth: original.strokeWidth,
        shadow: original.shadow,
      });
      obj.setCoords();
      this.originalStates.delete(obj);
    }

    this.selectionPool.splice(index, 1);
    this.options.onSelectionChange?.(this.getSelectedObjects());
    this.canvas.requestRenderAll();
  }
```

- [ ] **Step 3: Commit**

```bash
git add src/app/plugins/utils/fabricPlugins/selectionPoolPlugin.ts
git commit -m "feat(selectionPool): implement select/deselect with effects"
```

---

## Task 4: 实现点击事件处理（池管理逻辑）

**Files:**
- Modify: `src/app/plugins/utils/fabricPlugins/selectionPoolPlugin.ts`

**Steps:**

- [ ] **Step 1: 实现 onCanvasClick 方法**

在类中添加：

```typescript
  private onCanvasClick(target?: PluginCanvasObject) {
    if (!target || !this.enabled) return;

    // 过滤非业务对象
    const data = (target as PluginCanvasObject).data;
    if (data?.isGrid || data?.isPlaceholder || data?.isDimAnnotation || data?.isConnection) {
      return;
    }

    if (this.selectionPool.includes(target)) {
      // 已在池中，取消选中
      this.deselect(target);
    } else {
      // 不在池中
      if (this.selectionPool.length >= this.options.maxSelectCount) {
        // 池已满，淘汰第一个
        const oldest = this.selectionPool[0];
        if (oldest) {
          this.deselect(oldest);
        }
      }
      // 加入池
      this.select(target);
    }
  }
```

- [ ] **Step 2: Commit**

```bash
git add src/app/plugins/utils/fabricPlugins/selectionPoolPlugin.ts
git commit -m "feat(selectionPool): implement pool management logic"
```

---

## Task 5: 实现 clearSelection

**Files:**
- Modify: `src/app/plugins/utils/fabricPlugins/selectionPoolPlugin.ts`

**Steps:**

- [ ] **Step 1: 添加 clearSelection 方法**

```typescript
  clearSelection() {
    [...this.selectionPool].forEach((obj) => this.deselect(obj));
  }
```

- [ ] **Step 2: Commit**

```bash
git add src/app/plugins/utils/fabricPlugins/selectionPoolPlugin.ts
git commit -m "feat(selectionPool): add clearSelection method"
```

---

## Task 6: 导出 SelectionPoolPlugin

**Files:**
- Modify: `src/app/plugins/utils/fabricPlugins/index.ts`

**Steps:**

- [ ] **Step 1: 添加导出**

在 `export { ConnectionPlugin }` 后添加：
```typescript
export { SelectionPoolPlugin } from "./selectionPoolPlugin";
```

同时在类型导出中添加 `SelectionPoolPluginOptions`。

- [ ] **Step 2: Commit**

```bash
git add src/app/plugins/utils/fabricPlugins/index.ts
git commit -m "feat(selectionPool): export SelectionPoolPlugin"
```

---

## Task 7: 集成到 Demo 页面

**Files:**
- Modify: `src/app/plugins/page.tsx`

**Steps:**

- [ ] **Step 1: 导入 SelectionPoolPlugin**

```typescript
import {
  ConnectionPlugin,
  DimensionPlugin,
  SelectionPoolPlugin,
  SortableSnapPlugin,
  // ...
} from './utils/fabricPlugins'
```

- [ ] **Step 2: 创建 ref 和初始化**

```typescript
const selectionPluginRef = useRef<SelectionPoolPlugin | null>(null);
const [selectionEnabled, setSelectionEnabled] = useState(false);

// 在 useEffect 中
const selectionPlugin = new SelectionPoolPlugin(canvas, {
  maxSelectCount: 2,
  onSelectionChange: (objects) => {
    // 可选：自动连接前两个选中对象
    if (objects.length >= 2 && connectionPluginRef.current?.isEnabled()) {
      connectionPluginRef.current.clear();
      connectionPluginRef.current.connect(objects[0], objects[1]);
    }
  },
});
selectionPluginRef.current = selectionPlugin;

// 清理
selectionPlugin.disable();
```

- [ ] **Step 3: 添加 UI 控制**

添加 SelectionPoolPlugin 的开关卡片和联动逻辑。

- [ ] **Step 4: Commit**

```bash
git add src/app/plugins/page.tsx
git commit -m "feat(demo): integrate SelectionPoolPlugin with ConnectionPlugin联动"
```

---

## Task 8: 单元测试

**Files:**
- Create: `src/app/plugins/utils/fabricPlugins/__tests__/selectionPoolPlugin.test.ts`

**Steps:**

- [ ] **Step 1: 编写测试**

```typescript
import { describe, expect, it } from "vitest";

describe("SelectionPoolPlugin", () => {
  describe("pool management", () => {
    it("默认 maxSelectCount 为 2", () => {
      // Test default maxSelectCount
    });

    it("select 后对象进入池", () => {
      // Test select adds to pool
    });

    it("deselect 后对象离开池", () => {
      // Test deselect removes from pool
    });

    it("超过 maxSelectCount 时淘汰最早的对象", () => {
      // Test eviction when pool is full
    });
  });

  describe("effects", () => {
    it("选中时应用 stroke 特效", () => {
      // Test stroke effect applied
    });

    it("取消选中时恢复原始状态", () => {
      // Test original state restored
    });
  });
});
```

- [ ] **Step 2: 运行测试并修复**

- [ ] **Step 3: Commit**

```bash
git add src/app/plugins/utils/fabricPlugins/__tests__/selectionPoolPlugin.test.ts
git commit -m "test(selectionPool): add SelectionPoolPlugin unit tests"
```

---

## Spec Coverage 检查

| Spec 需求 | 对应 Task |
|-----------|-----------|
| maxSelectCount 配置 | Task 1, 3 |
| selectedStroke/Width/Shadow 配置 | Task 1, 3 |
| onSelectionChange 回调 | Task 1, 3 |
| enable/disable 生命周期 | Task 2 |
| getSelectedObjects API | Task 2 |
| select/deselect 特效 | Task 3 |
| 点击池管理逻辑 | Task 4 |
| clearSelection | Task 5 |
| 导出 | Task 6 |
| Demo 集成 | Task 7 |
| 单元测试 | Task 8 |

---

Plan 完成并保存至 `docs/superpowers/plans/2026-04-18-selection-pool-plugin.md`。

**执行方式：多 subagent 并行开发**

Group A (Task 1 → 2 → skeleton + enable/disable)
Group B (Task 3 → 4 → select/deselect + click handling)
Group C (Task 5 → 6 → clearSelection + export)
Task 7 (demo) - 等 Group C 完成
Task 8 (tests) - 可并行

选择 **Subagent-Driven (recommended)** 开始执行？
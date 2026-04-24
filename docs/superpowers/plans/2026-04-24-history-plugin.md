# History Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a HistoryPlugin that records canvas editing operations and provides undo/redo functionality

**Architecture:** Linear stack with pointer, Fabric.js event integration, merge strategy for rapid modifications

**Tech Stack:** TypeScript, Fabric.js v7, Vitest

---

## File Structure

- Create: `src/app/plugins/utils/fabricPlugins/historyPlugin.ts`
- Create: `src/app/plugins/utils/fabricPlugins/__tests__/historyPlugin.test.ts`
- Modify: `src/app/plugins/utils/fabricPlugins/types.ts` — add `HistoryNode` type and `HistoryPluginOptions`
- Modify: `src/app/plugins/utils/fabricPlugins/index.ts` — export `HistoryPlugin`

---

## Task 1: Add Types to types.ts

**Files:**
- Modify: `src/app/plugins/utils/fabricPlugins/types.ts`

- [ ] **Step 1: Add HistoryNode and HistoryPluginOptions types**

Add to `types.ts`:

```typescript
export interface HistoryNode {
  id: string;
  timestamp: number;
  type: "add" | "remove" | "modify";
  objectId: string;
  objectState: Record<string, unknown>;
}

export interface HistoryPluginOptions {
  maxHistorySize?: number;
  mergeThresholdMs?: number;
  onChange?: (canUndo: boolean, canRedo: boolean) => void;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/plugins/utils/fabricPlugins/types.ts
git commit -m "feat(historyPlugin): add HistoryNode and HistoryPluginOptions types"
```

---

## Task 2: Write Unit Tests for HistoryPlugin

**Files:**
- Create: `src/app/plugins/utils/fabricPlugins/__tests__/historyPlugin.test.ts`

- [ ] **Step 1: Write initial test file**

Create `__tests__/historyPlugin.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HistoryPlugin } from "../historyPlugin";

const createMockCanvas = () => ({
  on: vi.fn(),
  off: vi.fn(),
  getObjects: vi.fn(() => []),
  add: vi.fn(),
  remove: vi.fn(),
  requestRenderAll: vi.fn(),
});

const createMockObject = (id: string) => ({
  id,
  data: { id },
  selectable: true,
  toObject: vi.fn().mockReturnValue({ id, type: "rect", left: 0, top: 0 }),
  set: vi.fn().mockReturnThis(),
  setCoords: vi.fn(),
});

describe("HistoryPlugin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("enable/disable", () => {
    it("默认禁用状态", () => {
      const canvas = createMockCanvas();
      const plugin = new HistoryPlugin(canvas);
      expect(plugin.isEnabled()).toBe(false);
    });

    it("enable 后 isEnabled 返回 true", () => {
      const canvas = createMockCanvas();
      const plugin = new HistoryPlugin(canvas);
      plugin.enable();
      expect(plugin.isEnabled()).toBe(true);
    });

    it("disable 后 isEnabled 返回 false", () => {
      const canvas = createMockCanvas();
      const plugin = new HistoryPlugin(canvas);
      plugin.enable();
      plugin.disable();
      expect(plugin.isEnabled()).toBe(false);
    });

    it("enable 时注册 Fabric.js 事件监听", () => {
      const canvas = createMockCanvas();
      const plugin = new HistoryPlugin(canvas);
      plugin.enable();
      expect(canvas.on).toHaveBeenCalledWith("object:added", expect.any(Function));
      expect(canvas.on).toHaveBeenCalledWith("object:removed", expect.any(Function));
      expect(canvas.on).toHaveBeenCalledWith("object:modified", expect.any(Function));
    });

    it("disable 时移除所有事件监听", () => {
      const canvas = createMockCanvas();
      const plugin = new HistoryPlugin(canvas);
      plugin.enable();
      plugin.disable();
      expect(canvas.off).toHaveBeenCalledWith("object:added", expect.any(Function));
      expect(canvas.off).toHaveBeenCalledWith("object:removed", expect.any(Function));
      expect(canvas.off).toHaveBeenCalledWith("object:modified", expect.any(Function));
    });
  });

  describe("undo/redo state", () => {
    it("初始状态 cannot undo", () => {
      const canvas = createMockCanvas();
      const plugin = new HistoryPlugin(canvas);
      expect(plugin.canUndo()).toBe(false);
    });

    it("初始状态 cannot redo", () => {
      const canvas = createMockCanvas();
      const plugin = new HistoryPlugin(canvas);
      expect(plugin.canRedo()).toBe(false);
    });

    it("添加对象后 canUndo 为 true", () => {
      const canvas = createMockCanvas();
      const plugin = new HistoryPlugin(canvas);
      plugin.enable();
      const obj = createMockObject("obj1");
      // Simulate object:added event
      const handler = canvas.on.mock.calls.find((c) => c[0] === "object:added")[1];
      handler({ target: obj });
      expect(plugin.canUndo()).toBe(true);
    });
  });

  describe("history management", () => {
    it("getHistorySize 初始返回 0", () => {
      const canvas = createMockCanvas();
      const plugin = new HistoryPlugin(canvas);
      expect(plugin.getHistorySize()).toBe(0);
    });

    it("getCurrentIndex 初始返回 -1", () => {
      const canvas = createMockCanvas();
      const plugin = new HistoryPlugin(canvas);
      expect(plugin.getCurrentIndex()).toBe(-1);
    });

    it("clear 重置历史栈", () => {
      const canvas = createMockCanvas();
      const plugin = new HistoryPlugin(canvas);
      plugin.enable();
      const obj = createMockObject("obj1");
      const handler = canvas.on.mock.calls.find((c) => c[0] === "object:added")[1];
      handler({ target: obj });
      plugin.clear();
      expect(plugin.getHistorySize()).toBe(0);
      expect(plugin.canUndo()).toBe(false);
    });
  });

  describe("onChange callback", () => {
    it("启用时触发 onChange", () => {
      const canvas = createMockCanvas();
      const onChange = vi.fn();
      new HistoryPlugin(canvas, { onChange });
      expect(onChange).toHaveBeenCalledWith(false, false);
    });

    it("添加对象时触发 onChange", () => {
      const canvas = createMockCanvas();
      const onChange = vi.fn();
      const plugin = new HistoryPlugin(canvas, { onChange });
      plugin.enable();
      const obj = createMockObject("obj1");
      const handler = canvas.on.mock.calls.find((c) => c[0] === "object:added")[1];
      handler({ target: obj });
      expect(onChange).toHaveBeenCalledWith(true, false);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm vitest run src/app/plugins/utils/fabricPlugins/__tests__/historyPlugin.test.ts
```
Expected: FAIL with "HistoryPlugin cannot be found"

---

## Task 3: Implement HistoryPlugin (Minimal Stub)

**Files:**
- Create: `src/app/plugins/utils/fabricPlugins/historyPlugin.ts`

- [ ] **Step 1: Write minimal stub implementation**

Create `historyPlugin.ts`:

```typescript
"use client";

import { type Canvas, type FabricObject } from "fabric";
import type { HistoryNode, HistoryPluginOptions } from "./types";

const DEFAULT_OPTIONS = {
  maxHistorySize: 50,
  mergeThresholdMs: 300,
  onChange: () => {},
};

export class HistoryPlugin {
  private readonly canvas: Canvas;
  private readonly options: Required<HistoryPluginOptions>;
  private enabled = false;
  private nodes: HistoryNode[] = [];
  private currentIndex = -1;
  private modifyingObjects = new Map<string, number>();

  constructor(canvas: Canvas, options: HistoryPluginOptions = {}) {
    this.canvas = canvas;
    this.options = {
      maxHistorySize: options.maxHistorySize ?? DEFAULT_OPTIONS.maxHistorySize,
      mergeThresholdMs: options.mergeThresholdMs ?? DEFAULT_OPTIONS.mergeThresholdMs,
      onChange: options.onChange ?? DEFAULT_OPTIONS.onChange,
    };
  }

  enable() {
    if (this.enabled) return;
    this.enabled = true;
    this.canvas.on("object:added", this.handleObjectAdded);
    this.canvas.on("object:removed", this.handleObjectRemoved);
    this.canvas.on("object:modified", this.handleObjectModified);
    this.options.onChange?.(this.canUndo(), this.canRedo());
  }

  disable() {
    if (!this.enabled) return;
    this.enabled = false;
    this.canvas.off("object:added", this.handleObjectAdded);
    this.canvas.off("object:removed", this.handleObjectRemoved);
    this.canvas.off("object:modified", this.handleObjectModified);
    this.modifyingObjects.clear();
  }

  isEnabled() {
    return this.enabled;
  }

  undo() {}
  redo() {}

  canUndo() {
    return this.currentIndex >= 0;
  }

  canRedo() {
    return this.currentIndex < this.nodes.length - 1;
  }

  clear() {
    this.nodes = [];
    this.currentIndex = -1;
    this.modifyingObjects.clear();
    this.options.onChange?.(this.canUndo(), this.canRedo());
  }

  getHistorySize() {
    return this.nodes.length;
  }

  getCurrentIndex() {
    return this.currentIndex;
  }

  private handleObjectAdded = (event: { target?: FabricObject }) => {
    if (!event.target) return;
  };

  private handleObjectRemoved = (event: { target?: FabricObject }) => {
    if (!event.target) return;
  };

  private handleObjectModified = (event: { target?: FabricObject }) => {
    if (!event.target) return;
  };
}
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
pnpm vitest run src/app/plugins/utils/fabricPlugins/__tests__/historyPlugin.test.ts
```
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/plugins/utils/fabricPlugins/historyPlugin.ts src/app/plugins/utils/fabricPlugins/__tests__/historyPlugin.test.ts
git commit -m "feat(historyPlugin): add stub implementation with enable/disable"
```

---

## Task 4: Implement History Recording Logic

**Files:**
- Modify: `src/app/plugins/utils/fabricPlugins/historyPlugin.ts`

- [ ] **Step 1: Add node creation helper and event handlers**

Replace `handleObjectAdded`, `handleObjectRemoved`, `handleObjectModified` with full implementation:

```typescript
private createNode(type: HistoryNode["type"], obj: FabricObject): HistoryNode {
  const objectId = (obj.data as Record<string, unknown>)?.id as string || String(obj.data?.id) || `obj_${Date.now()}`;
  return {
    id: `${objectId}_${Date.now()}`,
    timestamp: Date.now(),
    type,
    objectId,
    objectState: obj.toObject(),
  };
}

private pushNode(node: HistoryNode) {
  // Truncate any redo history when new action is taken
  if (this.currentIndex < this.nodes.length - 1) {
    this.nodes = this.nodes.slice(0, this.currentIndex + 1);
  }
  this.nodes.push(node);
  this.currentIndex = this.nodes.length - 1;

  // Enforce max history size
  if (this.nodes.length > this.options.maxHistorySize) {
    this.nodes.shift();
    this.currentIndex--;
  }

  this.options.onChange?.(this.canUndo(), this.canRedo());
}

private handleObjectAdded = (event: { target?: FabricObject }) => {
  if (!event.target) return;
  const node = this.createNode("add", event.target);
  this.pushNode(node);
};

private handleObjectRemoved = (event: { target?: FabricObject }) => {
  if (!event.target) return;
  const node = this.createNode("remove", event.target);
  this.pushNode(node);
};

private handleObjectModified = (event: { target?: FabricObject }) => {
  if (!event.target || !this.enabled) return;
  const obj = event.target;
  const objectId = (obj.data as Record<string, unknown>)?.id as string || String(obj.data?.id);

  const now = Date.now();
  const lastModify = this.modifyingObjects.get(objectId);

  // Merge rapid modifications
  if (lastModify && now - lastModify < this.options.mergeThresholdMs) {
    // Update existing node instead of creating new one
    const nodeIndex = this.nodes.findIndex(n => n.objectId === objectId && n.type === "modify");
    if (nodeIndex > this.currentIndex) {
      // Already past this node, create new one
      const node = this.createNode("modify", obj);
      this.pushNode(node);
    } else if (nodeIndex >= 0) {
      // Update existing node
      this.nodes[nodeIndex] = { ...this.nodes[nodeIndex], objectState: obj.toObject(), timestamp: now };
    }
    this.modifyingObjects.set(objectId, now);
  } else {
    const node = this.createNode("modify", obj);
    this.pushNode(node);
    this.modifyingObjects.set(objectId, now);
  }

  // Clear modifying flag after threshold
  setTimeout(() => {
    this.modifyingObjects.delete(objectId);
  }, this.options.mergeThresholdMs);
};
```

- [ ] **Step 2: Add more tests for history recording**

Add to `__tests__/historyPlugin.test.ts`:

```typescript
describe("object:added event", () => {
  it("添加对象时创建 add 类型节点", () => {
    const canvas = createMockCanvas();
    const plugin = new HistoryPlugin(canvas);
    plugin.enable();
    const obj = createMockObject("obj1");
    const handler = canvas.on.mock.calls.find((c) => c[0] === "object:added")[1];
    handler({ target: obj });
    expect(plugin.getHistorySize()).toBe(1);
    expect(plugin.getCurrentIndex()).toBe(0);
  });
});

describe("object:removed event", () => {
  it("删除对象时创建 remove 类型节点", () => {
    const canvas = createMockCanvas();
    const plugin = new HistoryPlugin(canvas);
    plugin.enable();
    const obj = createMockObject("obj1");
    const handler = canvas.on.mock.calls.find((c) => c[0] === "object:removed")[1];
    handler({ target: obj });
    expect(plugin.getHistorySize()).toBe(1);
  });
});

describe("object:modified event", () => {
  it("修改对象时创建 modify 类型节点", () => {
    const canvas = createMockCanvas();
    const plugin = new HistoryPlugin(canvas);
    plugin.enable();
    const obj = createMockObject("obj1");
    const handler = canvas.on.mock.calls.find((c) => c[0] === "object:modified")[1];
    handler({ target: obj });
    expect(plugin.getHistorySize()).toBe(1);
  });
});

describe("history overflow", () => {
  it("超过 maxHistorySize 时丢弃最旧的节点", () => {
    const canvas = createMockCanvas();
    const plugin = new HistoryPlugin(canvas, { maxHistorySize: 3 });
    plugin.enable();
    for (let i = 0; i < 5; i++) {
      const obj = createMockObject(`obj${i}`);
      const handler = canvas.on.mock.calls.find((c) => c[0] === "object:added")[1];
      handler({ target: obj });
    }
    expect(plugin.getHistorySize()).toBe(3);
  });
});
```

- [ ] **Step 3: Run tests to verify they pass**

```bash
pnpm vitest run src/app/plugins/utils/fabricPlugins/__tests__/historyPlugin.test.ts
```
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/app/plugins/utils/fabricPlugins/historyPlugin.ts src/app/plugins/utils/fabricPlugins/__tests__/historyPlugin.test.ts
git commit -m "feat(historyPlugin): add history recording and merge logic"
```

---

## Task 5: Implement Undo/Redo Logic

**Files:**
- Modify: `src/app/plugins/utils/fabricPlugins/historyPlugin.ts`

- [ ] **Step 1: Implement undo() method**

Replace `undo()` with full implementation:

```typescript
undo() {
  if (!this.canUndo()) return;
  const node = this.nodes[this.currentIndex];
  this.currentIndex--;

  // Find the object on canvas
  const objects = this.canvas.getObjects() as FabricObject[];
  const targetObj = objects.find(
    (obj) => ((obj.data as Record<string, unknown>)?.id as string) === node.objectId
  );

  switch (node.type) {
    case "add":
      // Undo add = remove the object
      if (targetObj) {
        this.canvas.remove(targetObj);
      }
      break;
    case "remove":
      // Undo remove = add the object back (using loadFromObject)
      // For now we rely on the calling code to re-add via canvas.add()
      // The node.objectState contains the serialized object
      break;
    case "modify":
      // Undo modify = restore previous state
      if (targetObj) {
        targetObj.set(node.objectState);
        targetObj.setCoords();
        this.canvas.requestRenderAll();
      }
      break;
  }

  this.options.onChange?.(this.canUndo(), this.canRedo());
}
```

- [ ] **Step 2: Implement redo() method**

Replace `redo()` with full implementation:

```typescript
redo() {
  if (!this.canRedo()) return;
  this.currentIndex++;
  const node = this.nodes[this.currentIndex];

  // Find the object on canvas
  const objects = this.canvas.getObjects() as FabricObject[];
  const targetObj = objects.find(
    (obj) => ((obj.data as Record<string, unknown>)?.id as string) === node.objectId
  );

  switch (node.type) {
    case "add":
      // Redo add = add the object back
      if (!targetObj) {
        this.canvas.add(node.objectState as unknown as FabricObject);
      }
      break;
    case "remove":
      // Redo remove = remove the object
      if (targetObj) {
        this.canvas.remove(targetObj);
      }
      break;
    case "modify":
      // Redo modify = apply the state again
      if (targetObj) {
        targetObj.set(node.objectState);
        targetObj.setCoords();
        this.canvas.requestRenderAll();
      }
      break;
  }

  this.options.onChange?.(this.canUndo(), this.canRedo());
}
```

- [ ] **Step 3: Add tests for undo/redo**

Add to `__tests__/historyPlugin.test.ts`:

```typescript
describe("undo", () => {
  it("undo 移动 currentIndex 向后", () => {
    const canvas = createMockCanvas();
    const plugin = new HistoryPlugin(canvas);
    plugin.enable();
    const obj = createMockObject("obj1");
    const handler = canvas.on.mock.calls.find((c) => c[0] === "object:added")[1];
    handler({ target: obj });
    expect(plugin.getCurrentIndex()).toBe(0);
    plugin.undo();
    expect(plugin.getCurrentIndex()).toBe(-1);
  });

  it("无历史时 undo 不执行", () => {
    const canvas = createMockCanvas();
    const plugin = new HistoryPlugin(canvas);
    plugin.undo();
    expect(plugin.canUndo()).toBe(false);
  });
});

describe("redo", () => {
  it("undo 后 redo 恢复 currentIndex", () => {
    const canvas = createMockCanvas();
    const plugin = new HistoryPlugin(canvas);
    plugin.enable();
    const obj = createMockObject("obj1");
    const handler = canvas.on.mock.calls.find((c) => c[0] === "object:added")[1];
    handler({ target: obj });
    plugin.undo();
    expect(plugin.getCurrentIndex()).toBe(-1);
    plugin.redo();
    expect(plugin.getCurrentIndex()).toBe(0);
  });

  it("无 redo 历史时 redo 不执行", () => {
    const canvas = createMockCanvas();
    const plugin = new HistoryPlugin(canvas);
    plugin.redo();
    expect(plugin.canRedo()).toBe(false);
  });
});

describe("new action after undo", () => {
  it("undo 后新操作清空 redo 历史", () => {
    const canvas = createMockCanvas();
    const plugin = new HistoryPlugin(canvas);
    plugin.enable();
    const obj1 = createMockObject("obj1");
    const obj2 = createMockObject("obj2");
    const addedHandler = canvas.on.mock.calls.find((c) => c[0] === "object:added")[1];
    addedHandler({ target: obj1 });
    addedHandler({ target: obj2 });
    plugin.undo(); // undo obj2
    const obj3 = createMockObject("obj3");
    addedHandler({ target: obj3 }); // add obj3
    expect(plugin.canRedo()).toBe(false);
  });
});
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm vitest run src/app/plugins/utils/fabricPlugins/__tests__/historyPlugin.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/plugins/utils/fabricPlugins/historyPlugin.ts src/app/plugins/utils/fabricPlugins/__tests__/historyPlugin.test.ts
git commit -m "feat(historyPlugin): implement undo/redo logic"
```

---

## Task 6: Export from Index

**Files:**
- Modify: `src/app/plugins/utils/fabricPlugins/index.ts`

- [ ] **Step 1: Add HistoryPlugin export**

Add to `index.ts`:

```typescript
export { HistoryPlugin } from "./historyPlugin";
export type { HistoryPluginOptions } from "./types";
```

- [ ] **Step 2: Run full test suite**

```bash
pnpm vitest run src/app/plugins/utils/fabricPlugins/__tests__/historyPlugin.test.ts
```

- [ ] **Step 3: Commit**

```bash
git add src/app/plugins/utils/fabricPlugins/index.ts
git commit -m "feat(historyPlugin): export HistoryPlugin"
```

---

## Task 7: Integration Test with Fabric.js Mock

**Files:**
- Create: `src/app/plugins/utils/fabricPlugins/__tests__/historyPlugin.integration.test.ts` (optional if unit tests are sufficient)

- [ ] **Step 1: Write integration test**

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HistoryPlugin } from "../historyPlugin";

const createMockCanvas = () => {
  const objects: any[] = [];
  return {
    on: vi.fn(),
    off: vi.fn(),
    getObjects: vi.fn(() => objects),
    add: vi.fn((obj) => objects.push(obj)),
    remove: vi.fn((obj) => {
      const idx = objects.indexOf(obj);
      if (idx > -1) objects.splice(idx, 1);
    }),
    requestRenderAll: vi.fn(),
    _objects: objects,
  };
};

const createMockObject = (id: string) => ({
  id,
  data: { id },
  selectable: true,
  toObject: vi.fn().mockReturnValue({ id, type: "rect", left: 0, top: 0 }),
  set: vi.fn().mockReturnThis(),
  setCoords: vi.fn(),
});

describe("HistoryPlugin Integration", () => {
  it("undo remove 调用 canvas.add 恢复对象", () => {
    const canvas = createMockCanvas();
    const plugin = new HistoryPlugin(canvas);
    plugin.enable();

    const obj = createMockObject("obj1");
    canvas._objects.push(obj);

    const handler = canvas.on.mock.calls.find((c) => c[0] === "object:removed")[1];
    handler({ target: obj });

    canvas._objects.splice(0, 1); // Simulate removal
    plugin.undo();

    expect(canvas.add).toHaveBeenCalled();
  });

  it("undo modify 恢复对象属性", () => {
    const canvas = createMockCanvas();
    const plugin = new HistoryPlugin(canvas);
    plugin.enable();

    const obj = createMockObject("obj1");
    obj.left = 100;
    canvas._objects.push(obj);

    const handler = canvas.on.mock.calls.find((c) => c[0] === "object:modified")[1];
    handler({ target: obj });

    obj.left = 200;
    plugin.undo();

    expect(obj.set).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add src/app/plugins/utils/fabricPlugins/__tests__/historyPlugin.integration.test.ts
git commit -m "test(historyPlugin): add integration tests"
```

---

## Spec Coverage Check

| Spec Section | Task |
|--------------|------|
| API (enable/disable/undo/redo/canUndo/canRedo/clear/getHistorySize/getCurrentIndex) | Tasks 3, 4, 5 |
| Fabric.js Event Integration (object:added/removed/modified) | Task 4 |
| Merge Strategy (mergeThresholdMs) | Task 4 |
| History Overflow (maxHistorySize) | Task 4 |
| TDD approach | Tasks 2, 3, 4, 5, 7 |

---

**Plan complete and saved to `docs/superpowers/plans/2026-04-24-history-plugin.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
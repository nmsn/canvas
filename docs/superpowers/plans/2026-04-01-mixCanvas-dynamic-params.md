# mixCanvas 动态参数实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** UI 自动适配绘制函数的参数，支持动态编辑 `width` 等参数

**Architecture:** 通过约定可编辑参数放在 `params` 对象内，从函数签名自动提取参数 key，UI 动态渲染表单并更新 Fabric 对象

**Tech Stack:** React, Fabric.js, TypeScript

---

## 文件概览

- **Modify:** `src/app/mixCanvas/registry.ts` - 新增 `extractParamKeys` 工具函数，更新 `FuncEntry` 接口
- **Modify:** `src/app/mixCanvas/func.tsx` - 更新 `drawHorizontalLine`，让 `width` 从 `params.width` 读取
- **Modify:** `src/app/mixCanvas/page.tsx` - 动态渲染参数编辑表单，支持所有 params 字段
- **Modify:** `src/app/mixCanvas/generator.ts` - 生成代码时包含所有 params

---

## Task 1: 更新 registry.ts - 添加 extractParamKeys 和 FuncEntry.paramKeys

**Files:**
- Modify: `src/app/mixCanvas/registry.ts`

- [ ] **Step 1: 添加 extractParamKeys 工具函数**

在 `FuncRegistry` 类之前添加：

```ts
/**
 * 排除的参数名（内部使用，不暴露给 UI）
 */
const EXCLUDED_PARAMS = ["canvas", "isRender"];

/**
 * 从绘制函数签名中提取可编辑参数 key 列表
 * 通过分析函数体内访问的 params 对象属性来判断
 *
 * 简化实现：扫描函数源码，匹配 params.xxx 模式
 * @param fn - 绘制函数
 * @returns 参数 key 数组
 */
export function extractParamKeys(fn: Function): string[] {
  const fnStr = fn.toString();
  // 匹配 params.xxx 或 params["xxx"] 模式
  const matches = fnStr.matchAll(/params\.(?:(\w+)|\[(['"])(\w+)\2\])/g);
  const keys = new Set<string>();

  for (const match of matches) {
    const key = match[1] || match[3];
    if (key && !EXCLUDED_PARAMS.includes(key)) {
      keys.add(key);
    }
  }

  return Array.from(keys);
}
```

- [ ] **Step 2: 更新 FuncEntry 接口，添加 paramKeys 字段**

修改 `FuncEntry` 接口：

```ts
export interface FuncEntry {
  /** 函数名称（如 drawHorizontalLine） */
  name: string;
  /** 显示名称（如 HorizontalLine） */
  displayName: string;
  /** 执行函数 */
  execute: DrawFunc;
  /** 可编辑参数 key 列表（如 ['x', 'y', 'width']） */
  paramKeys: string[];
}
```

- [ ] **Step 3: 更新 scanModule，自动提取 paramKeys**

修改 `scanModule` 方法：

```ts
scanModule(
  module: Record<string, unknown>,
  filter?: (name: string, fn: unknown) => boolean,
): void {
  for (const [name, fn] of Object.entries(module)) {
    if (typeof fn === "function") {
      if (filter && !filter(name, fn)) continue;

      const displayName = this.generateDisplayName(name);
      const paramKeys = extractParamKeys(fn as Function);

      this.register({
        name,
        displayName,
        execute: fn as DrawFunc,
        paramKeys,
      });
    }
  }
}
```

- [ ] **Step 4: 提交**

```bash
git add src/app/mixCanvas/registry.ts
git commit -m "feat(mixCanvas): add extractParamKeys and paramKeys to FuncEntry"
```

---

## Task 2: 更新 func.tsx - drawHorizontalLine 的 width 从 params 读取

**Files:**
- Modify: `src/app/mixCanvas/func.tsx`

- [ ] **Step 1: 修改 drawHorizontalLine，让 width 从 params 读取**

修改函数实现：

```tsx
export const drawHorizontalLine = (
  canvas: Canvas,
  params: DrawParams,
  isRender = true,
): FabricObject => {
  const width = (params.width as number) ?? 100;  // 从 params 读取 width，默认 100
  const line = new Polyline(
    [
      { x: params.x, y: params.y },
      { x: params.x + width, y: params.y },
    ],
    {
      stroke: "#FF6B6B",
      strokeWidth: 3,
      selectable: true,
      evented: true,
    },
  );
  if (isRender) {
    canvas.add(line);
    canvas.requestRenderAll();
  }
  return line;
};
```

- [ ] **Step 2: 同时更新 drawAll 中的调用，传入 width 参数**

```tsx
const horizontalLine = drawHorizontalLine(canvas, { x, y, width: 100 }, false);
```

- [ ] **Step 3: 提交**

```bash
git add src/app/mixCanvas/func.tsx
git commit -m "feat(func): drawHorizontalLine reads width from params"
```

---

## Task 3: 更新 page.tsx - 动态渲染参数编辑表单

**Files:**
- Modify: `src/app/mixCanvas/page.tsx`

- [ ] **Step 1: 更新 renderSnippetItem，动态渲染所有 params 字段**

找到代码片段列表的渲染部分，修改编辑面板的渲染逻辑：

原来（只显示 x/y）：
```tsx
<div className="text-xs text-gray-500">
  x: {snippet.params.x}, y: {snippet.params.y}
</div>
```

替换为：
```tsx
<div className="text-xs text-gray-500">
  {Object.entries(snippet.params)
    .filter(([key]) => !["isRender"].includes(key))
    .map(([key, value]) => (
      <span key={key} className="mr-2">
        {key}: {String(value)}
      </span>
    ))}
</div>
```

- [ ] **Step 2: 在编辑面板中，动态渲染输入框**

找到编辑面板的 `<textarea` 部分，替换为动态表单：

```tsx
{/* 动态参数编辑表单 */}
<div className="space-y-2">
  {Object.keys(snippet.params)
    .filter((key) => key !== "isRender")
    .map((key) => {
      const value = snippet.params[key];
      const isNumber = typeof value === "number";

      return (
        <div key={key} className="flex items-center gap-2">
          <label className="w-16 text-xs text-gray-600">{key}:</label>
          {isNumber ? (
            <input
              type="number"
              value={value as number}
              onChange={(e) => {
                const newParams = {
                  ...snippet.params,
                  [key]: parseFloat(e.target.value) || 0,
                };
                setSnippets((prev) =>
                  prev.map((s) =>
                    s.id === snippet.id ? { ...s, params: newParams } : s
                  )
                );
              }}
              className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs"
            />
          ) : (
            <input
              type="text"
              value={String(value)}
              onChange={(e) => {
                const newParams = {
                  ...snippet.params,
                  [key]: e.target.value,
                };
                setSnippets((prev) =>
                  prev.map((s) =>
                    s.id === snippet.id ? { ...s, params: newParams } : s
                  )
                );
              }}
              className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs"
            />
          )}
        </div>
      );
    })}
</div>
```

- [ ] **Step 3: 简化 applyEditedParams，让它直接使用更新后的 state**

由于 state 已经在 onChange 时更新，applyEditedParams 可以简化为只关闭编辑模式：

```tsx
const applyEditedParams = useCallback((snippetId: string) => {
  // state 已在 onChange 时更新，此处只需关闭编辑模式
  setEditingSnippetId(null);
  setEditingParamsJson("");
}, []);
```

- [ ] **Step 4: 提交**

```bash
git add src/app/mixCanvas/page.tsx
git commit -m "feat(page): dynamic param form rendering in edit panel"
```

---

## Task 4: 更新 generator.ts - 生成代码时包含所有 params

**Files:**
- Modify: `src/app/mixCanvas/generator.ts`

- [ ] **Step 1: 更新 generateSnippetCode，包含所有 params**

```tsx
export function generateSnippetCode(snippet: CanvasSnippet): string {
  const paramsStr = Object.entries(snippet.params)
    .filter(([key]) => key !== "isRender")
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join(", ");
  return `${snippet.funcName}(canvas, { ${paramsStr} });`;
}
```

- [ ] **Step 2: 更新 generateCompositionCode，offset 计算时保留所有参数**

```tsx
// 计算基准点时保持不变
const baseX = firstSnippet.params.x;
const baseY = firstSnippet.params.y;

// 生成片段配置时保留所有参数
configs.forEach((config, i) => {
  const otherParams = Object.entries(snippets[i].params)
    .filter(([key]) => !["x", "y", "isRender"].includes(key))
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join(", ");

  lines.push(`  // 组件 ${i + 1}: ${config.funcName}`);
  lines.push(`  const obj${i} = ${config.funcName}(canvas, {`);
  lines.push(`    x: x + ${config.offsetX},`);
  lines.push(`    y: y + ${config.offsetY},`);
  if (otherParams) {
    lines.push(`    ${otherParams},`);
  }
  lines.push(`  });`);
  lines.push(`  objects.push(obj${i});`);
  lines.push(``);
});
```

- [ ] **Step 3: 提交**

```bash
git add src/app/mixCanvas/generator.ts
git commit -m "feat(generator): include all params in generated code"
```

---

## Task 5: 验证和测试

**Files:**
- None (手动验证)

- [ ] **Step 1: 启动开发服务器并验证功能**

```bash
cd /Users/nmsn/Studio/canvas && npm run dev
```

- [ ] **Step 2: 验证步骤**

1. 拖拽 `HorizontalLine` 到画布
2. 点击右侧列表中的编辑按钮
3. 确认编辑面板显示 `x`、`y`、`width` 三个输入框
4. 修改 `width` 值，点击应用
5. 确认代码面板生成的代码包含 `width` 参数
6. 拖拽第二个组件，验证组合模式生成的代码也包含 `width`

---

## 自检清单

- [ ] spec 覆盖：所有设计点都有对应 task
- [ ] 无 placeholder：所有代码块都是完整实现
- [ ] 类型一致：FuncEntry.paramKeys 在 registry.ts 和 page.tsx 使用一致

# mixCanvas 动态参数设计

## 背景

当前 `mixCanvas` 的组件系统只支持 `x`/`y` 两个参数编辑，无法满足其他绘制函数的定制需求（如 `drawHorizontalLine` 的 `width`）。

## 目标

UI 自动适配任意绘制函数的参数，无需手动配置。

## 核心约定

所有绘制函数的可编辑参数都放在 `params` 对象内：

```ts
// ✅ 正确方式
export const drawHorizontalLine = (canvas, params, isRender = true) => {
  const width = params.width ?? 100;  // width 从 params 读取
  // ...
};

// ❌ 不推荐
export const drawHorizontalLine = (canvas, params, width = 100, isRender = true) => {
  // width 作为独立参数
};
```

**内部参数**（`canvas`、`isRender` 等）不应放入 `params`。

## 设计

### 1. 参数解析 (`registry.ts`)

新增 `extractParamKeys(func)` 工具函数：

```ts
// 思路：约定所有函数的 params 对象在第二个参数位置
// 从函数签名提取 params 之后的变量声明，作为可编辑参数

function extractParamKeys(fn: Function): string[] {
  // 解析 "function foo(canvas, params, width = 100, isRender = true)"
  // 提取 params 对象内的 key（通过函数体内访问的 params.key 来判断）
  // 简化处理：排除 ['canvas', 'isRender']，其余 key 都视为可编辑参数
}
```

### 2. 动态表单渲染 (`page.tsx`)

根据 `FuncEntry` 的参数 key 列表，在编辑面板中动态渲染输入框：

```tsx
// 根据 key 类型渲染（目前仅支持 number 和 string）
{paramKeys.map((key) => (
  <input
    type={typeof snippet.params[key] === 'number' ? 'number' : 'text'}
    value={snippet.params[key]}
    onChange={(e) => updateParam(key, e.target.value)}
  />
))}
```

### 3. 参数应用 (`page.tsx`)

`applyEditedParams` 需处理所有 `params` 字段，不只是 `x`/`y`。

## 实现步骤

1. `registry.ts` 新增 `extractParamKeys` 函数
2. `registry.ts` 的 `FuncEntry` 新增 `paramKeys: string[]` 字段
3. `func.tsx` 确认所有函数遵循约定
4. `page.tsx` 动态渲染参数编辑表单
5. `applyEditedParams` 支持更新所有参数
6. `generator.ts` 生成代码时包含所有参数

## 约定

- 可编辑参数放在 `params` 内
- 内部参数（`canvas`、`isRender`）不放 `params`
- 约定俗成：排除列表 `['canvas', 'isRender']`
- 默认值由函数初始调用时确定

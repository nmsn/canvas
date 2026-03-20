# Fabric.js 可组合组件系统 - 面试讲解

## 一、项目概述

### 1.1 功能简介

基于 Fabric.js 实现的可视化画布组件系统，支持：

- 拖拽基础组件（线条）到画布绘制
- 实时生成对应的代码
- 将多个组件组合成新的可复用组件
- 组合后的代码可复制到文件中，自动注册为新组件

### 1.2 核心流程

```
拖拽组件 → 画布绘制 → 生成代码 → 组合多个组件 → 生成组合函数 → 复制到文件 → 自动注册
```

---

## 二、技术架构

### 2.1 文件结构

```
mixCanvas/
├── registry.ts    # 函数注册器
├── generator.ts   # 代码生成器
├── func.tsx       # 绘制函数定义
└── page.tsx       # 主页面组件
```

### 2.2 核心类型定义

```typescript
// 统一绘制参数
interface DrawParams {
  x: number;
  y: number;
  [key: string]: unknown; // 支持扩展
}

// 绘制函数签名
type DrawFunc = (canvas: Canvas, params: DrawParams) => FabricObject;

// 画布片段（画布上的每个组件记录）
interface CanvasSnippet {
  id: string;
  funcName: string;
  displayName: string;
  params: DrawParams;
  fabricObject: FabricObject | FabricObject[];
}
```

---

## 三、重难点分析

### 3.1 函数自动注册机制

**难点**：如何让新增的函数自动出现在左侧组件列表？

**解决方案**：反射式扫描 + 约定优于配置

```typescript
class FuncRegistry {
  private functions = new Map<string, FuncEntry>();

  // 扫描模块导出，自动注册符合约定的函数
  scanModule(
    module: Record<string, unknown>,
    filter?: (name: string, fn: unknown) => boolean,
  ): void {
    for (const [name, fn] of Object.entries(module)) {
      if (typeof fn === "function") {
        if (filter && !filter(name, fn)) continue;
        this.register({
          name,
          displayName: this.generateDisplayName(name),
          execute: fn as DrawFunc,
        });
      }
    }
  }
}
```

**设计思想**：

- 使用 Map 存储函数注册表
- 通过命名约定（`draw*` 前缀）自动识别绘制函数
- 无需手动维护函数列表

---

### 3.2 组合函数代码生成

**难点**：如何生成可直接使用的组合函数代码？

**解决方案**：模板化代码生成 + 坐标偏移计算

```typescript
function generateCompositionCode(
  name: string,
  displayName: string,
  snippets: CanvasSnippet[],
): string {
  // 以第一个片段为基准点
  const baseX = snippets[0].params.x;
  const baseY = snippets[0].params.y;

  const configs = snippets.map((s) => ({
    funcName: s.funcName,
    offsetX: s.params.x - baseX, // 计算相对偏移
    offsetY: s.params.y - baseY,
  }));

  // 生成标准格式的函数代码
  return `
export const ${name} = (canvas: Canvas, params: DrawParams) => {
  const { x, y } = params;
  const objects: FabricObject[] = [];

  ${configs
    .map(
      (c, i) => `
  const obj${i} = ${c.funcName}(canvas, {
    x: x + ${c.offsetX},
    y: y + ${c.offsetY},
  });
  objects.push(obj${i});`,
    )
    .join("\n")}

  return new Group(objects, { left: x, top: y, selectable: true });
};`;
}
```

**关键点**：

- 坐标转换：绝对坐标 → 相对偏移量
- 生成的代码遵循统一签名，可被再次注册
- 支持无限层级组合

---

### 3.3 事件冲突处理

**难点**：组合模式下 checkbox 勾选与父元素 onClick 冲突

**问题**：点击 checkbox 时，onChange 和 onClick 都触发 toggleSnippetSelection，导致选中又立即取消

**解决方案**：阻止事件冒泡

```tsx
<input
  type="checkbox"
  checked={selectedForCompose.includes(snippet.id)}
  onChange={(e) => {
    e.stopPropagation(); // 阻止冒泡到父元素
    toggleSnippetSelection(snippet.id);
  }}
  onClick={(e) => e.stopPropagation()} // 双重保险
  className="rounded border-gray-300"
/>
```

---

### 3.4 状态同步问题

**难点**：画布上拖拽对象后，如何同步更新参数？

**解决方案**：Fabric.js 事件监听

```typescript
useEffect(() => {
  const canvas = new Canvas(canvasRef.current, { ... });

  const handleObjectModified = (e: { target?: FabricObject }) => {
    if (e.target) {
      updateSnippetParams(e.target);  // 同步更新 React 状态
    }
  };

  canvas.on('object:modified', handleObjectModified);

  return () => {
    canvas.off('object:modified', handleObjectModified);
  };
}, [updateSnippetParams]);
```

---

## 四、设计模式应用

### 4.1 注册器模式（Registry Pattern）

- 集中管理所有绘制函数
- 支持动态注册和查询
- 解耦函数定义与使用

### 4.2 策略模式（Strategy Pattern）

- 每个绘制函数是一个策略
- 统一接口，可互换使用

### 4.3 组合模式（Composite Pattern）

- 组合函数可包含基础函数或其他组合函数
- 形成树形结构的组件层级

### 4.4 模板方法模式（Template Method）

- 代码生成遵循固定模板
- 具体内容由片段配置决定

---

## 五、性能优化点

### 5.1 useCallback 优化

```typescript
const executeDrawFunction = useCallback(
  (funcEntry: FuncEntry, params: DrawParams) => { ... },
  []  // 空依赖，函数引用稳定
);
```

### 5.2 条件渲染

- 组合模式 UI 仅在 isComposing 时渲染
- 代码面板仅在有片段时显示

---

## 六、扩展性设计

### 6.1 支持新组件类型

只需在 func.tsx 中添加新函数：

```typescript
export const drawCircle = (canvas: Canvas, params: DrawParams) => {
  const circle = new Circle({ radius: 50, ...params });
  canvas.add(circle);
  return circle;
};
```

### 6.2 支持更多参数

DrawParams 支持扩展：

```typescript
interface CircleParams extends DrawParams {
  radius?: number;
  fill?: string;
}
```

---

## 七、面试常见问题

### Q1: 为什么选择 Fabric.js？

A:

- 成熟的 Canvas 操作库，API 丰富
- 支持对象选择、拖拽、变换
- 事件系统完善
- 支持序列化/反序列化

### Q2: 如何保证生成代码的正确性？

A:

- 统一函数签名约束
- 类型系统（TypeScript）静态检查
- 坐标偏移计算基于第一个片段为基准

### Q3: 组合函数支持嵌套吗？

A:
支持。组合函数注册后与基础函数无差异，可被其他组合函数引用。

### Q4: 如何处理画布性能？

A:

- 使用 requestRenderAll 批量渲染
- 组合后使用 Group 减少渲染对象数量
- useCallback 避免不必要的重渲染

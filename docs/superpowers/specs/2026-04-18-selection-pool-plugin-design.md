# SelectionPoolPlugin — 设计规格

---

## 一、概述

**插件名称**: `SelectionPoolPlugin`
**核心功能**: 点击选择元素到选中池，支持数量限制，自动淘汰最早选中的元素
**实现方式**: 完全接管 Fabric 点击交互，禁用原生选中框
**特效**: 默认边框高亮，支持自定义回调

---

## 二、核心 API

### 构造函数与选项

```typescript
interface SelectionPoolPluginOptions {
  maxSelectCount?: number;           // 最大选中个数，默认 2
  selectedStroke?: string;           // 选中边框颜色，默认 '#6366f1'
  selectedStrokeWidth?: number;      // 选中边框宽度，默认 2
  selectedShadow?: string;           // 选中阴影，默认 '0 0 8px rgba(99,102,241,0.6)'
  onSelectionChange?: (objects: PluginCanvasObject[]) => void;  // 选中变化回调
}

const plugin = new SelectionPoolPlugin(canvas, options);
```

### 生命周期

```typescript
plugin.enable();    // 开启插件
plugin.disable();   // 关闭插件
plugin.isEnabled();
```

### 选中池操作

```typescript
plugin.getSelectedObjects(): PluginCanvasObject[]  // 获取当前选中池
plugin.select(object: PluginCanvasObject);         // 手动选中
plugin.deselect(object: PluginCanvasObject);     // 手动取消选中
plugin.clearSelection();                          // 清空选中池
```

---

## 三、数据结构

```typescript
private selectionPool: PluginCanvasObject[] = [];  // 按加入顺序排列
private originalStates: Map<PluginCanvasObject, {
  stroke?: string | number;
  strokeWidth?: number;
  shadow?: import("fabric").Shadow | string | null;
}> = new Map();
private enabled = false;
```

---

## 四、点击交互流程

```
点击元素
    ↓
检查元素是否在池中
    ├── 已在池中 → deselect() → 移除，取消特效，恢复原始状态
    └── 不在池中
            ├── 池未满 → select() → 加入，添加特效
            └── 池已满 → deselect(池中第一个) → select() → 淘汰老的，新加入
```

---

## 五、特效实现

### 默认特效（边框高亮）

```typescript
// 保存原始状态
originalStates.set(obj, {
  stroke: obj.stroke,
  strokeWidth: obj.strokeWidth,
  shadow: obj.shadow,
});

// 应用选中特效
obj.set({
  stroke: options.selectedStroke,
  strokeWidth: options.selectedStrokeWidth,
  strokeRect: new Shadow({ ... }),
});
```

### 自定义特效

通过 `onSelectionChange` 回调：

```typescript
const plugin = new SelectionPoolPlugin(canvas, {
  onSelectionChange: (objects) => {
    // 自定义特效逻辑
    objects.forEach((obj, i) => {
      obj.set({ opacity: 0.5 + i * 0.2 });
    });
  }
});
```

---

## 六、与 ConnectionPlugin 联动

SelectionPoolPlugin 暴露选中池，外部自行调用 ConnectionPlugin：

```typescript
// 示例：选中变化时自动连接前两个
plugin.onSelectionChange = (objects) => {
  if (objects.length >= 2) {
    connectionPlugin.connect(objects[0], objects[1]);
  }
};
```

---

## 七、禁用 Fabric 原生选择

插件启用时：
- `canvas.selection = false`
- 所有对象的 `selectable = false`
- 对象不响应原生点击选中

插件禁用时：
- 恢复 `canvas.selection = true`
- 恢复所有对象的 `selectable = true`

---

## 八、类型定义

```typescript
// types.ts 新增

export interface SelectionPoolPluginOptions {
  maxSelectCount?: number;
  selectedStroke?: string;
  selectedStrokeWidth?: number;
  selectedShadow?: string;
  onSelectionChange?: (objects: PluginCanvasObject[]) => void;
}
```

---

## 九、文件结构

```
plugins/utils/fabricPlugins/
  ├── selectionPoolPlugin.ts   # 新增 SelectionPoolPlugin 实现
  ├── types.ts                # 新增 SelectionPoolPluginOptions 类型
  ├── index.ts                # 导出 SelectionPoolPlugin
  └── ...
```

---

## 十、实现步骤（初稿）

1. 添加类型定义
2. 创建 SelectionPoolPlugin 类骨架
3. 实现 enable/disable（接管/恢复 Fabric 原生选择）
4. 实现 select/deselect 特效
5. 实现点击事件处理（池管理逻辑）
6. 实现 getSelectedObjects / clearSelection
7. 实现 onSelectionChange 回调
8. 导出插件
9. 集成到 demo 页面
10. 单元测试

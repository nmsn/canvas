# Fabric.js 插件系统 — 项目重难点总结

> 基于 Fabric.js 画布引擎实现的两个核心插件：**DimensionPlugin（尺寸标注）** 和 **SortableSnapPlugin（拖拽排序吸附）**。

---

## 一、整体架构设计

### 1.1 插件化架构思路

两个插件共享同一套 `Canvas` 实例，但职责完全正交：

- **DimensionPlugin** — 纯视觉层，不修改画布对象，只在 `upperCanvas` 上做 overlay 绘制
- **SortableSnapPlugin** — 交互层，接管拖拽事件流，控制对象的位置和排列

采用 **统一的生命周期接口**（`enable / disable / isEnabled`），使插件可独立开关、互不干扰。

### 1.2 关键类型抽象

```
PluginCanvasObject  ── FabricObject 的业务扩展，携带 data 标记和布局元信息
RowState            ── 一行的逻辑状态：y 坐标 + 对象有序列表
PeerSlot / PeerTarget ── 同行元素的"理想位置" vs "动画目标位置"
LayoutSlot          ── 布局计算的中间产物（peer 或 placeholder）
```

核心思路：**把 Canvas 上的离散对象抽象为"行布局"模型**，用行级数据结构驱动排列逻辑。

---

## 二、DimensionPlugin — 尺寸标注插件

### 2.1 设计思路

| 层次     | 说明                                                                   |
| -------- | ---------------------------------------------------------------------- |
| 渲染时机 | 挂载到 `after:render` 事件，每次 Fabric 重绘后自动触发                 |
| 绘制层   | 使用 `canvas.getTopContext()` 获取上层 canvas 的原生 2D context        |
| 数据源   | 通过 `getBusinessObjects()` 过滤出业务对象，排除网格、占位符等辅助元素 |

### 2.2 重点

#### （1）双层 Canvas 渲染模型

Fabric.js 维护两层 canvas：

- **lowerCanvas** — 对象本体渲染层
- **upperCanvas** — 选择框、hover 高亮等交互覆盖层

DimensionPlugin 的标注绘制在 upperCanvas 上完成，**不污染主画布的对象树**。这意味着：

- 标注不会被 `canvas.getObjects()` 返回
- 不会影响序列化/导出
- 开关插件零副作用

#### （2）Zoom 适配

所有绘制参数（线宽、字号、偏移量、虚线间距）都除以 `zoom`：

```ts
const lineWidth = 1 / zoom;
const fontSize = this.options.fontSize / zoom;
const offset = this.options.offset / zoom;
```

保证在任意缩放下标注的**视觉尺寸恒定**，而非随画布等比缩放。

#### （3）Viewport Transform 同步

```ts
context.save();
if (viewportTransform) {
  context.transform(vt[0], vt[1], vt[2], vt[3], vt[4], vt[5]);
}
// ... 绘制
context.restore();
```

标注需要跟随画布平移/缩放一起动，直接应用 Fabric 的 `viewportTransform` 矩阵即可。

#### （4）Gap 标注的重叠检测

相邻对象之间的间距标注需要判断两者在垂直方向是否有重叠：

```ts
const verticalOverlap =
  Math.min(current.bottom, next.bottom) - Math.max(current.top, next.top);
if (verticalOverlap <= 0) continue;
```

只对真正"同行"的对象标注间距，避免跨行对象产生无意义的连线。

### 2.3 难点

**难点 1：Overlay 清除的精确性**

`clearOverlay()` 需要先 `setTransform(1,0,0,1,0,0)` 重置矩阵再 `clearRect`，否则在有 viewport transform 的情况下，`clearRect` 的坐标系和实际像素不对齐，导致清除不干净（残留鬼影）。

**难点 2：坐标体系的三套转换**

项目中同时存在三套坐标：

| 坐标系       | 含义                         | 获取方式            |
| ------------ | ---------------------------- | ------------------- |
| 对象本地坐标 | `object.left/top`            | 直接属性            |
| 场景坐标     | 考虑 group 嵌套后的坐标      | `getBoundingRect()` |
| 视口坐标     | 场景坐标 × viewportTransform | 手动计算            |

`toSceneBounds()` 统一封装了对象→场景的转换，是整个插件系统的基石函数。

---

## 三、SortableSnapPlugin — 拖拽排序吸附插件

### 3.1 设计思路

核心交互流程（类比 Trello / macOS Dock 的排序体验）：

```
鼠标按下 → startDrag() → 锁定行、创建占位符
    ↓
鼠标移动 → onObjectMoving()
    ├─ 纵向锁定：拖拽对象的 top 被强制锁定到行的 y 坐标
    ├─ 插入点计算：根据 dragCenterX 与各 peer 的 centerX 比较
    └─ 实时布局：peer 元素通过动画平移到新位置，placeholder 跟随
    ↓
鼠标释放 → onMouseUp()
    ├─ 拖拽对象动画吸附到 placeholder 位置
    ├─ 更新 row.objects 顺序
    └─ 清理拖拽状态
```

### 3.2 重点

#### （1）视觉坐标 vs 逻辑坐标的解耦

Fabric 的 `left/top` 是对象的"锚点"坐标，但视觉位置受 `originX, originY, strokeWidth, shadow` 等影响。拖拽时需要：

```ts
// 拖拽过程中：锁定视觉位置到行的 y 坐标
const lockedPosition = getTargetPositionForVisualPlacement(
  target,
  getVisualLeft(target), // 保持视觉 left 不变
  this.dragRow.y, // 强制视觉 top = 行高
);
target.set({ left: lockedPosition.left, top: lockedPosition.top });
```

`getTargetPositionForVisualPlacement()` 做的是一次**逆向推算**：已知期望的视觉位置，反推对象的 `left/top` 应该设成多少。

#### （2）居中布局的光标计算

所有元素排列在画布水平居中位置，起始 x 由总宽度反推：

```ts
computeCenteredStartX(objects) {
  const totalWidth = widths.reduce((sum, w, i) => sum + w + (i > 0 ? gap : 0), 0)
  return (canvasWidth - totalWidth) / 2
}
```

拖拽时 peer 元素的"理想位置"（`idealX`）也是基于这个光标逻辑计算的，保证动画目标位置和最终释放位置一致。

#### （3）插入点算法

```ts
computeInsertIndex(dragLeft, dragWidth, peers) {
  const dragCenterX = dragLeft + dragWidth / 2
  for (const [index, peer] of peers.entries()) {
    const peerCenterX = peer.idealX + getLayoutWidth(peer.obj) / 2
    if (dragCenterX < peerCenterX) return index
  }
  return peers.length  // 插到最后
}
```

用**中心点比较法**而非边界比较，实现更自然的"过半切换"手感。通过 `currentInsertIndex` 做去重，避免每帧都触发布局重算。

#### （4）动画竞态管理

拖拽过程中 peer 元素在不断做平移动画，如果拖拽速度很快，可能上一个动画还没结束就被打断。通过 `WeakMap<PluginCanvasObject, Record<string, { abort }>>` 管理每个对象的活跃动画：

```ts
cancelAnimationMap(this.peerAnimations.get(obj))  // 先取消旧动画
const animations = obj.animate(...)                 // 再启动新动画
this.peerAnimations.set(obj, animations)
```

用 `WeakMap` 而非 `Map`，对象被移除时自动 GC，不会内存泄漏。

### 3.3 难点

**难点 1：Fabric 事件流与插件接管的冲突**

Fabric 原生的 `object:moving` 事件中，对象已经跟随鼠标移动了一帧。插件需要：

1. 在这一帧内把对象"拉回"到锁定的行高
2. 同时让其他 peer 元素做出动画响应
3. 不能触发额外的 `object:moving` 导致递归

解法：插件内部维护 `dragging` 状态标记，`onObjectMoving` 入口处判断 `!this.dragging || this.dragTarget !== target` 再初始化拖拽，避免重复进入。

**难点 2：Placeholder 的层级管理**

Placeholder 需要显示在业务对象下方、网格线上方：

```ts
this.canvas.sendObjectToBack(placeholder);
// 再把所有网格线推到最底层
this.canvas
  .getObjects()
  .filter((o) => o.data?.isGrid)
  .forEach((grid) => this.canvas.sendObjectToBack(grid));
```

同时 placeholder 带有 `selectable: false, evented: false`，防止它干扰拖拽事件的 target 识别。

**难点 3：异步动画与同步状态的对齐**

`reflowRow()` 支持 `animated` 和非动画两种模式。非动画模式下直接 `object.set()` + `setCoords()` 同步生效；动画模式下需要在 `onComplete` 回调中才调用 `setCoords()`，否则中间帧的坐标计算会出错。

释放时的吸附动画（`onMouseUp`）需要在 `onComplete` 中更新行顺序：

```ts
onComplete: () => {
  target.setCoords();
  this.canvas.requestRenderAll();
};
// 动画启动后立即更新 row.objects 顺序（不需要等动画完成）
row.objects.splice(insertIndex, 0, target);
```

行顺序的更新和动画是并行的——先改数据再播动画，保证下一次 `reflowRow` 时数据已经正确。

---

## 四、共享层设计

### 4.1 业务对象过滤

```ts
function isBusinessObject(object): object is PluginCanvasObject {
  return !data?.isGrid && !data?.isPlaceholder && !data?.isDimAnnotation;
}
```

通过 `data` 上的标记位区分对象类型，避免用 `instanceof` 或类名做类型判断，**使数据标记和业务逻辑解耦**。网格线、占位符、标注辅助对象都不参与插件逻辑。

### 4.2 Layout 尺寸的三级降级策略

```ts
function getLayoutWidth(object) {
  // 1. 优先用 getBoundingRect()（最准确，考虑了旋转、缩放、group 嵌套）
  const boundsWidth = toSceneBounds(object).width;
  if (boundsWidth > 0) return boundsWidth;

  // 2. 降级到 getScaledWidth()（考虑了缩放，但不考虑旋转）
  const renderedWidth = object.getScaledWidth();
  if (renderedWidth > 0) return renderedWidth;

  // 3. 最后用 data.layoutWidth * scaleX（兜底，适用于尚未渲染的对象）
  return (object.data?.layoutWidth ?? object.width ?? 0) * getScaleX(object);
}
```

这个降级策略解决了**对象尚未首次渲染时无法获取边界框**的问题（Fabric 在首次 `renderAll` 前 `getBoundingRect()` 返回 0）。

### 4.3 插件间互不干扰

- DimensionPlugin 只读取对象位置，不做任何修改
- SortableSnapPlugin 修改对象位置，但不依赖 DimensionPlugin 的输出
- 两者通过 `canvas.on/off` 注册/注销各自的事件监听，开关互不影响

---

## 五、面试表达要点

### 一句话概括

> 在 Fabric.js 画布上实现了两个正交插件：一个用原生 Canvas API 做 zoom-aware 的尺寸标注 overlay，一个实现了类 Trello 的拖拽排序吸附交互。

### 可展开讲的亮点

1. **双层 Canvas 渲染** — overlay 绘制不污染对象树，开关零副作用
2. **视觉坐标逆向推算** — 解决 Fabric 锚点坐标和视觉位置不一致的问题
3. **动画竞态管理** — WeakMap + abort 模式避免动画叠加和内存泄漏
4. **三级降级的尺寸获取** — 兼容未渲染对象、缩放对象、group 嵌套对象
5. **居中布局 + 插入排序** — O(n) 时间完成实时布局重算，centerX 比较保证自然手感

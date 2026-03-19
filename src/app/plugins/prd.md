# Fabric.js 插件需求文档

---

## 背景

基于 Fabric.js（v6/v7）开发两个画布交互插件，插件以类的形式封装，通过 `canvas` 实例注入，支持 `enable()` / `disable()` 开关，互不干扰。

---

## 插件一：尺寸位置标注插件 `DimensionPlugin`

### 功能描述

开启后，自动标注画布中所有元素的尺寸与位置信息，关闭后标注消失，不影响业务对象。

### 标注内容

- 元素**宽度**（顶部水平测量线 + 数值）
- 元素**高度**（右侧垂直测量线 + 数值）
- 元素左上角的 **(x, y) 坐标**（文字标注）

### 技术方案

- 监听 Fabric 的 `after:render` 事件，在每次重绘后触发
- 使用原生 Canvas 2D API 在 `upperCanvas` 上叠加绘制标注线和文字
- 不向画布添加任何 Fabric 对象，不影响业务图层
- 标注线宽随画布缩放自适应，保持视觉上始终为 1px

### 配置项

| 参数 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `lineColor` | string | `#1677ff` | 标注线颜色 |
| `textColor` | string | `#1677ff` | 文字颜色 |
| `fontSize` | number | `11` | 标注文字大小 |
| `offset` | number | `16` | 标注线距元素的间距（px） |
| `tickLength` | number | `4` | 两端刻度线长度（px） |

### 使用方式
```typescript
const dimPlugin = new DimensionPlugin(canvas, {
  lineColor: '#1677ff',
  offset: 20,
});

dimPlugin.enable();   // 开启
dimPlugin.disable();  // 关闭
```

---

## 插件二：横向换位吸附插件 `SortableSnapPlugin`

### 功能描述

针对**横向排列的多个元素**，实现拖动换位、占位预览、自动吸附三个核心交互。

### 行的定义

- 元素有**明确的行概念**，初始化时按 `top` 坐标聚类，`top` 差值在容差范围内的元素视为同一行
- 行结构在 `enable()` 时一次性初始化，新增元素后需调用 `initRows()` 更新

### 交互行为

#### 1. 拖动锁轴

- 拖动元素时，**纵向位置（top）强制锁定**为所在行的基准 y 坐标
- 元素只能在行内横向滑动，不可跨行

#### 2. 插入排序预览

- 拖动过程中，实时计算被拖元素的**插入位置**
- 插入位置判断依据：被拖元素中心点与同行其他元素中心点的 x 坐标比较
- 同行其他元素**动画平移让出空间**，动画使用 `easeOutCubic` 缓动
- 在预计放置位置显示**半透明虚线占位框**，占位框随插入位置实时移动

#### 3. 释放吸附

- 鼠标释放后，被拖元素**自动吸附**到占位框所在位置
- 吸附过程为平滑动画（横向 + 纵向同时进行）
- 吸附完成后更新行内元素的排列顺序

### 技术方案

- 监听 `object:moving` 事件处理拖动逻辑
- 监听 `mouse:up` 事件处理释放和吸附
- `peerSlots`（同行其他元素的理想坐标）在拖动开始时一次性计算，整个拖动过程不变，避免累计误差
- 每次重新计算布局前取消上一次未完成的动画，防止动画叠加
- 占位框通过 `Fabric.Rect` 实现，设置 `selectable: false` 和 `evented: false`，带淡入淡出动画

### 配置项

| 参数 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `rowTolerance` | number | `20` | 同行判断的 top 坐标容差（px） |
| `gap` | number | `12` | 元素间距（px） |
| `animDuration` | number | `180` | 动画时长（ms） |
| `placeholderColor` | string | `rgba(22,119,255,0.12)` | 占位框填充色 |
| `placeholderStroke` | string | `rgba(22,119,255,0.4)` | 占位框描边色 |

### 使用方式
```typescript
const sortPlugin = new SortableSnapPlugin(canvas, {
  rowTolerance: 20,
  gap: 12,
  animDuration: 180,
});

sortPlugin.enable();    // 开启（同时初始化行结构）
sortPlugin.disable();   // 关闭
sortPlugin.initRows();  // 手动刷新行结构（新增元素后调用）
```

---

## 约束与边界条件

| 约束 | 说明 |
|---|---|
| 跨行拖动 | 暂不支持，元素只能在所在行内换位 |
| 排序方式 | 插入排序，非严格换位 |
| 行识别时机 | 初始化时固定，不随拖动实时重算 |
| 占位框层级 | 始终在被拖元素下方，不遮挡交互 |
| 网格线排除 | 插件自动过滤 `data.isGrid` 标记的对象 |

---

## 整体架构
```
PluginSystem
  ├── DimensionPlugin
  │     ├── enable() / disable()
  │     ├── 监听 after:render
  │     └── 在 upperCanvas ctx 绘制标注
  │
  └── SortableSnapPlugin
        ├── enable() / disable()
        ├── initRows()                  初始化行结构
        ├── 监听 object:moving
        │     ├── 锁定 top（只允许横向移动）
        │     ├── computePeerSlots()    计算同行元素初始槽位
        │     ├── computeInsertIndex()  计算当前插入位置
        │     ├── computeLayout()       计算各元素目标位置
        │     ├── applyLayout()         执行动画让位 + 移动占位框
        │     └── createPlaceholder()  创建半透明占位框
        └── 监听 mouse:up
              ├── computeLayout()       计算最终吸附坐标
              ├── animateTo()           平滑吸附动画
              ├── updateRowOrder()      更新行内元素顺序
              └── removePlaceholder()  移除占位框
```

---

## 两个插件同时使用
```typescript
import * as fabric from 'fabric';
import { DimensionPlugin }    from './plugins/DimensionPlugin';
import { SortableSnapPlugin } from './plugins/SortableSnapPlugin';

const canvas = new fabric.Canvas('myCanvas');

// 加载业务元素...
canvas.add(...elements);

// 初始化插件
const dimPlugin  = new DimensionPlugin(canvas);
const sortPlugin = new SortableSnapPlugin(canvas, { gap: 14 });

// 按需开启
dimPlugin.enable();
sortPlugin.enable();
```
# Fabric.js 连接线插件 — 设计规格

---

## 一、概述

**插件名称**: `ConnectionPlugin`
**核心功能**: 在两个 Fabric 元素之间绘制贝塞尔曲线连接线
**实现方式**: Overlay 纯绘制（不作为 Fabric 对象，不污染画布对象树）
**交互方式**: 声明式配置（代码中调用 `connect()` 方法）

---

## 二、核心 API

### 构造函数与生命周期

```typescript
const connPlugin = new ConnectionPlugin(canvas, {
  lineColor: '#64748b',
  lineWidth: 1.5,
  curvature: 0.5,       // 曲率系数 0~1
  arrowSize: 0,        // 箭头尺寸（暂无箭头，预留）
});

connPlugin.enable();   // 开启：绘制所有连接
connPlugin.disable();  // 关闭：清除所有连接
connPlugin.isEnabled();
```

### 添加连接

```typescript
// 单条连接
connPlugin.connect(sourceObject, targetObject, options?);

// 连接选项（可选）
interface ConnectionOptions {
  lineColor?: string;   // 覆盖全局颜色
  lineWidth?: number;   // 覆盖全局线宽
  curvature?: number;   // 覆盖全局曲率
}
```

### 批量管理

```typescript
// 批量设置连接
connPlugin.setConnections([
  { from: objA, to: objB },
  { from: objB, to: objC },
  { from: objA, to: objC },
]);

// 清除所有连接
connPlugin.clear();

// 删除特定连接（通过源+目标匹配）
connPlugin.disconnect(sourceObject, targetObject);
```

### 获取状态

```typescript
// 获取当前所有连接
connPlugin.getConnections(): Connection[]

// Connection 类型
interface Connection {
  from: PluginCanvasObject;
  to: PluginCanvasObject;
  options?: ConnectionOptions;
}
```

---

## 三、自动控制点算法

### 锚点选择规则

对于每对连接，选择源和目标各自的边缘中点作为端点：

1. 计算源元素的包围盒中心 (srcCx, srcCy)
2. 计算目标元素的包围盒中心 (tgtCx, tgtCy)
3. 根据相对位置选择锚点所在边：
   - `tgtCx > srcCx` → 源右边缘中点、目标左边缘中点（水平关系）
   - `tgtCx < srcCx` → 源左边缘中点、目标右边缘中点（水平关系）
   - `tgtCy > srcCy` → 源下边缘中点、目标上边缘中点（垂直关系）
   - `tgtCy < srcCy` → 源上边缘中点、目标下边缘中点（垂直关系）

### 控制点计算

**水平 S 弯**（源在左/右）：

```
controlPointOffset = distanceX * curvature

cp1 = (startX + controlPointOffset, startY)
cp2 = (endX - controlPointOffset, endY)
```

**垂直 C 弯**（源在上/下）：

```
controlPointOffset = distanceY * curvature

cp1 = (startX, startY + controlPointOffset)
cp2 = (endX, endY - controlPointOffset)
```

`curvature` 默认 0.5，取值范围 0~1。0 时退化为直线，1 时弯曲最大。

---

## 四、渲染机制

### 渲染时机

- 挂载到 `after:render` 事件（与 `DimensionPlugin` 一致）
- 每次画布重绘时重新绘制所有连接线
- 支持动态追踪源/目标元素位置变化（元素移动后自动更新）

### 渲染层

- 使用 `canvas.getTopContext()` 绘制在 upperCanvas
- 应用 `viewportTransform` 保证 zoom/pan 同步
- 绘制前先清除上一次的内容

### Zoom 适配

```typescript
const zoom = this.canvas.getZoom() || 1;
context.lineWidth = this.options.lineWidth / zoom;
```

---

## 五、点击创建模式（扩展功能）

在声明式配置功能稳定后，扩展交互式创建：

### 交互流程

1. 用户点击"添加连接"按钮或快捷键，进入连接创建模式
2. 点击源元素 → 高亮显示，状态切换为"等待目标"
3. 点击目标元素 → 调用 `connect(source, target)`，退出创建模式
4. ESC 键取消创建，返回正常状态

### 状态管理

```typescript
private clickMode = false;
private clickSource: PluginCanvasObject | null = null;

enum ClickState {
  Idle,       // 正常状态
  WaitingTarget, // 已选源，等待目标
}
```

### 视觉反馈

- 源元素选中时：显示临时连接线跟随鼠标
- 等待目标时：鼠标变为 crosshair
- 取消时：清除临时状态

---

## 六、类型定义

```typescript
// types.ts 新增

export interface ConnectionPluginOptions {
  lineColor?: string;
  lineWidth?: number;
  curvature?: number;
  arrowSize?: number;      // 预留
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

---

## 七、文件结构

```
plugins/utils/fabricPlugins/
  ├── connectionPlugin.ts   # ConnectionPlugin 实现
  ├── types.ts              # 新增 ConnectionPluginOptions, Connection, ConnectionOptions
  ├── index.ts              # 导出 ConnectionPlugin
  ├── dimensionPlugin.ts
  ├── sortableSnapPlugin.ts
  └── ...
```

---

## 八、与现有插件的关系

- **独立性**: `ConnectionPlugin` 独立于 `DimensionPlugin` 和 `SortableSnapPlugin`，可单独使用
- **对象过滤**: 连接线不参与 `SortableSnapPlugin` 的行排序逻辑（通过 `isConnection` data 标记排除）
- **坐标获取**: 复用现有的 `toSceneBounds()` 工具函数

---

## 九、约束与边界

| 约束 | 说明 |
|------|------|
| 元素必须存在于画布 | 断开连接时若对象已删除，忽略 |
| 禁止自连接 | `connect(A, A)` 不创建任何效果 |
| 性能 | 连接数过多（>100）时可能有性能影响，待优化 |

---

## 十、实现步骤（初稿）

1. 实现 `ConnectionPlugin` 类，基本 `connect()` 方法
2. 实现自动控制点算法
3. 实现 `after:render` 渲染
4. 实现 `setConnections()` / `clear()` / `disconnect()`
5. 实现 `enable/disable` 生命周期
6. 单元测试覆盖核心算法
7. 集成到 demo 页面
8. **（可选）** 实现点击创建模式

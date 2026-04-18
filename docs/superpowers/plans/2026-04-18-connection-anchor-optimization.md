# ConnectionPlugin 锚点优化实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development

**Goal:** 优化 computeBezierPoints 方法，改用距离计算选择最近锚点

**Architecture:** 替换 4 分支 if-else 为距离计算循环

---

## Task 1: 实现锚点距离计算

**Files:**
- Modify: `src/app/plugins/utils/fabricPlugins/connectionPlugin.ts:107-179`

**Steps:**

- [ ] **Step 1: 替换锚点选择逻辑**

在 `computeBezierPoints` 方法中，将：

```typescript
if (tgtCx > srcCx) {
  // 源在左，目标在右 → 从源右边缘中点
  startX = fromBounds.left + fromBounds.width;
  startY = fromBounds.top + fromBounds.height / 2;
  // ...
} else if (tgtCx < srcCx) {
  // ...
} // ...
```

替换为：

```typescript
const srcCx = fromBounds.left + fromBounds.width / 2;
const srcCy = fromBounds.top + fromBounds.height / 2;
const tgtCx = toBounds.left + toBounds.width / 2;
const tgtCy = toBounds.top + toBounds.height / 2;

// 源元素的 4 个锚点
const anchors = [
  { name: 'top',    x: srcCx, y: fromBounds.top },
  { name: 'bottom', x: srcCx, y: fromBounds.top + fromBounds.height },
  { name: 'left',   x: fromBounds.left, y: srcCy },
  { name: 'right',  x: fromBounds.left + fromBounds.width, y: srcCy },
];

// 选择到目标中心最近的锚点
let bestAnchor = anchors[0];
let bestDistance = Infinity;
for (const anchor of anchors) {
  const dist = Math.sqrt((anchor.x - tgtCx) ** 2 + (anchor.y - tgtCy) ** 2);
  if (dist < bestDistance) {
    bestDistance = dist;
    bestAnchor = anchor;
  }
}

startX = bestAnchor.x;
startY = bestAnchor.y;
```

- [ ] **Step 2: 目标锚点逻辑保持不变**

```typescript
// 目标锚点选择保持现有逻辑
if (tgtCx > srcCx) {
  endX = toBounds.left;
  endY = toBounds.top + toBounds.height / 2;
} else if (tgtCx < srcCx) {
  endX = toBounds.left + toBounds.width;
  endY = toBounds.top + toBounds.height / 2;
} else if (tgtCy > srcCy) {
  endX = tgtCx;
  endY = toBounds.top;
} else {
  endX = tgtCx;
  endY = toBounds.top + toBounds.height;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/plugins/utils/fabricPlugins/connectionPlugin.ts
git commit -m "feat(connection): optimize anchor selection with distance calculation"
```

---

## Task 2: 验证测试

**Files:**
- Test: `src/app/plugins/utils/fabricPlugins/__tests__/connectionPlugin.test.ts`

**Steps:**

- [ ] **Step 1: 运行现有测试确认通过**

```bash
npx vitest run src/app/plugins/utils/fabricPlugins/__tests__/connectionPlugin.test.ts
```

- [ ] **Step 2: 如需要，更新测试以反映新算法行为**

- [ ] **Step 3: Commit**

```bash
git add src/app/plugins/utils/fabricPlugins/__tests__/connectionPlugin.test.ts
git commit -m "test(connection): update tests for anchor optimization"
```

---

## Spec Coverage

| Spec 需求 | 对应 Task |
|-----------|-----------|
| 源元素锚点距离计算 | Task 1 |
| 选择最近锚点 | Task 1 |
| 目标锚点逻辑不变 | Task 1 |
| 测试验证 | Task 2 |

---

Plan 完成。是否开始执行？
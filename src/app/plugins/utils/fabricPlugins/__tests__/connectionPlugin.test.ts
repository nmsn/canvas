import { describe, expect, it } from "vitest";

// 提取纯计算函数进行测试
function computeBezierPoints(
  srcBounds: { left: number; top: number; width: number; height: number },
  tgtBounds: { left: number; top: number; width: number; height: number },
  curvature: number,
) {
  const srcCx = srcBounds.left + srcBounds.width / 2;
  const srcCy = srcBounds.top + srcBounds.height / 2;
  const tgtCx = tgtBounds.left + tgtBounds.width / 2;
  const tgtCy = tgtBounds.top + tgtBounds.height / 2;

  let startX: number, startY: number, endX: number, endY: number;

  if (tgtCx > srcCx) {
    startX = srcBounds.left + srcBounds.width;
    startY = srcBounds.top + srcBounds.height / 2;
    endX = tgtBounds.left;
    endY = tgtBounds.top + tgtBounds.height / 2;
  } else if (tgtCx < srcCx) {
    startX = srcBounds.left;
    startY = srcBounds.top + srcBounds.height / 2;
    endX = tgtBounds.left + tgtBounds.width;
    endY = tgtBounds.top + tgtBounds.height / 2;
  } else if (tgtCy > srcCy) {
    startX = srcCx;
    startY = srcBounds.top + srcBounds.height;
    endX = tgtCx;
    endY = tgtBounds.top;
  } else {
    startX = srcCx;
    startY = srcBounds.top;
    endX = tgtCx;
    endY = tgtBounds.top + tgtBounds.height;
  }

  const distanceX = Math.abs(endX - startX);
  const distanceY = Math.abs(endY - startY);

  let cp1x: number, cp1y: number, cp2x: number, cp2y: number;

  if (distanceX >= distanceY) {
    const offset = distanceX * curvature;
    cp1x = startX + offset;
    cp1y = startY;
    cp2x = endX - offset;
    cp2y = endY;
  } else {
    const offset = distanceY * curvature;
    cp1x = startX;
    cp1y = startY + offset;
    cp2x = endX;
    cp2y = endY - offset;
  }

  return { startX, startY, endX, endY, cp1x, cp1y, cp2x, cp2y };
}

describe("computeBezierPoints", () => {
  it("水平关系：源在左目标在右，生成 S 弯", () => {
    const src = { left: 0, top: 0, width: 100, height: 50 };
    const tgt = { left: 200, top: 0, width: 100, height: 50 };
    const result = computeBezierPoints(src, tgt, 0.5);

    expect(result.startX).toBe(100); // src 右边缘
    expect(result.startY).toBe(25);  // src 高/2
    expect(result.endX).toBe(200);  // tgt 左边缘
    expect(result.endY).toBe(25);   // tgt 高/2

    // curvature=0.5, distanceX=100, offset=50
    expect(result.cp1x).toBe(150);  // startX + 50
    expect(result.cp1y).toBe(25);   // startY
    expect(result.cp2x).toBe(150);  // endX - 50
    expect(result.cp2y).toBe(25);   // endY
  });

  it("垂直关系：源在上目标在下，生成 C 弯", () => {
    const src = { left: 0, top: 0, width: 100, height: 50 };
    const tgt = { left: 0, top: 200, width: 100, height: 50 };
    const result = computeBezierPoints(src, tgt, 0.5);

    expect(result.startX).toBe(50);  // src 宽/2
    expect(result.startY).toBe(50);   // src 底边
    expect(result.endX).toBe(50);    // tgt 宽/2
    expect(result.endY).toBe(200);  // tgt 顶边

    // curvature=0.5, distanceY=150, offset=75
    expect(result.cp1x).toBe(50);   // startX
    expect(result.cp1y).toBe(125);  // startY + 75
    expect(result.cp2x).toBe(50);   // endX
    expect(result.cp2y).toBe(125);  // endY - 75
  });

  it("curvature=0 时退化为直线（控制点与端点重合）", () => {
    const src = { left: 0, top: 0, width: 100, height: 50 };
    const tgt = { left: 200, top: 0, width: 100, height: 50 };
    const result = computeBezierPoints(src, tgt, 0);

    expect(result.cp1x).toBe(result.startX);
    expect(result.cp2x).toBe(result.endX);
    expect(result.cp1y).toBe(result.startY);
    expect(result.cp2y).toBe(result.endY);
  });

  it("源右目标左时，方向反转", () => {
    const src = { left: 200, top: 0, width: 100, height: 50 };
    const tgt = { left: 0, top: 0, width: 100, height: 50 };
    const result = computeBezierPoints(src, tgt, 0.5);

    expect(result.startX).toBe(200); // src 左边缘
    expect(result.endX).toBe(100);    // tgt 右边缘
  });
});
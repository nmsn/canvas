import { type CanvasSnippet } from "./registry";

/**
 * 代码片段配置
 */
export interface SnippetConfig {
  /** 函数名称 */
  funcName: string;
  /** X 偏移量（相对于基准点） */
  offsetX: number;
  /** Y 偏移量（相对于基准点） */
  offsetY: number;
}

/**
 * 生成单个组件的代码
 * @param snippet - 画布片段
 * @returns 代码字符串
 */
export function generateSnippetCode(snippet: CanvasSnippet): string {
  return `${snippet.funcName}(canvas, { x: ${snippet.params.x}, y: ${snippet.params.y} });`;
}

/**
 * 生成所有片段的代码
 * @param snippets - 画布片段数组
 * @returns 完整代码字符串
 */
export function generateAllCode(snippets: CanvasSnippet[]): string {
  if (snippets.length === 0) return "";
  return snippets.map((s) => generateSnippetCode(s)).join("\n");
}

/**
 * 生成组合函数代码
 * @param name - 函数名称（如 drawMyCombo）
 * @param displayName - 显示名称（如 我的组合）
 * @param snippets - 画布片段数组
 * @returns 完整的组合函数代码
 */
export function generateCompositionCode(
  name: string,
  displayName: string,
  snippets: CanvasSnippet[],
): string {
  if (snippets.length === 0) return "";

  // 计算基准点（第一个片段的位置）
  const firstSnippet = snippets[0]!;
  const baseX = firstSnippet.params.x;
  const baseY = firstSnippet.params.y;

  // 生成片段配置
  const configs: SnippetConfig[] = snippets.map((s) => ({
    funcName: s.funcName,
    offsetX: s.params.x - baseX,
    offsetY: s.params.y - baseY,
  }));

  // 构建代码
  const lines: string[] = [
    `/**`,
    ` * ${displayName}`,
    ` */`,
    `export const ${name} = (`,
    `  canvas: Canvas,`,
    `  params: DrawParams,`,
    `) => {`,
    `  const { x, y } = params;`,
    `  const objects: FabricObject[] = [];`,
    ``,
  ];

  configs.forEach((config, i) => {
    lines.push(`  // 组件 ${i + 1}: ${config.funcName}`);
    lines.push(`  const obj${i} = ${config.funcName}(canvas, {`);
    lines.push(`    x: x + ${config.offsetX},`);
    lines.push(`    y: y + ${config.offsetY},`);
    lines.push(`  });`);
    lines.push(`  objects.push(obj${i});`);
    lines.push(``);
  });

  lines.push(`  return new Group(objects, {`);
  lines.push(`    left: x,`);
  lines.push(`    top: y,`);
  lines.push(`    selectable: true,`);
  lines.push(`  });`);
  lines.push(`};`);

  return lines.join("\n");
}

/**
 * 生成高亮代码（使用简单标记）
 * 实际高亮由 highlight.js 处理
 */
export function generateHighlightedCode(code: string): string {
  return code;
}

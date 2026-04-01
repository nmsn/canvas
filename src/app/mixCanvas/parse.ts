/**
 * 解析函数参数
 * 支持提取所有解构块的参数名（按顺序）
 * @param fn - 函数
 * @returns 所有参数名数组
 */
function parseParams(fn: Function): string[] {
  const src = fn.toString();

  // 匹配所有解构块 { ... }
  const destructuredMatches = src.matchAll(/\)\s*\{([^}]*)\}/g);
  const allParams: string[] = [];

  for (const match of destructuredMatches) {
    const content = match[1]!;
    const params = content
      .split(",")
      .map((p: string) => {
        // 处理 TypeScript 类型注解: { x, y }: Position 或 { width = 100 }: { width?: number }
        const beforeColon = p.split(":")[0]!.trim();
        // 处理带默认值的: width = 100
        return beforeColon.split("=")[0]!.trim();
      })
      .filter(Boolean);
    allParams.push(...params);
  }

  if (allParams.length > 0) {
    return allParams;
  }

  // 再尝试普通参数
  const normal = src.match(/\(([^)]*)\)/);
  if (normal) {
    return normal[1]!
      .split(",")
      .map((p: string) => p.split("=")[0]!.trim())
      .filter(Boolean);
  }
  return [];
}

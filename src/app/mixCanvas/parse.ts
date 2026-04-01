function parseParams(fn: Function): string[] {
  const src = fn.toString();
  // 先尝试解构写法
  const destructured = src.match(/\(\s*\{([^}]*)\}/);
  if (destructured) {
    return destructured[1]!
      .split(",")
      .map((p: string) => p.split("=")[0]!.trim())
      .filter(Boolean);
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

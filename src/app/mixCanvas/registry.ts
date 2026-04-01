import { type Canvas, type FabricObject } from "fabric";

/**
 * 位置参数
 */
export type Position = { x: number; y: number };

/**
 * 绘制函数类型 - 统一签名
 * position: 位置 { x, y }
 * params: 其他参数（如 width, height 等）
 */
export type DrawFunc = (
  canvas: Canvas,
  position: Position,
  params: Record<string, unknown>,
) => FabricObject;

/**
 * 排除的参数名（内部使用，不暴露给 UI）
 */
const EXCLUDED_PARAMS = ["canvas", "isRender"];

/**
 * 解析函数参数（支持多解构块）
 * @param fn - 函数
 * @returns 所有解构块的参数名数组（按块顺序）
 */
function parseParamBlocks(fn: Function): string[][] {
  const src = fn.toString();

  // 匹配所有解构块 { ... }
  const destructuredMatches = src.matchAll(/\)\s*\{([^}]*)\}/g);
  const blocks: string[][] = [];

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
    blocks.push(params);
  }

  return blocks;
}

/**
 * 从绘制函数签名中提取可编辑参数 key 列表（第三个解构块）
 * 新签名: drawFn(canvas, { x, y }, { width, height }, isRender)
 * - 第一个解构块: position (x, y) - 不暴露
 * - 第二个解构块: params (width, height 等) - 暴露给 UI
 *
 * @param fn - 绘制函数
 * @returns 参数 key 数组
 */
export function extractParamKeys(fn: Function): string[] {
  const blocks = parseParamBlocks(fn);

  // 新签名中，第二个解构块（index 1）是 params
  if (blocks.length >= 2 && blocks[1]) {
    return blocks[1];
  }

  // 降级：使用旧的 params.xxx 匹配方式
  const fnStr = fn.toString();
  const matches = fnStr.matchAll(/params\.(?:(\w+)|\[(['"])(\w+)\2\])/g);
  const keys = new Set<string>();

  for (const match of matches) {
    const key = match[1] || match[3];
    if (key) {
      keys.add(key);
    }
  }

  return Array.from(keys);
}

/**
 * 从绘制函数签名中提取参数的默认值
 * 支持从解构块中提取默认值 { width = 100 }
 *
 * @param fn - 绘制函数
 * @returns 包含默认值 key-value 的对象
 */
export function extractParamDefaults(fn: Function): Record<string, number | string | boolean> {
  const fnStr = fn.toString();
  const defaults: Record<string, number | string | boolean> = {};

  // 1. 从解构块中提取默认值（第二个块是 params）
  const blocks = parseParamBlocks(fn);
  if (blocks.length >= 2 && blocks[1]) {
    const paramsBlock = blocks[1];
    // 匹配 key = value 格式
    const defaultPattern = /\b(\w+)\s*=\s*(?:(\d+(?:\.\d+)?)|'(.*?)'|"(.*?)"|(\w+))/g;
    let match;

    while ((match = defaultPattern.exec(paramsBlock.join(","))) !== null) {
      const key = match[1]!;
      const numStr = match[2];
      const singleStr = match[3];
      const doubleStr = match[4];
      const boolStr = match[5];

      if (!EXCLUDED_PARAMS.includes(key)) {
        if (numStr !== undefined) {
          defaults[key] = parseFloat(numStr);
        } else if (singleStr !== undefined) {
          defaults[key] = singleStr;
        } else if (doubleStr !== undefined) {
          defaults[key] = doubleStr;
        } else if (boolStr !== undefined) {
          defaults[key] = boolStr === "true";
        }
      }
    }
  }

  // 2. 从函数体中搜索 params.xxx ?? default 模式（降级兼容）
  const nullishPattern = /params\.(\w+).*?\?\?\s*(?:(\d+(?:\.\d+)?)|'(.*?)'|"(.*?)")/g;
  let nullishMatch;

  while ((nullishMatch = nullishPattern.exec(fnStr)) !== null) {
    const paramAccess = nullishMatch[0];
    const paramNameMatch = paramAccess.match(/params\.(\w+)/);
    if (!paramNameMatch) continue;

    const paramName = paramNameMatch[1]!;
    if (EXCLUDED_PARAMS.includes(paramName)) continue;
    if (paramName in defaults) continue;

    const value = nullishMatch[1] ?? nullishMatch[2] ?? nullishMatch[3];
    if (value !== undefined) {
      const numValue = parseFloat(value as string);
      defaults[paramName] = isNaN(numValue) ? (value as string) : numValue;
    }
  }

  return defaults;
}

/**
 * 函数注册项
 */
export interface FuncEntry {
  /** 函数名称（如 drawHorizontalLine） */
  name: string;
  /** 显示名称（如 HorizontalLine） */
  displayName: string;
  /** 执行函数 */
  execute: DrawFunc;
  /** 可编辑参数 key 列表（如 ['x', 'y', 'width']） */
  paramKeys: string[];
  /** 参数默认值 */
  paramDefaults: Record<string, number | string | boolean>;
}

/**
 * 画布片段 - 画布上每个组件的记录
 */
export interface CanvasSnippet {
  /** 唯一标识 */
  id: string;
  /** 函数名称 */
  funcName: string;
  /** 显示名称 */
  displayName: string;
  /** 位置参数 */
  position: Position;
  /** 其他参数（如 width, height 等） */
  params: Record<string, unknown>;
  /** Fabric.js 对象 */
  fabricObject: FabricObject | FabricObject[];
}

/**
 * 函数注册器
 * 自动扫描模块中所有符合约定的导出函数
 */
export class FuncRegistry {
  private functions = new Map<string, FuncEntry>();

  /**
   * 注册绘制函数
   */
  register(entry: FuncEntry): void {
    this.functions.set(entry.name, entry);
  }

  /**
   * 批量注册
   */
  registerAll(entries: FuncEntry[]): void {
    entries.forEach((entry) => this.register(entry));
  }

  /**
   * 获取所有已注册的函数
   */
  getAll(): FuncEntry[] {
    return Array.from(this.functions.values());
  }

  /**
   * 根据名称获取函数
   */
  get(name: string): FuncEntry | undefined {
    return this.functions.get(name);
  }

  /**
   * 扫描模块导出的函数
   * @param module - 要扫描的模块对象
   * @param filter - 过滤函数（可选）
   */
  scanModule(
    module: Record<string, unknown>,
    filter?: (name: string, fn: unknown) => boolean,
  ): void {
    for (const [name, fn] of Object.entries(module)) {
      if (typeof fn === "function") {
        if (filter && !filter(name, fn)) continue;

        const displayName = this.generateDisplayName(name);
        const paramKeys = extractParamKeys(fn as Function);
        const paramDefaults = extractParamDefaults(fn as Function);

        this.register({
          name,
          displayName,
          execute: fn as DrawFunc,
          paramKeys,
          paramDefaults,
        });
      }
    }
  }

  /**
   * 从函数名生成显示名称
   * drawHorizontalLine → HorizontalLine
   */
  private generateDisplayName(name: string): string {
    // 移除 draw 前缀
    let display = name.replace(/^draw/, "");
    // 首字母大写
    if (display.length > 0) {
      display = display.charAt(0).toUpperCase() + display.slice(1);
    }
    return display || name;
  }
}

/**
 * 全局注册器实例
 */
export const globalRegistry = new FuncRegistry();

import { type Canvas, type FabricObject } from "fabric";

/**
 * 绘制参数接口
 */
export interface DrawParams {
  x: number;
  y: number;
  [key: string]: unknown;
}

/**
 * 绘制函数类型 - 统一签名
 */
export type DrawFunc = (canvas: Canvas, params: DrawParams) => FabricObject;

/**
 * 排除的参数名（内部使用，不暴露给 UI）
 */
const EXCLUDED_PARAMS = ["canvas", "isRender"];

/**
 * 从绘制函数签名中提取可编辑参数 key 列表
 * 通过分析函数体内访问的 params 对象属性来判断
 *
 * 简化实现：扫描函数源码，匹配 params.xxx 模式
 * @param fn - 绘制函数
 * @returns 参数 key 数组
 */
export function extractParamKeys(fn: Function): string[] {
  const fnStr = fn.toString();
  // 匹配 params.xxx 或 params["xxx"] 模式
  const matches = fnStr.matchAll(/params\.(?:(\w+)|\[(['"])(\w+)\2\])/g);
  const keys = new Set<string>();

  for (const match of matches) {
    const key = match[1] || match[3];
    if (key && !EXCLUDED_PARAMS.includes(key)) {
      keys.add(key);
    }
  }

  return Array.from(keys);
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
  /** 绘制参数 */
  params: DrawParams;
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

        this.register({
          name,
          displayName,
          execute: fn as DrawFunc,
          paramKeys,
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

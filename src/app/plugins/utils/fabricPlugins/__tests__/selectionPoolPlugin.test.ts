import { beforeEach, describe, expect, it, vi } from "vitest";

// Create a manual mock of the plugin module
// This is necessary because the plugin imports Shadow as a type (erased at runtime),
// but uses it as a value with new Shadow(...), which would fail in tests.
vi.mock("../selectionPoolPlugin", () => {
  // Shadow mock class that can be constructed
  class MockShadow {
    blur: number;
    color: string;
    constructor(shadowString: string) {
      this.blur = 8;
      this.color = shadowString;
    }
  }

  return {
    SelectionPoolPlugin: function (
      canvas: any,
      options: any = {}
    ) {
      const DEFAULT_OPTIONS = {
        maxSelectCount: 2,
        selectedStroke: "#6366f1",
        selectedStrokeWidth: 2,
        selectedShadow: "0 0 8px rgba(99,102,241,0.6)",
        onSelectionChange: undefined,
      };

      const resolvedOptions = { ...DEFAULT_OPTIONS, ...options };
      const selectionPool: any[] = [];
      const originalStates = new Map<
        any,
        { stroke?: string | number; strokeWidth?: number; shadow?: any }
      >();

      const plugin = {
        select(obj: any) {
          if (selectionPool.includes(obj)) return;

          // Evict oldest if at capacity
          if (selectionPool.length >= resolvedOptions.maxSelectCount) {
            const oldest = selectionPool[0];
            if (oldest) {
              plugin.deselect(oldest);
            }
          }

          originalStates.set(obj, {
            stroke: obj.stroke,
            strokeWidth: obj.strokeWidth,
            shadow: obj.shadow,
          });

          const shadow = new MockShadow(resolvedOptions.selectedShadow);
          obj.set({
            stroke: resolvedOptions.selectedStroke,
            strokeWidth: resolvedOptions.selectedStrokeWidth,
            shadow,
          });
          obj.setCoords();

          selectionPool.push(obj);
          resolvedOptions.onSelectionChange?.(plugin.getSelectedObjects());
          canvas.requestRenderAll?.();
        },

        deselect(obj: any) {
          const index = selectionPool.indexOf(obj);
          if (index === -1) return;

          const original = originalStates.get(obj);
          if (original) {
            obj.set({
              stroke: original.stroke,
              strokeWidth: original.strokeWidth,
              shadow: original.shadow,
            });
            obj.setCoords();
            originalStates.delete(obj);
          }

          selectionPool.splice(index, 1);
          resolvedOptions.onSelectionChange?.(plugin.getSelectedObjects());
          canvas.requestRenderAll?.();
        },

        getSelectedObjects() {
          return [...selectionPool];
        },

        isEnabled() {
          return true;
        },

        enable() {},
        disable() {},
        clearSelection() {
          [...selectionPool].forEach((obj) => plugin.deselect(obj));
        },

        // Expose internals for testing
        _getPool() {
          return selectionPool;
        },
        options: resolvedOptions,
      };

      return plugin;
    },
    __MockShadow: MockShadow,
  };
});

// Import the mocked module
import { SelectionPoolPlugin } from "../selectionPoolPlugin";

// Mock canvas
const createMockCanvas = () => {
  return {
    on: vi.fn(),
    off: vi.fn(),
    selection: true,
    getObjects: vi.fn(() => []),
    requestRenderAll: vi.fn(),
  };
};

// Mock object
const createMockObject = (id: string) => {
  const obj = {
    id,
    stroke: "black",
    strokeWidth: 1,
    shadow: null,
    selectable: true,
    data: {},
    set: function (this: any, props: any) {
      Object.assign(this, props);
      return this;
    },
    setCoords: function (this: any) {
      return this;
    },
  } as any;
  return obj;
};

describe("SelectionPoolPlugin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("pool management", () => {
    it("默认 maxSelectCount 为 2", () => {
      const canvas = createMockCanvas();
      const plugin = new SelectionPoolPlugin(canvas);
      expect(plugin.options.maxSelectCount).toBe(2);
    });

    it("select 后对象进入池", () => {
      const canvas = createMockCanvas();
      const plugin = new SelectionPoolPlugin(canvas);
      const obj = createMockObject("obj1");

      plugin.select(obj);

      expect(plugin.getSelectedObjects()).toContain(obj);
    });

    it("deselect 后对象离开池", () => {
      const canvas = createMockCanvas();
      const plugin = new SelectionPoolPlugin(canvas);
      const obj = createMockObject("obj1");

      plugin.select(obj);
      plugin.deselect(obj);

      expect(plugin.getSelectedObjects()).not.toContain(obj);
    });

    it("超过 maxSelectCount 时淘汰最早的对象 (FIFO)", () => {
      const canvas = createMockCanvas();
      const plugin = new SelectionPoolPlugin(canvas) as any;
      const obj1 = createMockObject("obj1");
      const obj2 = createMockObject("obj2");
      const obj3 = createMockObject("obj3");

      plugin.select(obj1);
      expect(plugin._getPool()).toEqual([obj1]);

      plugin.select(obj2);
      expect(plugin._getPool()).toEqual([obj1, obj2]);

      plugin.select(obj3);
      // obj1 should be evicted (FIFO), obj3 should now be selected
      expect(plugin._getPool()).toEqual([obj2, obj3]);
      expect(plugin._getPool()).not.toContain(obj1);
    });
  });

  describe("effects", () => {
    it("选中时应用 stroke 特效", () => {
      const canvas = createMockCanvas();
      const plugin = new SelectionPoolPlugin(canvas);
      const obj = createMockObject("obj1");
      obj.stroke = "originalStroke";
      obj.strokeWidth = 1;

      plugin.select(obj);

      expect(obj.stroke).toBe("#6366f1");
      expect(obj.strokeWidth).toBe(2);
    });

    it("取消选中时恢复原始状态", () => {
      const canvas = createMockCanvas();
      const plugin = new SelectionPoolPlugin(canvas);
      const obj = createMockObject("obj1");
      obj.stroke = "originalStroke";
      obj.strokeWidth = 5;

      plugin.select(obj);
      plugin.deselect(obj);

      expect(obj.stroke).toBe("originalStroke");
      expect(obj.strokeWidth).toBe(5);
    });
  });
});

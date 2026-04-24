import { beforeEach, describe, expect, it, vi } from "vitest";
import { HistoryPlugin } from "../historyPlugin";

const createMockCanvas = () => ({
  on: vi.fn(),
  off: vi.fn(),
  getObjects: vi.fn(() => []),
  add: vi.fn(),
  remove: vi.fn(),
  requestRenderAll: vi.fn(),
});

const createMockObject = (id: string) => ({
  id,
  data: { id },
  selectable: true,
  toObject: vi.fn().mockReturnValue({ id, type: "rect", left: 0, top: 0 }),
  set: vi.fn().mockReturnThis(),
  setCoords: vi.fn(),
});

describe("HistoryPlugin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("enable/disable", () => {
    it("默认禁用状态", () => {
      const canvas = createMockCanvas();
      const plugin = new HistoryPlugin(canvas);
      expect(plugin.isEnabled()).toBe(false);
    });

    it("enable 后 isEnabled 返回 true", () => {
      const canvas = createMockCanvas();
      const plugin = new HistoryPlugin(canvas);
      plugin.enable();
      expect(plugin.isEnabled()).toBe(true);
    });

    it("disable 后 isEnabled 返回 false", () => {
      const canvas = createMockCanvas();
      const plugin = new HistoryPlugin(canvas);
      plugin.enable();
      plugin.disable();
      expect(plugin.isEnabled()).toBe(false);
    });

    it("enable 时注册 Fabric.js 事件监听", () => {
      const canvas = createMockCanvas();
      const plugin = new HistoryPlugin(canvas);
      plugin.enable();
      expect(canvas.on).toHaveBeenCalledWith("object:added", expect.any(Function));
      expect(canvas.on).toHaveBeenCalledWith("object:removed", expect.any(Function));
      expect(canvas.on).toHaveBeenCalledWith("object:modified", expect.any(Function));
    });

    it("disable 时移除所有事件监听", () => {
      const canvas = createMockCanvas();
      const plugin = new HistoryPlugin(canvas);
      plugin.enable();
      plugin.disable();
      expect(canvas.off).toHaveBeenCalledWith("object:added", expect.any(Function));
      expect(canvas.off).toHaveBeenCalledWith("object:removed", expect.any(Function));
      expect(canvas.off).toHaveBeenCalledWith("object:modified", expect.any(Function));
    });
  });

  describe("undo/redo state", () => {
    it("初始状态 cannot undo", () => {
      const canvas = createMockCanvas();
      const plugin = new HistoryPlugin(canvas);
      expect(plugin.canUndo()).toBe(false);
    });

    it("初始状态 cannot redo", () => {
      const canvas = createMockCanvas();
      const plugin = new HistoryPlugin(canvas);
      expect(plugin.canRedo()).toBe(false);
    });

    it("添加对象后 canUndo 为 true", () => {
      const canvas = createMockCanvas();
      const plugin = new HistoryPlugin(canvas);
      plugin.enable();
      const obj = createMockObject("obj1");
      // Simulate object:added event
      const handler = canvas.on.mock.calls.find((c: any[]) => c[0] === "object:added")[1];
      handler({ target: obj });
      expect(plugin.canUndo()).toBe(true);
    });
  });

  describe("history management", () => {
    it("getHistorySize 初始返回 0", () => {
      const canvas = createMockCanvas();
      const plugin = new HistoryPlugin(canvas);
      expect(plugin.getHistorySize()).toBe(0);
    });

    it("getCurrentIndex 初始返回 -1", () => {
      const canvas = createMockCanvas();
      const plugin = new HistoryPlugin(canvas);
      expect(plugin.getCurrentIndex()).toBe(-1);
    });

    it("clear 重置历史栈", () => {
      const canvas = createMockCanvas();
      const plugin = new HistoryPlugin(canvas);
      plugin.enable();
      const obj = createMockObject("obj1");
      const handler = canvas.on.mock.calls.find((c: any[]) => c[0] === "object:added")[1];
      handler({ target: obj });
      plugin.clear();
      expect(plugin.getHistorySize()).toBe(0);
      expect(plugin.canUndo()).toBe(false);
    });
  });

  describe("onChange callback", () => {
    it("启用时触发 onChange", () => {
      const canvas = createMockCanvas();
      const onChange = vi.fn();
      new HistoryPlugin(canvas, { onChange });
      expect(onChange).toHaveBeenCalledWith(false, false);
    });

    it("添加对象时触发 onChange", () => {
      const canvas = createMockCanvas();
      const onChange = vi.fn();
      const plugin = new HistoryPlugin(canvas, { onChange });
      plugin.enable();
      const obj = createMockObject("obj1");
      const handler = canvas.on.mock.calls.find((c: any[]) => c[0] === "object:added")[1];
      handler({ target: obj });
      expect(onChange).toHaveBeenCalledWith(true, false);
    });
  });

  describe("object:added event", () => {
    it("添加对象时创建 add 类型节点", () => {
      const canvas = createMockCanvas();
      const plugin = new HistoryPlugin(canvas);
      plugin.enable();
      const obj = createMockObject("obj1");
      const handler = canvas.on.mock.calls.find((c: any[]) => c[0] === "object:added")[1];
      handler({ target: obj });
      expect(plugin.getHistorySize()).toBe(1);
      expect(plugin.getCurrentIndex()).toBe(0);
    });
  });

  describe("object:removed event", () => {
    it("删除对象时创建 remove 类型节点", () => {
      const canvas = createMockCanvas();
      const plugin = new HistoryPlugin(canvas);
      plugin.enable();
      const obj = createMockObject("obj1");
      const handler = canvas.on.mock.calls.find((c: any[]) => c[0] === "object:removed")[1];
      handler({ target: obj });
      expect(plugin.getHistorySize()).toBe(1);
    });
  });

  describe("object:modified event", () => {
    it("修改对象时创建 modify 类型节点", () => {
      const canvas = createMockCanvas();
      const plugin = new HistoryPlugin(canvas);
      plugin.enable();
      const obj = createMockObject("obj1");
      const handler = canvas.on.mock.calls.find((c: any[]) => c[0] === "object:modified")[1];
      handler({ target: obj });
      expect(plugin.getHistorySize()).toBe(1);
    });
  });

  describe("history overflow", () => {
    it("超过 maxHistorySize 时丢弃最旧的节点", () => {
      const canvas = createMockCanvas();
      const plugin = new HistoryPlugin(canvas, { maxHistorySize: 3 });
      plugin.enable();
      for (let i = 0; i < 5; i++) {
        const obj = createMockObject(`obj${i}`);
        const handler = canvas.on.mock.calls.find((c: any[]) => c[0] === "object:added")[1];
        handler({ target: obj });
      }
      expect(plugin.getHistorySize()).toBe(3);
    });
  });

  describe("undo", () => {
    it("undo 移动 currentIndex 向后", () => {
      const canvas = createMockCanvas();
      const plugin = new HistoryPlugin(canvas);
      plugin.enable();
      const obj = createMockObject("obj1");
      const handler = canvas.on.mock.calls.find((c: any[]) => c[0] === "object:added")[1];
      handler({ target: obj });
      expect(plugin.getCurrentIndex()).toBe(0);
      plugin.undo();
      expect(plugin.getCurrentIndex()).toBe(-1);
    });

    it("无历史时 undo 不执行", () => {
      const canvas = createMockCanvas();
      const plugin = new HistoryPlugin(canvas);
      plugin.undo();
      expect(plugin.canUndo()).toBe(false);
    });
  });

  describe("redo", () => {
    it("undo 后 redo 恢复 currentIndex", () => {
      const canvas = createMockCanvas();
      const plugin = new HistoryPlugin(canvas);
      plugin.enable();
      const obj = createMockObject("obj1");
      const handler = canvas.on.mock.calls.find((c: any[]) => c[0] === "object:added")[1];
      handler({ target: obj });
      plugin.undo();
      expect(plugin.getCurrentIndex()).toBe(-1);
      plugin.redo();
      expect(plugin.getCurrentIndex()).toBe(0);
    });

    it("无 redo 历史时 redo 不执行", () => {
      const canvas = createMockCanvas();
      const plugin = new HistoryPlugin(canvas);
      plugin.redo();
      expect(plugin.canRedo()).toBe(false);
    });
  });

  describe("new action after undo", () => {
    it("undo 后新操作清空 redo 历史", () => {
      const canvas = createMockCanvas();
      const plugin = new HistoryPlugin(canvas);
      plugin.enable();
      const obj1 = createMockObject("obj1");
      const obj2 = createMockObject("obj2");
      const addedHandler = canvas.on.mock.calls.find((c: any[]) => c[0] === "object:added")[1];
      addedHandler({ target: obj1 });
      addedHandler({ target: obj2 });
      plugin.undo(); // undo obj2
      const obj3 = createMockObject("obj3");
      addedHandler({ target: obj3 }); // add obj3
      expect(plugin.canRedo()).toBe(false);
    });
  });
});
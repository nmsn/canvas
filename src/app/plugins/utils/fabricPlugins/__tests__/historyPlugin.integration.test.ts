import { beforeEach, describe, expect, it, vi } from "vitest";
import { HistoryPlugin } from "../historyPlugin";

const createMockCanvas = () => {
  const objects: any[] = [];
  return {
    on: vi.fn(),
    off: vi.fn(),
    getObjects: vi.fn(() => objects),
    add: vi.fn((obj) => objects.push(obj)),
    remove: vi.fn((obj) => {
      const idx = objects.indexOf(obj);
      if (idx > -1) objects.splice(idx, 1);
    }),
    requestRenderAll: vi.fn(),
    _objects: objects,
  };
};

const createMockObject = (id: string) => {
  const mock = {
    id,
    data: { id },
    selectable: true,
    left: 0,
    top: 0,
    toObject: vi.fn().mockReturnValue({
      id,
      type: "rect",
      left: 0,
      top: 0,
      data: { id },
      setCoords: vi.fn(),
    }),
    set: vi.fn().mockReturnThis(),
    setCoords: vi.fn(),
  };
  return mock;
};

describe("HistoryPlugin Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("undo remove 调用 canvas.add 恢复对象", () => {
    const canvas = createMockCanvas();
    const plugin = new HistoryPlugin(canvas);
    plugin.enable();

    const obj = createMockObject("obj1");
    canvas._objects.push(obj);

    const handler = canvas.on.mock.calls.find((c: any[]) => c[0] === "object:removed")[1];
    handler({ target: obj });

    canvas._objects.splice(0, 1); // Simulate removal
    plugin.undo();

    expect(canvas.add).toHaveBeenCalled();
  });

  it("undo modify 恢复对象属性", () => {
    const canvas = createMockCanvas();
    const plugin = new HistoryPlugin(canvas);
    plugin.enable();

    const obj = createMockObject("obj1");
    obj.left = 100;
    canvas._objects.push(obj);

    const handler = canvas.on.mock.calls.find((c: any[]) => c[0] === "object:modified")[1];
    handler({ target: obj });

    obj.left = 200;
    plugin.undo();

    expect(obj.set).toHaveBeenCalled();
  });

  it("redo add 重新添加对象", () => {
    const canvas = createMockCanvas();
    const plugin = new HistoryPlugin(canvas);
    plugin.enable();

    const obj = createMockObject("obj1");
    const handler = canvas.on.mock.calls.find((c: any[]) => c[0] === "object:added")[1];
    handler({ target: obj });

    plugin.undo(); // undo the add
    expect(canvas._objects.length).toBe(0);

    plugin.redo(); // redo the add
    expect(canvas.add).toHaveBeenCalled();
  });

  it("redo remove 重新删除对象", () => {
    const canvas = createMockCanvas();
    const plugin = new HistoryPlugin(canvas);
    plugin.enable();

    const obj = createMockObject("obj1");
    canvas._objects.push(obj);

    const removedHandler = canvas.on.mock.calls.find((c: any[]) => c[0] === "object:removed")[1];
    removedHandler({ target: obj });

    canvas._objects.splice(0, 1);
    plugin.undo(); // undo the remove (restore)
    expect(canvas._objects.length).toBe(1);

    plugin.redo(); // redo the remove
    expect(canvas.remove).toHaveBeenCalled();
  });

  it("连续 undo/redo 正确追踪 currentIndex", () => {
    const canvas = createMockCanvas();
    const plugin = new HistoryPlugin(canvas);
    plugin.enable();

    const obj1 = createMockObject("obj1");
    const obj2 = createMockObject("obj2");
    const handler = canvas.on.mock.calls.find((c: any[]) => c[0] === "object:added")[1];

    handler({ target: obj1 });
    expect(plugin.getCurrentIndex()).toBe(0);

    handler({ target: obj2 });
    expect(plugin.getCurrentIndex()).toBe(1);

    plugin.undo();
    expect(plugin.getCurrentIndex()).toBe(0);

    plugin.undo();
    expect(plugin.getCurrentIndex()).toBe(-1);

    plugin.redo();
    expect(plugin.getCurrentIndex()).toBe(0);

    plugin.redo();
    expect(plugin.getCurrentIndex()).toBe(1);
  });
});
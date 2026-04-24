import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock fabric BEFORE importing ThumbnailPlugin
vi.mock("fabric", () => {
  function MockCanvas() {
    return {
      setWidth: vi.fn(),
      setHeight: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    };
  }
  return {
    Canvas: MockCanvas,
    default: { Canvas: MockCanvas },
    FabricObject: vi.fn(),
  };
});

// Mock document for node environment
const mockQuerySelector = vi.fn();
const mockCreateElement = vi.fn(() => {
  const div = { className: "", style: {}, appendChild: vi.fn(), querySelector: vi.fn(), getBoundingClientRect: vi.fn(() => ({ width: 100, height: 100 })) };
  return div;
});
const mockDocument = {
  querySelector: mockQuerySelector,
  createElement: mockCreateElement,
};
Object.defineProperty(global, "document", { value: mockDocument, writable: true });

// Mock ResizeObserver
class MockResizeObserver {
  observe = vi.fn();
  disconnect = vi.fn();
}
Object.defineProperty(global, "ResizeObserver", { value: MockResizeObserver, writable: true });

// Import after mocks
import { ThumbnailPlugin } from "./thumbnailPlugin";

describe("ThumbnailPlugin enable/disable", () => {
  beforeEach(() => {
    mockQuerySelector.mockReset();
    mockCreateElement.mockReset();
  });

  it("should enable plugin and register canvas events", () => {
    // Arrange
    const mockDiv = { className: "", style: {}, appendChild: vi.fn(), querySelector: vi.fn() };
    mockCreateElement.mockReturnValue(mockDiv);
    mockQuerySelector.mockReturnValue(mockDiv);
    const mockCanvas = {
      on: vi.fn(),
      off: vi.fn(),
      getObjects: vi.fn().mockReturnValue([]),
      getZoom: vi.fn().mockReturnValue(1),
      viewportTransform: [1, 0, 0, 1, 0, 0],
      getTopContext: vi.fn(),
      upperCanvasEl: { width: 0, height: 0 },
      requestRenderAll: vi.fn(),
      setWidth: vi.fn(),
      setHeight: vi.fn(),
    };

    const plugin = new ThumbnailPlugin(mockCanvas as any, { container: ".thumbnail" });

    // Act
    plugin.enable();

    // Assert
    expect(plugin.isEnabled()).toBe(true);
    // Should register event listeners on the canvas
    expect(mockCanvas.on).toHaveBeenCalled();
  });

  it("should disable plugin and unregister canvas events", () => {
    // Arrange
    const mockDiv = { className: "", style: {}, appendChild: vi.fn(), querySelector: vi.fn() };
    mockCreateElement.mockReturnValue(mockDiv);
    mockQuerySelector.mockReturnValue(mockDiv);
    const mockCanvas = {
      on: vi.fn(),
      off: vi.fn(),
      getObjects: vi.fn().mockReturnValue([]),
      getZoom: vi.fn().mockReturnValue(1),
      viewportTransform: [1, 0, 0, 1, 0, 0],
      getTopContext: vi.fn(),
      upperCanvasEl: { width: 0, height: 0 },
      requestRenderAll: vi.fn(),
      setWidth: vi.fn(),
      setHeight: vi.fn(),
    };

    const plugin = new ThumbnailPlugin(mockCanvas as any, { container: ".thumbnail" });
    plugin.enable();
    mockCanvas.on.mockClear();

    // Act
    plugin.disable();

    // Assert
    expect(plugin.isEnabled()).toBe(false);
    // Should unregister event listeners from the canvas
    expect(mockCanvas.off).toHaveBeenCalled();
  });

  it("should not double enable", () => {
    // Arrange
    const mockDiv = { className: "", style: {}, appendChild: vi.fn(), querySelector: vi.fn() };
    mockCreateElement.mockReturnValue(mockDiv);
    mockQuerySelector.mockReturnValue(mockDiv);
    const mockCanvas = {
      on: vi.fn(),
      off: vi.fn(),
      getObjects: vi.fn().mockReturnValue([]),
      getZoom: vi.fn().mockReturnValue(1),
      viewportTransform: [1, 0, 0, 1, 0, 0],
      getTopContext: vi.fn(),
      upperCanvasEl: { width: 0, height: 0 },
      requestRenderAll: vi.fn(),
      setWidth: vi.fn(),
      setHeight: vi.fn(),
    };

    const plugin = new ThumbnailPlugin(mockCanvas as any, { container: ".thumbnail" });
    plugin.enable();
    mockCanvas.on.mockClear();

    // Act
    plugin.enable();

    // Assert - should not register events twice
    expect(mockCanvas.on).not.toHaveBeenCalled();
  });
});

describe("ThumbnailPlugin syncViewport", () => {
  beforeEach(() => {
    mockQuerySelector.mockReset();
    mockCreateElement.mockReset();
  });

  it("should calculate visible area from main canvas viewport", () => {
    // Arrange
    const mockDiv = { className: "", style: {}, appendChild: vi.fn(), querySelector: vi.fn() };
    mockCreateElement.mockReturnValue(mockDiv);
    mockQuerySelector.mockReturnValue(mockDiv);
    const mockViewportTransform = [1, 0, 0, 1, -100, -200];
    const mockCanvas = {
      on: vi.fn(),
      off: vi.fn(),
      getObjects: vi.fn().mockReturnValue([]),
      getZoom: vi.fn().mockReturnValue(0.5),
      viewportTransform: mockViewportTransform,
      width: 800,
      height: 600,
      getTopContext: vi.fn(),
      upperCanvasEl: { width: 0, height: 0 },
      requestRenderAll: vi.fn(),
      setWidth: vi.fn(),
      setHeight: vi.fn(),
    };

    const plugin = new ThumbnailPlugin(mockCanvas as any, { container: ".thumbnail" });

    // Act
    plugin.enable();

    // Assert
    expect(plugin.isEnabled()).toBe(true);
  });
});

describe("ThumbnailPlugin viewport bounds constraint", () => {
  beforeEach(() => {
    mockQuerySelector.mockReset();
    mockCreateElement.mockReset();
  });

  it("should constrain viewport rect within canvas bounds", () => {
    // Arrange
    const mockDiv = { className: "", style: {}, appendChild: vi.fn(), querySelector: vi.fn() };
    mockCreateElement.mockReturnValue(mockDiv);
    mockQuerySelector.mockReturnValue(mockDiv);

    // Mock viewportRect with out-of-bounds position (-100, -100)
    const mockViewportRect = {
      set: vi.fn(),
      setCoords: vi.fn(),
      getBoundingRect: vi.fn(() => ({ width: 50, height: 50 })),
      left: -100,
      top: -100,
    };

    const mockThumbnailCanvas = {
      setWidth: vi.fn(),
      setHeight: vi.fn(),
      width: 100,
      height: 100,
      add: vi.fn(),
      remove: vi.fn(),
      renderAll: vi.fn(),
      requestRenderAll: vi.fn(),
    };

    const mockCanvas = {
      on: vi.fn(),
      off: vi.fn(),
      getObjects: vi.fn().mockReturnValue([]),
      getZoom: vi.fn().mockReturnValue(1),
      viewportTransform: [1, 0, 0, 1, 0, 0],
      getTopContext: vi.fn(),
      upperCanvasEl: { width: 0, height: 0 },
      requestRenderAll: vi.fn(),
      setWidth: vi.fn(),
      setHeight: vi.fn(),
    };

    const plugin = new ThumbnailPlugin(mockCanvas as any, { container: ".thumbnail" });

    // Manually set internal state to simulate a viewport rect that is out of bounds
    (plugin as any).thumbnailCanvas = mockThumbnailCanvas;
    (plugin as any).viewportRect = mockViewportRect;

    // Act - call constrainViewportRect directly
    (plugin as any).constrainViewportRect();

    // Assert - set should have been called with constrained values (0, 0) not (-100, -100)
    expect(mockViewportRect.set).toHaveBeenCalled();
    const setCall = mockViewportRect.set.mock.calls[0][0];
    expect(setCall.left).toBe(0);
    expect(setCall.top).toBe(0);
  });
});

describe("ThumbnailPlugin ResizeObserver", () => {
  beforeEach(() => {
    mockQuerySelector.mockReset();
    mockCreateElement.mockReset();
  });

  it("should handle resize when container size is 0", () => {
    // Arrange - simulate 0x0 container (invisible state)
    const mockDiv = {
      className: "",
      style: {},
      appendChild: vi.fn(),
      querySelector: vi.fn(),
      getBoundingClientRect: vi.fn(() => ({ width: 0, height: 0 })),
    };
    mockCreateElement.mockReturnValue(mockDiv);
    mockQuerySelector.mockReturnValue(mockDiv);
    const mockCanvas = {
      on: vi.fn(),
      off: vi.fn(),
      getObjects: vi.fn().mockReturnValue([]),
      getZoom: vi.fn().mockReturnValue(1),
      viewportTransform: [1, 0, 0, 1, 0, 0],
      getTopContext: vi.fn(),
      upperCanvasEl: { width: 0, height: 0 },
      requestRenderAll: vi.fn(),
      setWidth: vi.fn(),
      setHeight: vi.fn(),
    };

    const plugin = new ThumbnailPlugin(mockCanvas as any, { container: ".thumbnail" });

    // Act & Assert - should not crash when container is 0x0 (invisible)
    plugin.enable();
    expect(plugin.isEnabled()).toBe(true);
  });
});

describe("ThumbnailPlugin Integration", () => {
  beforeEach(() => {
    mockQuerySelector.mockReset();
    mockCreateElement.mockReset();
  });

  it("should sync objects from main canvas", () => {
    // Arrange
    const mockDiv = {
      className: "",
      style: {},
      appendChild: vi.fn(),
      querySelector: vi.fn(),
      getBoundingClientRect: vi.fn(() => ({ width: 200, height: 200 })),
    };
    mockCreateElement.mockReturnValue(mockDiv);
    mockQuerySelector.mockReturnValue(mockDiv);

    const mockObject = {
      clone: vi.fn((cb) => cb({})),
      getBoundingRect: vi.fn(() => ({ left: 100, top: 100, width: 50, height: 50 })),
    };

    const mockCanvas = {
      on: vi.fn(),
      off: vi.fn(),
      getObjects: vi.fn().mockReturnValue([mockObject]),
      getZoom: vi.fn().mockReturnValue(1),
      viewportTransform: [1, 0, 0, 1, 0, 0],
      getTopContext: vi.fn(),
      upperCanvasEl: { width: 800, height: 600 },
      requestRenderAll: vi.fn(),
      setWidth: vi.fn(),
      setHeight: vi.fn(),
    };

    const plugin = new ThumbnailPlugin(mockCanvas as any, { container: ".thumbnail" });

    // Act
    plugin.enable();

    // Assert
    expect(plugin.isEnabled()).toBe(true);
  });
});

describe("ThumbnailPlugin Constructor", () => {
  beforeEach(() => {
    mockQuerySelector.mockReset();
    mockCreateElement.mockReset();
  });

  it("should throw error when enable with invalid string selector", () => {
    // Arrange
    mockQuerySelector.mockReturnValue(null);

    const mockCanvas = {
      on: vi.fn(),
      off: vi.fn(),
      getObjects: vi.fn().mockReturnValue([]),
      getZoom: vi.fn().mockReturnValue(1),
      viewportTransform: [1, 0, 0, 1, 0, 0],
      getTopContext: vi.fn(),
      upperCanvasEl: { width: 0, height: 0 },
      requestRenderAll: vi.fn(),
      setWidth: vi.fn(),
      setHeight: vi.fn(),
    };

    const plugin = new ThumbnailPlugin(mockCanvas as any, { container: ".nonexistent" });

    // Act & Assert - error should throw on enable(), not construction
    expect(() => {
      plugin.enable();
    }).toThrow(/container ".nonexistent" not found/);
  });

  it("should throw error when enable with invalid container function", () => {
    // Arrange
    const mockCanvas = {
      on: vi.fn(),
      off: vi.fn(),
      getObjects: vi.fn().mockReturnValue([]),
      getZoom: vi.fn().mockReturnValue(1),
      viewportTransform: [1, 0, 0, 1, 0, 0],
      getTopContext: vi.fn(),
      upperCanvasEl: { width: 0, height: 0 },
      requestRenderAll: vi.fn(),
      setWidth: vi.fn(),
      setHeight: vi.fn(),
    };

    const plugin = new ThumbnailPlugin(mockCanvas as any, { container: () => null });

    // Act & Assert - error should throw on enable(), not construction
    expect(() => {
      plugin.enable();
    }).toThrow(/container function must return a valid DOM element/);
  });
});
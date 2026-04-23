import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThumbnailPlugin } from "./thumbnailPlugin";

// Mock document for node environment
const mockQuerySelector = vi.fn();
const mockCreateElement = vi.fn(() => {
  const div = { className: "", style: {}, appendChild: vi.fn(), querySelector: vi.fn() };
  return div;
});
const mockDocument = {
  querySelector: mockQuerySelector,
  createElement: mockCreateElement,
};
Object.defineProperty(global, "document", { value: mockDocument, writable: true });

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

describe("ThumbnailPlugin Constructor", () => {
  beforeEach(() => {
    mockQuerySelector.mockReset();
    mockCreateElement.mockReset();
  });

  it("should throw error when container is invalid string selector", () => {
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

    // Act & Assert
    expect(() => {
      new ThumbnailPlugin(mockCanvas as any, { container: ".nonexistent" });
    }).toThrow(/container ".nonexistent" not found/);
  });

  it("should throw error when container function returns invalid", () => {
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

    // Act & Assert
    expect(() => {
      new ThumbnailPlugin(mockCanvas as any, { container: () => null });
    }).toThrow(/container function must return a valid DOM element/);
  });
});
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThumbnailPlugin } from "./thumbnailPlugin";

// Mock document for node environment
const mockQuerySelector = vi.fn();
const mockDocument = {
  querySelector: mockQuerySelector,
};
Object.defineProperty(global, "document", { value: mockDocument, writable: true });

describe("ThumbnailPlugin Constructor", () => {
  beforeEach(() => {
    mockQuerySelector.mockReset();
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
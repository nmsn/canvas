import { describe, expect, it, vi } from "vitest";

describe("ThumbnailPlugin Constructor", () => {
  it("should throw error when container is invalid string selector", () => {
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
      const { ThumbnailPlugin } = require("../thumbnailPlugin");
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
      const { ThumbnailPlugin } = require("../thumbnailPlugin");
      new ThumbnailPlugin(mockCanvas as any, { container: () => null });
    }).toThrow(/container function must return a valid DOM element/);
  });
});
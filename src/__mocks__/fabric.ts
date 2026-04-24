import { vi } from "vitest";

export const Canvas = vi.fn().mockImplementation(() => ({
  setWidth: vi.fn(),
  setHeight: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
}));

export const FabricObject = vi.fn();
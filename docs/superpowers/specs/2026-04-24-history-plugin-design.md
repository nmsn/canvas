# History Plugin Design

## Overview

A plugin that records canvas editing operations and provides undo/redo functionality, tightly integrated with Fabric.js event system.

## Core Concepts

**HistoryStack** — Manages history nodes and current pointer position.

```
[Node 0] ← [Node 1] ← [Node 2] ← [Node 3] ← ... → [pointer at 3]
                                                      ↑ undo
                                    redo ↓
```

Each change creates a new node and advances the pointer. Undo restores the previous node's state.

## API

```typescript
interface HistoryPluginOptions {
  maxHistorySize?: number;       // Default: 50
  mergeThresholdMs?: number;      // Default: 300ms
  onChange?: (canUndo: boolean, canRedo: boolean) => void;
}

interface HistoryPlugin {
  // Enable/disable
  enable(): void;
  disable(): void;
  isEnabled(): boolean;

  // Core operations
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
  clear(): void;

  // State queries
  getHistorySize(): number;
  getCurrentIndex(): number;
}
```

## Fabric.js Event Integration

| Event | Action |
|-------|--------|
| `object:added` | Record newly added object |
| `object:removed` | Record deleted object (full state) |
| `object:modified` | Record modified object state |

## Merge Strategy

When an object starts being modified (e.g., drag begins), set `isModifying = true`. All `object:modified` events within `mergeThresholdMs` window are merged into a single node. Marking is released when the final modification completes.

## Data Structure

```typescript
interface HistoryNode {
  id: string;
  timestamp: number;
  type: "add" | "remove" | "modify";
  objectId: string;              // Object ID
  objectState: SerializedObject; // Full serialized object state
}
```

## Implementation Notes

- Use `object.toObject()` for serialization (includes custom `data` properties)
- Use `Canvas.loadFromObject()` or `object.set()` + `object.setCoords()` for restoration
- For `object:added`, store the object's full serialized state for redo
- For `object:removed`, store the object's full serialized state for undo
- For `object:modified`, store the object's state after modification
- Object ID can be obtained from `object.data?.id` or generated via `fabric.util.objectId`

## TDD Approach

### Test File Location

```
src/app/plugins/utils/fabricPlugins/__tests__/historyPlugin.test.ts
```

### Test Structure

1. **Unit tests for HistoryStack logic** — No Fabric.js dependency, test the pure history management logic
2. **Integration tests with mocked Fabric.js** — Mock Canvas and FabricObject using the existing mock pattern (see `__mocks__/fabric.ts`)

### Key Test Cases

```typescript
// Unit tests
- "should push new node on add"
- "should pop node on remove"
- "should move pointer back on undo"
- "should move pointer forward on redo"
- "should not undo when at beginning"
- "should not redo when at end"
- "should trim history when max size exceeded"
- "should merge rapid modifications within threshold"
- "should not merge modifications beyond threshold"

// Integration tests
- "should call canvas.add() on undo of removed object"
- "should call canvas.remove() on undo of added object"
- "should restore object properties on undo of modified object"
```

### Mock Pattern

Follow the existing mock pattern in `__mocks__/fabric.ts`:

```typescript
// Example mock structure
const mockCanvas = {
  on: vi.fn(),
  off: vi.fn(),
  getObjects: vi.fn().mockReturnValue([]),
  add: vi.fn(),
  remove: vi.fn(),
  requestRenderAll: vi.fn(),
};

const mockFabricObject = {
  toObject: vi.fn().mockReturnValue({ id: 'test-id', type: 'rect' }),
  set: vi.fn(),
  setCoords: vi.fn(),
  data: { id: 'test-id' },
};
```

### Running Tests

```bash
pnpm vitest run src/app/plugins/utils/fabricPlugins/__tests__/historyPlugin.test.ts
```

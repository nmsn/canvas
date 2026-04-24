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

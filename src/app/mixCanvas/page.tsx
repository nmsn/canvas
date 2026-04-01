"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useCallback, type FC } from "react";
import { Canvas, type FabricObject } from "fabric";
import hljs from "highlight.js/lib/core";
import typescript from "highlight.js/lib/languages/typescript.js";
import "highlight.js/styles/github-dark.css";
import { getDrawFunctions } from "./func";
import {
  type FuncEntry,
  type CanvasSnippet,
  type Position,
} from "./registry";
import { generateAllCode, generateCompositionCode } from "./generator";

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 400;

hljs.registerLanguage("javascript", typescript);

/**
 * 页面属性接口
 */
type PageProps = Record<string, never>;

/**
 * Fabric.js 绘制计算页面组件
 */
const FabricCalcPage: FC<PageProps> = () => {
  // Canvas 引用
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<Canvas | null>(null);

  // 画布片段状态
  const [snippets, setSnippets] = useState<CanvasSnippet[]>([]);

  // 拖拽状态
  const [isDragging, setIsDragging] = useState(false);
  const [draggedFunction, setDraggedFunction] = useState<FuncEntry | null>(
    null,
  );
  const [copied, setCopied] = useState(false);

  // 组合模式状态
  const [isComposing, setIsComposing] = useState(false);
  const [selectedForCompose, setSelectedForCompose] = useState<string[]>([]);
  const [compositionName, setCompositionName] = useState("draw");
  const [compositionCode, setCompositionCode] = useState("");

  // 片段参数编辑状态
  const [editingSnippetId, setEditingSnippetId] = useState<string | null>(null);
  const [editingSnippetOriginal, setEditingSnippetOriginal] = useState<{ position: Position; params: Record<string, unknown> } | null>(null);
  const [editingParamsJson, setEditingParamsJson] = useState("");

  // 获取所有绘制函数
  const drawFunctions = getDrawFunctions();

  /**
   * 获取当前画布的代码（纯文本格式）
   */
  const getCurrentCodePlain = useCallback(() => {
    return generateAllCode(snippets);
  }, [snippets]);

  /**
   * 获取当前画布的代码（高亮格式）
   */
  const getCurrentCodeHighlighted = useCallback(() => {
    const code = getCurrentCodePlain();
    if (!code) return "";
    return hljs.highlight(code, { language: "javascript" }).value;
  }, [getCurrentCodePlain]);

  /**
   * 复制代码到剪贴板
   */
  const copyCodeToClipboard = useCallback(async () => {
    const code = getCurrentCodePlain();
    if (!code) return;

    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.error("复制失败:", err);
    }
  }, [getCurrentCodePlain]);

  /**
   * 复制组合代码到剪贴板
   */
  const copyCompositionCode = useCallback(async () => {
    if (!compositionCode) return;

    try {
      await navigator.clipboard.writeText(compositionCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.error("复制失败:", err);
    }
  }, [compositionCode]);

  /**
   * 执行绘制函数并记录
   */
  const executeDrawFunction = useCallback(
    (funcEntry: FuncEntry, position: Position, params: Record<string, unknown>) => {
      if (!fabricCanvasRef.current) return;

      // 合并 funcEntry.paramDefaults 中定义的默认值到 params
      const fullParams = { ...params };
      Object.entries(funcEntry.paramDefaults).forEach(([key, value]) => {
        if (!(key in fullParams)) {
          fullParams[key] = value;
        }
      });

      const fabricObject = funcEntry.execute(fabricCanvasRef.current, position, fullParams);

      // 创建片段记录
      const snippet: CanvasSnippet = {
        id: `${Date.now()}-${funcEntry.name}`,
        funcName: funcEntry.name,
        displayName: funcEntry.displayName,
        position,
        params: fullParams,
        fabricObject,
      };

      setSnippets((prev) => [...prev, snippet]);
    },
    [],
  );

  /**
   * 处理拖拽开始
   */
  const handleDragStart = useCallback((funcEntry: FuncEntry) => {
    setIsDragging(true);
    setDraggedFunction(funcEntry);
  }, []);

  /**
   * 处理拖拽结束
   */
  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    setDraggedFunction(null);
  }, []);

  /**
   * 处理画布拖拽放置
   */
  const handleCanvasDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();

      if (!draggedFunction || !canvasRef.current) return;

      const canvasRect = canvasRef.current.getBoundingClientRect();
      const dropX = Math.round(e.clientX - canvasRect.left);
      const dropY = Math.round(e.clientY - canvasRect.top);

      const position: Position = { x: dropX, y: dropY };
      executeDrawFunction(draggedFunction, position, {});
      handleDragEnd();
    },
    [draggedFunction, executeDrawFunction, handleDragEnd],
  );

  /**
   * 删除片段
   */
  const deleteSnippet = useCallback(
    (snippetId: string) => {
      const snippet = snippets.find((s) => s.id === snippetId);
      if (snippet && fabricCanvasRef.current) {
        if (Array.isArray(snippet.fabricObject)) {
          snippet.fabricObject.forEach((obj) =>
            fabricCanvasRef.current?.remove(obj),
          );
        } else {
          fabricCanvasRef.current.remove(snippet.fabricObject);
        }

        fabricCanvasRef.current.requestRenderAll();
        setSnippets((prev) => prev.filter((s) => s.id !== snippetId));

        // 如果在组合模式中，也从选中列表移除
        setSelectedForCompose((prev) => prev.filter((id) => id !== snippetId));
      }
    },
    [snippets],
  );

  /**
   * 更新片段参数（拖拽对象后）
   */
  const updateSnippetParams = useCallback((fabricObject: FabricObject) => {
    setSnippets((prev) =>
      prev.map((snippet) => {
        if (snippet.fabricObject === fabricObject) {
          // 只更新 position 的 x/y
          const updatedPosition: Position = {
            x: Math.round(fabricObject.left ?? snippet.position.x),
            y: Math.round(fabricObject.top ?? snippet.position.y),
          };
          return {
            ...snippet,
            position: updatedPosition,
          };
        }
        return snippet;
      }),
    );
  }, []);

  /**
   * 应用编辑后的参数到片段
   */
  const applyEditedParams = useCallback(
    (snippetId: string, newParams: Record<string, unknown>) => {
      if (!fabricCanvasRef.current) return;

      const snippet = snippets.find((s) => s.id === snippetId);
      if (!snippet) return;

      // 移除旧的 Fabric 对象
      if (Array.isArray(snippet.fabricObject)) {
        snippet.fabricObject.forEach((obj) =>
          fabricCanvasRef.current?.remove(obj)
        );
      } else {
        fabricCanvasRef.current?.remove(snippet.fabricObject);
      }

      // 重新执行绘制函数
      const funcEntry = drawFunctions.find((f) => f.name === snippet.funcName);
      if (!funcEntry) return;

      const newFabricObject = funcEntry.execute(fabricCanvasRef.current, snippet.position, newParams);

      fabricCanvasRef.current.requestRenderAll();

      // 更新 snippet
      setSnippets((prev) =>
        prev.map((s) =>
          s.id === snippetId
            ? { ...s, params: newParams, fabricObject: newFabricObject }
            : s
        )
      );

      setEditingSnippetId(null);
      setEditingSnippetOriginal(null);
    },
    [snippets, drawFunctions],
  );

  /**
   * 取消编辑
   */
  const cancelEditParams = useCallback(() => {
    // 取消时恢复原始 position 和 params
    if (editingSnippetId && editingSnippetOriginal) {
      setSnippets((prev) =>
        prev.map((s) =>
          s.id === editingSnippetId
            ? { ...s, position: editingSnippetOriginal.position, params: editingSnippetOriginal.params }
            : s
        )
      );
    }
    setEditingSnippetId(null);
    setEditingSnippetOriginal(null);
    setEditingParamsJson("");
  }, [editingSnippetId, editingSnippetOriginal]);

  /**
   * 清空画布
   */
  const clearCanvas = useCallback(() => {
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.clear();
      setSnippets([]);
      setSelectedForCompose([]);
      setIsComposing(false);
      setCompositionCode("");
      setCompositionName("draw");
      setEditingSnippetId(null);
      setEditingSnippetOriginal(null);
      setEditingParamsJson("");
    }
  }, []);

  /**
   * 切换组合模式
   */
  const toggleComposeMode = useCallback(() => {
    setIsComposing((prev) => !prev);
    setSelectedForCompose([]);
    setCompositionCode("");
    setCompositionName("draw");
    setEditingSnippetId(null);
    setEditingSnippetOriginal(null);
    setEditingParamsJson("");
  }, []);

  /**
   * 切换片段选中状态（用于组合）
   */
  const toggleSnippetSelection = useCallback((snippetId: string) => {
    setSelectedForCompose((prev) => {
      if (prev.includes(snippetId)) {
        return prev.filter((id) => id !== snippetId);
      }
      return [...prev, snippetId];
    });
  }, []);

  /**
   * 生成组合代码
   */
  const generateComposition = useCallback(() => {
    if (selectedForCompose.length < 2) {
      alert("请选择至少 2 个组件进行组合");
      return;
    }

    const name = compositionName.trim() || `drawCombo${Date.now()}`;

    // 按照选中顺序获取片段
    const selectedSnippets = selectedForCompose
      .map((id) => snippets.find((s) => s.id === id))
      .filter((s): s is CanvasSnippet => s !== undefined);

    const code = generateCompositionCode(name, name, selectedSnippets);
    setCompositionCode(code);
  }, [selectedForCompose, snippets, compositionName]);

  /**
   * 初始化 Fabric.js 画布
   */
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new Canvas(canvasRef.current, {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      backgroundColor: "#f8f9fa",
      selection: true,
    });
    fabricCanvasRef.current = canvas;

    // 对象修改事件
    const handleObjectModified = (e: { target?: FabricObject }) => {
      if (e.target) {
        updateSnippetParams(e.target);
      }
    };

    canvas.on("object:modified", handleObjectModified);

    return () => {
      canvas.off("object:modified", handleObjectModified);
      canvas?.dispose().catch((err) => console.log(err));
    };
  }, [updateSnippetParams]);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-center gap-4">
          <Link
            href="/"
            className="text-gray-600 transition-colors hover:text-gray-800"
          >
            ← 返回首页
          </Link>
        </div>
        <div className="mb-8">
          <h1 className="mb-4 text-3xl font-bold text-gray-800">
            Fabric.js 绘制计算器
          </h1>
          <p className="text-gray-600">
            拖拽组件到画布 → 生成代码 → 组合组件 → 复制代码到文件
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* 左侧：绘制函数列表 */}
          <div className="rounded-lg bg-white p-6 shadow-md lg:col-span-3">
            <h2 className="mb-4 text-xl font-semibold text-gray-700">组件库</h2>
            <div className="space-y-3">
              {drawFunctions.map((func) => (
                <div
                  key={func.name}
                  className="cursor-grab rounded-md border border-gray-200 bg-gray-50 p-3 transition-colors duration-200 hover:bg-gray-100 active:cursor-grabbing"
                  draggable
                  onDragStart={() => handleDragStart(func)}
                  onDragEnd={handleDragEnd}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-800">
                        {func.displayName}
                      </div>
                      <div className="font-mono text-xs text-gray-500">
                        {func.name}
                      </div>
                    </div>
                    <div className="text-gray-400">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                      </svg>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {isDragging && draggedFunction && (
              <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
                <div className="text-sm text-blue-800">
                  正在拖拽: {draggedFunction.displayName}
                </div>
              </div>
            )}

            <button
              onClick={clearCanvas}
              className="mt-6 w-full rounded-md bg-red-500 px-4 py-2 font-bold text-white transition-colors duration-200 hover:bg-red-600"
            >
              清空画布
            </button>
          </div>

          {/* 中间：画布 */}
          <div className="rounded-lg bg-white p-6 shadow-md lg:col-span-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-700">画布</h2>
              <button
                onClick={toggleComposeMode}
                className={`rounded-md px-4 py-2 text-sm font-medium transition-colors duration-200 ${
                  isComposing
                    ? "bg-purple-500 text-white hover:bg-purple-600"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                {isComposing ? "退出组合模式" : "进入组合模式"}
              </button>
            </div>
            <div
              className="overflow-hidden rounded-md border border-gray-300"
              onDrop={handleCanvasDrop}
              onDragOver={(e) => e.preventDefault()}
            >
              <canvas ref={canvasRef} />
            </div>

            {/* 组合模式提示 */}
            {isComposing && (
              <div className="mt-4 rounded-lg border border-purple-200 bg-purple-50 p-3">
                <div className="mb-2 text-sm text-purple-800">
                  组合模式：选择要组合的组件
                </div>
                <input
                  type="text"
                  placeholder="函数名 (如 drawMyCombo)"
                  value={compositionName}
                  onChange={(e) => setCompositionName(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
                <button
                  onClick={generateComposition}
                  disabled={selectedForCompose.length < 2}
                  className="mt-2 w-full rounded-md bg-purple-500 px-4 py-2 font-medium text-white transition-colors duration-200 hover:bg-purple-600 disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  生成组合代码 ({selectedForCompose.length} 个组件)
                </button>
              </div>
            )}
          </div>

          {/* 右侧：代码面板 */}
          <div className="rounded-lg bg-white p-6 shadow-lg lg:col-span-4">
            <h2 className="mb-4 text-xl font-bold text-gray-800">代码面板</h2>

            {/* 画布片段列表 */}
            {snippets.length > 0 && (
              <div className="mb-4">
                <h3 className="mb-2 text-sm font-medium text-gray-700">
                  画布组件
                </h3>
                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {snippets.map((snippet, index) => (
                    <div
                      key={snippet.id}
                      className={`rounded-md border ${
                        isComposing && selectedForCompose.includes(snippet.id)
                          ? "border-purple-500 bg-purple-50"
                          : "border-gray-200 bg-gray-50"
                      }`}
                    >
                      {/* 头部：基本信息 */}
                      <div
                        className="flex items-center justify-between p-2"
                        onClick={() =>
                          isComposing
                            ? toggleSnippetSelection(snippet.id)
                            : editingSnippetId === snippet.id
                              ? (setEditingSnippetId(null), setEditingSnippetOriginal(null), setEditingParamsJson(""))
                              : (setEditingSnippetId(snippet.id), setEditingSnippetOriginal({ position: snippet.position, params: snippet.params }), setEditingParamsJson(JSON.stringify(snippet.params, null, 2)))
                        }
                        style={{ cursor: isComposing ? "pointer" : "pointer" }}
                      >
                        <div className="flex items-center gap-2">
                          {isComposing && (
                            <input
                              type="checkbox"
                              checked={selectedForCompose.includes(snippet.id)}
                              onChange={(e) => {
                                e.stopPropagation();
                                toggleSnippetSelection(snippet.id);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="rounded border-gray-300"
                            />
                          )}
                          <div>
                            <div className="text-sm font-medium text-gray-800">
                              #{index + 1} {snippet.displayName}
                            </div>
                            <div className="text-xs text-gray-500">
                              {Object.entries(snippet.params)
                                .filter(([key]) => !["isRender"].includes(key))
                                .map(([key, value]) => (
                                  <span key={key} className="mr-2">
                                    {key}: {value === undefined ? "(未设置)" : String(value)}
                                  </span>
                                ))}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {!isComposing && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (editingSnippetId === snippet.id) {
                                  setEditingSnippetId(null);
                                  setEditingSnippetOriginal(null);
                                  setEditingParamsJson("");
                                } else {
                                  setEditingSnippetId(snippet.id);
                                  setEditingSnippetOriginal({ position: snippet.position, params: snippet.params });
                                  setEditingParamsJson(JSON.stringify(snippet.params, null, 2));
                                }
                              }}
                              className="text-xs text-blue-500 hover:text-blue-700"
                            >
                              {editingSnippetId === snippet.id ? "收起" : "编辑"}
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteSnippet(snippet.id);
                            }}
                            className="text-xs text-red-500 hover:text-red-700"
                          >
                            删除
                          </button>
                        </div>
                      </div>

                      {/* 编辑面板 */}
                      {editingSnippetId === snippet.id && (
                        <div className="border-t border-gray-200 p-2">
                          <textarea
                            value={editingParamsJson}
                            onChange={(e) => setEditingParamsJson(e.target.value)}
                            className="w-full rounded border border-gray-300 p-2 font-mono text-xs"
                            rows={6}
                            spellCheck={false}
                          />
                          <div className="mt-2 flex gap-2">
                            <button
                              onClick={() => {
                                try {
                                  const newParams = JSON.parse(editingParamsJson) as Record<string, unknown>;
                                  applyEditedParams(snippet.id, newParams);
                                } catch {
                                  alert("JSON 格式错误，请检查输入");
                                }
                              }}
                              className="flex-1 rounded bg-blue-500 px-3 py-1 text-xs text-white hover:bg-blue-600"
                            >
                              应用
                            </button>
                            <button
                              onClick={cancelEditParams}
                              className="flex-1 rounded bg-gray-300 px-3 py-1 text-xs text-gray-700 hover:bg-gray-400"
                            >
                              取消
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 当前代码 */}
            {snippets.length > 0 && !compositionCode && (
              <div className="mb-4">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-700">
                    当前代码
                  </h3>
                  <button
                    onClick={copyCodeToClipboard}
                    className="flex items-center gap-1 rounded bg-blue-500 px-3 py-1 text-xs text-white transition-colors duration-200 hover:bg-blue-600"
                  >
                    {copied ? "已复制" : "复制代码"}
                  </button>
                </div>
                <pre className="max-h-64 overflow-x-auto rounded bg-gray-800 p-3 text-xs text-white">
                  <code
                    dangerouslySetInnerHTML={{
                      __html: getCurrentCodeHighlighted(),
                    }}
                  />
                </pre>
              </div>
            )}

            {/* 组合代码 */}
            {compositionCode && (
              <div className="mb-4">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-700">
                    组合函数代码
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={copyCompositionCode}
                      className="rounded bg-purple-500 px-3 py-1 text-xs text-white transition-colors duration-200 hover:bg-purple-600"
                    >
                      {copied ? "已复制" : "复制代码"}
                    </button>
                    <button
                      onClick={() => setCompositionCode("")}
                      className="rounded bg-gray-500 px-3 py-1 text-xs text-white transition-colors duration-200 hover:bg-gray-600"
                    >
                      关闭
                    </button>
                  </div>
                </div>
                <div className="mb-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3">
                  <div className="text-sm text-yellow-800">
                    将以下代码复制到 func.tsx 中，即可在左侧组件库看到新组件
                  </div>
                </div>
                <pre className="max-h-64 overflow-x-auto rounded bg-gray-800 p-3 text-xs text-white">
                  <code
                    dangerouslySetInnerHTML={{
                      __html: hljs.highlight(compositionCode, {
                        language: "javascript",
                      }).value,
                    }}
                  />
                </pre>
              </div>
            )}

            {/* 空状态 */}
            {snippets.length === 0 && (
              <div className="py-8 text-center text-gray-500">
                <div className="mb-2 text-4xl">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="mx-auto h-12 w-12"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                    />
                  </svg>
                </div>
                <div>拖拽组件到画布生成代码</div>
              </div>
            )}

            {/* 统计信息 */}
            {snippets.length > 0 && (
              <div className="border-t border-gray-200 pt-4">
                <div className="text-sm text-gray-600">
                  总计: {snippets.length} 个组件
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FabricCalcPage;

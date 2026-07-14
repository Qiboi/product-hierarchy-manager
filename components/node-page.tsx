/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import clsx from "clsx";
import {
    Plus,
    Trash2,
    Pencil,
    ChevronRight,
    ChevronDown,
    Download,
    Upload,
    GripVertical,
    Loader2,
    Check,
    X,
    FolderTree,
} from "lucide-react";
import {
    DndContext,
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from "@dnd-kit/core";
import {
    SortableContext,
    useSortable,
    verticalListSortingStrategy,
    arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ---------- Types ----------
type FlatNode = {
    _id: string;
    name: string;
    parentId: string | null;
    order: number;
};

type NodeType = {
    id: string;
    name: string;
    children: NodeType[];
};

// ---------- Tree helpers ----------
function buildTree(flat: FlatNode[]): NodeType[] {
    const map = new Map<string, NodeType>();
    flat.forEach((f) => map.set(f._id, { id: f._id, name: f.name, children: [] }));

    const roots: NodeType[] = [];
    const sorted = [...flat].sort((a, b) => a.order - b.order);

    sorted.forEach((f) => {
        const node = map.get(f._id)!;
        if (f.parentId && map.has(f.parentId)) {
            map.get(f.parentId)!.children.push(node);
        } else if (!f.parentId) {
            roots.push(node);
        }
    });

    return roots;
}

function countNodes(tree: NodeType[]): number {
    return tree.reduce((acc, n) => acc + 1 + countNodes(n.children), 0);
}

function findParentAndSiblings(
    nodes: NodeType[],
    id: string,
    parentId: string | null = null
): { parentId: string | null; index: number; siblings: NodeType[] } | null {
    const idx = nodes.findIndex((n) => n.id === id);
    if (idx !== -1) return { parentId, index: idx, siblings: nodes };
    for (const n of nodes) {
        const found = findParentAndSiblings(n.children, id, n.id);
        if (found) return found;
    }
    return null;
}

// ---------- Sortable Node Component ----------
function TreeNode({
    node,
    depth,
    onAddChild,
    onDelete,
    onRename,
    expandedIds,
    toggleExpand,
}: {
    node: NodeType;
    depth: number;
    onAddChild: (parentId: string) => void;
    onDelete: (id: string, name: string) => void;
    onRename: (id: string, name: string) => void;
    expandedIds: Set<string>;
    toggleExpand: (id: string) => void;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: node.id,
    });

    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(node.name);
    const inputRef = useRef<HTMLInputElement>(null);

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const hasChildren = node.children.length > 0;
    const isExpanded = expandedIds.has(node.id);

    const depthColors = [
        "border-l-indigo-400",
        "border-l-sky-400",
        "border-l-emerald-400",
        "border-l-amber-400",
        "border-l-rose-400",
    ];
    const colorClass = depthColors[depth % depthColors.length];

    useEffect(() => {
        if (editing) inputRef.current?.focus();
    }, [editing]);

    useEffect(() => {
        setDraft(node.name);
    }, [node.name]);

    const commitEdit = () => {
        const trimmed = draft.trim();
        if (trimmed && trimmed !== node.name) onRename(node.id, trimmed);
        else setDraft(node.name);
        setEditing(false);
    };

    return (
        <div ref={setNodeRef} style={style} className={clsx("fade-in", isDragging && "opacity-40")}>
            <div
                className={clsx(
                    "group flex items-center gap-1.5 rounded-lg border border-transparent bg-white/60 hover:bg-white hover:border-gray-200 hover:shadow-sm transition-all py-1.5 pr-2",
                    "border-l-4",
                    colorClass
                )}
                style={{ marginLeft: depth * 22 }}
            >
                <button
                    {...attributes}
                    {...listeners}
                    className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 shrink-0 touch-none"
                    title="Geser untuk mengubah posisi"
                >
                    <GripVertical size={16} />
                </button>

                <button
                    onClick={() => hasChildren && toggleExpand(node.id)}
                    className={clsx(
                        "shrink-0 w-5 h-5 flex items-center justify-center rounded text-gray-400",
                        hasChildren && "hover:bg-gray-100 hover:text-gray-700"
                    )}
                >
                    {hasChildren ? (
                        isExpanded ? (
                            <ChevronDown size={15} />
                        ) : (
                            <ChevronRight size={15} />
                        )
                    ) : (
                        <span className="w-1 h-1 rounded-full bg-gray-300" />
                    )}
                </button>

                {editing ? (
                    <div className="flex items-center gap-1 flex-1">
                        <input
                            ref={inputRef}
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") commitEdit();
                                if (e.key === "Escape") {
                                    setDraft(node.name);
                                    setEditing(false);
                                }
                            }}
                            className="flex-1 text-sm px-2 py-0.5 rounded border border-indigo-300 outline-none focus:ring-2 focus:ring-indigo-200"
                        />
                        <button onClick={commitEdit} className="text-emerald-600 hover:bg-emerald-50 rounded p-1">
                            <Check size={14} />
                        </button>
                        <button
                            onClick={() => {
                                setDraft(node.name);
                                setEditing(false);
                            }}
                            className="text-gray-400 hover:bg-gray-100 rounded p-1"
                        >
                            <X size={14} />
                        </button>
                    </div>
                ) : (
                    <span
                        onDoubleClick={() => setEditing(true)}
                        className="flex-1 text-sm font-medium text-gray-800 truncate select-none"
                        title="Dobel klik untuk edit"
                    >
                        {node.name}
                        {hasChildren && (
                            <span className="ml-2 text-[10px] font-normal text-gray-400">
                                ({node.children.length})
                            </span>
                        )}
                    </span>
                )}

                {!editing && (
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                            onClick={() => onAddChild(node.id)}
                            className="p-1.5 rounded hover:bg-indigo-50 text-indigo-500"
                            title="Tambah sub-item"
                        >
                            <Plus size={14} />
                        </button>
                        <button
                            onClick={() => setEditing(true)}
                            className="p-1.5 rounded hover:bg-amber-50 text-amber-500"
                            title="Edit nama"
                        >
                            <Pencil size={13} />
                        </button>
                        <button
                            onClick={() => onDelete(node.id, node.name)}
                            className="p-1.5 rounded hover:bg-rose-50 text-rose-500"
                            title="Hapus"
                        >
                            <Trash2 size={13} />
                        </button>
                    </div>
                )}
            </div>

            {hasChildren && isExpanded && (
                <SortableContext items={node.children.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                    <div className="mt-0.5 space-y-0.5">
                        {node.children.map((child) => (
                            <TreeNode
                                key={child.id}
                                node={child}
                                depth={depth + 1}
                                onAddChild={onAddChild}
                                onDelete={onDelete}
                                onRename={onRename}
                                expandedIds={expandedIds}
                                toggleExpand={toggleExpand}
                            />
                        ))}
                    </div>
                </SortableContext>
            )}
        </div>
    );
}

// ---------- Main Page ----------
export default function NodeHierarchyPage() {
    const [tree, setTree] = useState<NodeType[]>([]);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

    const expandDefaults = (nodes: NodeType[]) => {
        const ids = new Set<string>();
        const collect = (list: NodeType[], depth: number) => {
            list.forEach((n) => {
                if (depth < 2) ids.add(n.id);
                collect(n.children, depth + 1);
            });
        };
        collect(nodes, 0);
        return ids;
    };

    const loadTree = useCallback(async (keepExpanded = true) => {
        try {
            setError(null);
            const res = await fetch("/api/nodes");
            if (!res.ok) throw new Error("Gagal memuat data dari server");
            const flat: FlatNode[] = await res.json();
            const built = buildTree(flat);
            setTree(built);
            if (!keepExpanded) setExpandedIds(expandDefaults(built));
        } catch (err) {
            setError(err instanceof Error ? err.message : "Terjadi kesalahan");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadTree(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const toggleExpand = useCallback((id: string) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }, []);

    // ---------- API-backed actions ----------
    const handleAddRoot = async () => {
        const name = prompt("Nama top level baru:");
        if (!name?.trim()) return;
        setSaving(true);
        try {
            const res = await fetch("/api/nodes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: name.trim(), parentId: null }),
            });
            if (!res.ok) throw new Error("Gagal menambah top level");
            await loadTree();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Gagal menambah data");
        } finally {
            setSaving(false);
        }
    };

    const handleAddChild = async (parentId: string) => {
        const name = prompt("Nama sub-item baru:");
        if (!name?.trim()) return;
        setSaving(true);
        try {
            const res = await fetch("/api/nodes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: name.trim(), parentId }),
            });
            if (!res.ok) throw new Error("Gagal menambah sub-item");
            setExpandedIds((prev) => new Set(prev).add(parentId));
            await loadTree();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Gagal menambah data");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Hapus "${name}" beserta seluruh sub-item di dalamnya?`)) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/nodes/${id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Gagal menghapus item");
            await loadTree();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Gagal menghapus data");
        } finally {
            setSaving(false);
        }
    };

    const handleRename = async (id: string, name: string) => {
        setSaving(true);
        try {
            const res = await fetch(`/api/nodes/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name }),
            });
            if (!res.ok) throw new Error("Gagal mengubah nama");
            await loadTree();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Gagal menyimpan perubahan");
        } finally {
            setSaving(false);
        }
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const activeInfo = findParentAndSiblings(tree, active.id as string);
        const overInfo = findParentAndSiblings(tree, over.id as string);
        if (!activeInfo || !overInfo) return;
        if (activeInfo.parentId !== overInfo.parentId) return; // hanya reorder antar-sibling

        const reordered = arrayMove(activeInfo.siblings, activeInfo.index, overInfo.index);
        const items = reordered.map((n, idx) => ({ id: n.id, order: idx }));

        // optimistic UI update
        setTree((prevTree) => {
            const clone = JSON.parse(JSON.stringify(prevTree)) as NodeType[];
            const target = activeInfo.parentId
                ? findParentAndSiblings(clone, activeInfo.parentId)?.siblings.find(
                    (n) => n.id === activeInfo.parentId
                )?.children
                : clone;
            // fallback: rebuild via same reorder on clone root/siblings list directly
            return prevTree; // actual visual reorder resolved after refetch below
        });

        setSaving(true);
        try {
            const res = await fetch("/api/nodes/reorder", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ items }),
            });
            if (!res.ok) throw new Error("Gagal menyimpan urutan baru");
            await loadTree();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Gagal menyimpan urutan");
        } finally {
            setSaving(false);
        }
    };

    // ---------- Export / Import ----------
    const handleExport = () => {
        const blob = new Blob([JSON.stringify(tree, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `product-hierarchy-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleImportClick = () => {
        if (!confirm("Import akan MENGGANTI seluruh data di database saat ini dengan isi file. Lanjutkan?")) {
            return;
        }
        fileInputRef.current?.click();
    };

    const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async () => {
            try {
                const parsed = JSON.parse(reader.result as string);
                if (!Array.isArray(parsed)) throw new Error("Format tidak valid");

                setSaving(true);
                const res = await fetch("/api/nodes/import", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ data: parsed }),
                });
                if (!res.ok) throw new Error("Gagal mengimpor data ke server");
                await loadTree(false);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Gagal membaca atau mengimpor file");
            } finally {
                setSaving(false);
            }
        };
        reader.readAsText(file);
        e.target.value = "";
    };

    const totalNodes = countNodes(tree);

    useEffect(() => {
        if (!search.trim()) return;
        const q = search.toLowerCase();
        const ids = new Set<string>();
        const walk = (nodes: NodeType[], ancestors: string[]) => {
            nodes.forEach((n) => {
                const matched = n.name.toLowerCase().includes(q);
                if (matched) ancestors.forEach((a) => ids.add(a));
                walk(n.children, [...ancestors, n.id]);
            });
        };
        walk(tree, []);
        setExpandedIds((prev) => new Set([...prev, ...ids]));
    }, [search, tree]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center text-gray-400 gap-2 text-sm">
                <Loader2 className="animate-spin" size={16} /> Memuat data dari database...
            </div>
        );
    }

    return (
        <div className="min-h-screen">
            {/* Header */}
            <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-gray-200">
                <div className="max-w-5xl mx-auto px-5 py-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                            <FolderTree size={18} />
                        </div>
                        <div>
                            <h1 className="text-base font-semibold text-gray-900 leading-tight">
                                Product Hierarchy Manager
                            </h1>
                            <p className="text-xs text-gray-400 leading-tight flex items-center gap-1">
                                {totalNodes} item total
                                {saving && (
                                    <span className="text-indigo-500 flex items-center gap-1">
                                        • <Loader2 className="animate-spin" size={10} /> menyimpan...
                                    </span>
                                )}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            placeholder="Cari item..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 w-40 sm:w-56"
                        />
                        <button
                            onClick={handleImportClick}
                            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                        >
                            <Upload size={14} /> Import
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="application/json"
                            className="hidden"
                            onChange={handleImportFile}
                        />
                        <button
                            onClick={handleExport}
                            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
                        >
                            <Download size={14} /> Export
                        </button>
                    </div>
                </div>
            </header>

            {/* Error banner */}
            {error && (
                <div className="max-w-5xl mx-auto px-5 pt-4">
                    <div className="flex items-center justify-between bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg px-4 py-2">
                        <span>{error}</span>
                        <button onClick={() => setError(null)} className="p-1 hover:bg-rose-100 rounded">
                            <X size={14} />
                        </button>
                    </div>
                </div>
            )}

            {/* Body */}
            <main className="max-w-5xl mx-auto px-5 py-6">
                <div className="flex items-center justify-between mb-4">
                    <p className="text-xs text-gray-400">
                        Drag ikon <GripVertical size={11} className="inline -mt-0.5" /> untuk mengubah urutan. Dobel klik nama untuk edit langsung. Semua perubahan tersimpan otomatis ke database.
                    </p>
                    <button
                        onClick={handleAddRoot}
                        className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-gray-900 text-white hover:bg-gray-800 shrink-0"
                    >
                        <Plus size={14} /> Tambah Top Level
                    </button>
                </div>

                <div className="bg-gray-50/50 border border-gray-200 rounded-xl p-4">
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={tree.map((n) => n.id)} strategy={verticalListSortingStrategy}>
                            <div className="space-y-0.5">
                                {tree.map((node) => (
                                    <TreeNode
                                        key={node.id}
                                        node={node}
                                        depth={0}
                                        onAddChild={handleAddChild}
                                        onDelete={handleDelete}
                                        onRename={handleRename}
                                        expandedIds={expandedIds}
                                        toggleExpand={toggleExpand}
                                    />
                                ))}
                            </div>
                        </SortableContext>
                    </DndContext>

                    {tree.length === 0 && (
                        <div className="text-center py-10 text-sm text-gray-400">
                            Belum ada data. Klik &quot;Tambah Top Level&quot; untuk mulai, atau import dari file JSON.
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
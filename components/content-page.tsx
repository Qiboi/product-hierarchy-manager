/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
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
    Layers,
    Image as ImageIcon,
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

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

// ---------- Types ----------
type FlatContent = {
    _id: string;
    title: string;
    slug: string;
    mediaFolder: string | null;
    description: string | null;
    imageUrls: string[];
    parentId: string | null;
    parentSlug: string | null;
    contentType: string;
    depth: number;
    order: number;
};

type ContentNode = {
    id: string;
    title: string;
    slug: string;
    mediaFolder: string | null;
    description: string | null;
    imageUrls: string[];
    contentType: string;
    depth: number;
    order: number;
    children: ContentNode[];
};

type UploadResponse = {
    urls?: Array<string | { url: string; filename?: string }>;
};

// ---------- Helpers ----------
function buildTree(flat: FlatContent[]): ContentNode[] {
    const map = new Map<string, ContentNode>();

    flat.forEach((f) =>
        map.set(f._id, {
            id: f._id,
            title: f.title,
            slug: f.slug,
            mediaFolder: f.mediaFolder,
            description: f.description,
            imageUrls: f.imageUrls ?? [],
            contentType: f.contentType,
            depth: f.depth,
            order: f.order,
            children: [],
        })
    );

    const roots: ContentNode[] = [];
    const sorted = [...flat].sort((a, b) => a.order - b.order);

    sorted.forEach((f) => {
        const node = map.get(f._id)!;
        if (f.parentId && map.has(f.parentId)) {
            map.get(f.parentId)!.children.push(node);
        } else if (!f.parentId) {
            roots.push(node);
        }
    });

    return sortTreeByOrder(roots);
}

type RootContentTypeFilter = "all" | "service" | "portfolio_category";
type RootSortMode = "order" | "title-asc" | "title-desc";

function sortTreeByOrder(nodes: ContentNode[]): ContentNode[] {
    return [...nodes]
        .sort((a, b) => a.order - b.order)
        .map((node) => ({
            ...node,
            children: sortTreeByOrder(node.children),
        }));
}

function getVisibleRoots(
    tree: ContentNode[],
    filter: RootContentTypeFilter,
    sortMode: RootSortMode
) {
    let roots = tree.filter((node) => {
        if (filter === "all") return true;
        return node.contentType === filter;
    });

    if (sortMode === "order") {
        roots = [...roots].sort((a, b) => a.order - b.order);
    }

    if (sortMode === "title-asc") {
        roots = [...roots].sort((a, b) => a.title.localeCompare(b.title, "id", { sensitivity: "base" }));
    }

    if (sortMode === "title-desc") {
        roots = [...roots].sort((a, b) => b.title.localeCompare(a.title, "id", { sensitivity: "base" }));
    }

    return roots;
}

function countNodes(tree: ContentNode[]): number {
    return tree.reduce((acc, n) => acc + 1 + countNodes(n.children), 0);
}

function findParentAndSiblings(
    nodes: ContentNode[],
    id: string,
    parentId: string | null = null
): { parentId: string | null; index: number; siblings: ContentNode[] } | null {
    const idx = nodes.findIndex((n) => n.id === id);
    if (idx !== -1) return { parentId, index: idx, siblings: nodes };
    for (const n of nodes) {
        const found = findParentAndSiblings(n.children, id, n.id);
        if (found) return found;
    }
    return null;
}

const TYPE_BADGE_STYLES: Record<string, string> = {
    service: "bg-indigo-100 text-indigo-700",
    service_category: "bg-sky-100 text-sky-700",
    service_detail: "bg-emerald-100 text-emerald-700",
};

const FALLBACK_BADGE_COLORS = [
    "bg-amber-100 text-amber-700",
    "bg-rose-100 text-rose-700",
    "bg-purple-100 text-purple-700",
    "bg-cyan-100 text-cyan-700",
    "bg-fuchsia-100 text-fuchsia-700",
];

function typeBadgeClass(type: string) {
    if (TYPE_BADGE_STYLES[type]) return TYPE_BADGE_STYLES[type];
    let hash = 0;
    for (let i = 0; i < type.length; i++) hash = (hash + type.charCodeAt(i)) % FALLBACK_BADGE_COLORS.length;
    return FALLBACK_BADGE_COLORS[hash];
}

// ---------- Sortable Node Component ----------
function ContentTreeNode({
    node,
    depth,
    onAddChild,
    onDelete,
    onOpenEdit,
    expandedIds,
    toggleExpand,
}: {
    node: ContentNode;
    depth: number;
    onAddChild: (parentId: string) => void;
    onDelete: (id: string, title: string) => void;
    onOpenEdit: (node: ContentNode) => void;
    expandedIds: Set<string>;
    toggleExpand: (id: string) => void;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: node.id,
    });

    const style = { transform: CSS.Transform.toString(transform), transition };
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

    return (
        <div ref={setNodeRef} style={style} className={clsx("fade-in", isDragging && "opacity-40")}>
            <div
                className={clsx(
                    "group flex items-start gap-1.5 rounded-lg border border-transparent bg-white/60 hover:bg-white hover:border-gray-200 hover:shadow-sm transition-all py-1.5 pr-2",
                    "border-l-4",
                    colorClass
                )}
                style={{ marginLeft: depth * 22 }}
            >
                <button
                    {...attributes}
                    {...listeners}
                    className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 shrink-0 touch-none mt-1"
                    title="Geser untuk mengubah posisi"
                >
                    <GripVertical size={16} />
                </button>

                <button
                    onClick={() => hasChildren && toggleExpand(node.id)}
                    className={clsx(
                        "shrink-0 w-5 h-5 mt-1 flex items-center justify-center rounded text-gray-400",
                        hasChildren && "hover:bg-gray-100 hover:text-gray-700"
                    )}
                >
                    {hasChildren ? (
                        isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />
                    ) : (
                        <span className="w-1 h-1 rounded-full bg-gray-300" />
                    )}
                </button>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span
                            className="text-sm font-medium text-gray-800 truncate select-none"
                            title={node.title}
                        >
                            {node.title}
                        </span>

                        <span
                            className={clsx(
                                "text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide shrink-0",
                                typeBadgeClass(node.contentType)
                            )}
                            title={node.contentType}
                        >
                            {node.contentType}
                        </span>

                        {hasChildren && (
                            <span className="text-[10px] text-gray-400 shrink-0">({node.children.length})</span>
                        )}
                    </div>

                    <div className="mt-0.5 flex flex-wrap items-center gap-2">
                        <span className="text-[11px] text-gray-400 font-mono select-none">/{node.slug}</span>

                        {node.mediaFolder && (
                            <span className="text-[11px] text-gray-500">
                                folder: <span className="font-mono">{node.mediaFolder}</span>
                            </span>
                        )}

                        {node.description ? (
                            <span className="text-[11px] text-gray-500 truncate max-w-[320px]">
                                {node.description}
                            </span>
                        ) : null}

                        {node.imageUrls?.length ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-gray-500">
                                <ImageIcon size={12} />
                                {node.imageUrls.length} gambar
                            </span>
                        ) : null}
                    </div>
                </div>

                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity mt-1">
                    <button
                        onClick={() => onAddChild(node.id)}
                        className="p-1.5 rounded hover:bg-indigo-50 text-indigo-500"
                        title="Tambah sub-item"
                    >
                        <Plus size={14} />
                    </button>
                    <button
                        onClick={() => onOpenEdit(node)}
                        className="p-1.5 rounded hover:bg-amber-50 text-amber-500"
                        title="Edit detail konten"
                    >
                        <Pencil size={13} />
                    </button>
                    <button
                        onClick={() => onDelete(node.id, node.title)}
                        className="p-1.5 rounded hover:bg-rose-50 text-rose-500"
                        title="Hapus"
                    >
                        <Trash2 size={13} />
                    </button>
                </div>
            </div>

            {hasChildren && isExpanded && (
                <SortableContext items={node.children.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                    <div className="mt-0.5 space-y-0.5">
                        {node.children.map((child) => (
                            <ContentTreeNode
                                key={child.id}
                                node={child}
                                depth={depth + 1}
                                onAddChild={onAddChild}
                                onDelete={onDelete}
                                onOpenEdit={onOpenEdit}
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
export default function ContentHierarchyPage() {
    const [tree, setTree] = useState<ContentNode[]>([]);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState("");

    const [rootContentTypeFilter, setRootContentTypeFilter] = useState<RootContentTypeFilter>("all");
    const [rootSortMode, setRootSortMode] = useState<RootSortMode>("order");

    const fileInputRef = useRef<HTMLInputElement>(null);

    // edit modal
    const [editOpen, setEditOpen] = useState(false);
    const [editingNode, setEditingNode] = useState<ContentNode | null>(null);
    const [editTitle, setEditTitle] = useState("");
    const [editSlug, setEditSlug] = useState("");
    const [editMediaFolder, setEditMediaFolder] = useState("");
    const [editContentType, setEditContentType] = useState("");
    const [editDescription, setEditDescription] = useState("");
    const [editImageUrls, setEditImageUrls] = useState<string[]>([]);
    const [editUploading, setEditUploading] = useState(false);
    const [editSaving, setEditSaving] = useState(false);
    const [editError, setEditError] = useState<string | null>(null);
    const editImageInputRef = useRef<HTMLInputElement>(null);

    const visibleRoots = useMemo(() => {
        return getVisibleRoots(tree, rootContentTypeFilter, rootSortMode);
    }, [tree, rootContentTypeFilter, rootSortMode]);

    const canDragRoot = rootContentTypeFilter === "all" && rootSortMode === "order";

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

    const expandDefaults = (nodes: ContentNode[]) => {
        const ids = new Set<string>();
        const collect = (list: ContentNode[], depth: number) => {
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
            const res = await fetch("/api/contents");
            if (!res.ok) throw new Error("Gagal memuat data dari server");
            const flat: FlatContent[] = await res.json();
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

    const runAction = async (fn: () => Promise<Response>) => {
        setSaving(true);
        try {
            const res = await fn();
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || "Aksi gagal dijalankan");
            }
            await loadTree(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Terjadi kesalahan");
        } finally {
            setSaving(false);
        }
    };

    const handleAddRoot = () => {
        const title = prompt("Judul top level baru (mis. Service):");
        if (!title?.trim()) return;
        runAction(() =>
            fetch("/api/contents", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: title.trim(), parentId: null }),
            })
        );
    };

    const handleAddChild = (parentId: string) => {
        const title = prompt("Judul sub-item baru:");
        if (!title?.trim()) return;
        setExpandedIds((prev) => new Set(prev).add(parentId));
        runAction(() =>
            fetch("/api/contents", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: title.trim(), parentId }),
            })
        );
    };

    const handleDelete = (id: string, title: string) => {
        if (!confirm(`Hapus "${title}" beserta seluruh sub-item di dalamnya?`)) return;
        runAction(() => fetch(`/api/contents/${id}`, { method: "DELETE" }));
    };

    const handleDragEnd = (event: DragEndEvent) => {
        if (!canDragRoot) return;

        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const activeInfo = findParentAndSiblings(tree, active.id as string);
        const overInfo = findParentAndSiblings(tree, over.id as string);
        if (!activeInfo || !overInfo) return;
        if (activeInfo.parentId !== overInfo.parentId) return;

        const reordered = arrayMove(activeInfo.siblings, activeInfo.index, overInfo.index);
        const items = reordered.map((n, idx) => ({ id: n.id, order: idx }));

        runAction(() =>
            fetch("/api/contents/reorder", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ items }),
            })
        );
    };

    const handleExport = () => {
        const stripForExport = (nodes: ContentNode[]): any[] =>
            nodes.map((n) => ({
                title: n.title,
                slug: n.slug,
                mediaFolder: n.mediaFolder,
                description: n.description,
                imageUrls: n.imageUrls,
                contentType: n.contentType,
                children: stripForExport(n.children),
            }));

        const blob = new Blob([JSON.stringify(stripForExport(tree), null, 2)], {
            type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `content-hierarchy-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleImportClick = () => {
        if (!confirm("Import akan MENGGANTI seluruh data content hierarchy saat ini. Lanjutkan?")) return;
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
                await runAction(() =>
                    fetch("/api/contents/import", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ data: parsed }),
                    })
                );
                setExpandedIds(expandDefaults(buildTree(await (await fetch("/api/contents")).json())));
            } catch (err) {
                setError(err instanceof Error ? err.message : "Gagal membaca atau mengimpor file");
            }
        };
        reader.readAsText(file);
        e.target.value = "";
    };

    const openEditModal = (node: ContentNode) => {
        setEditingNode(node);
        setEditTitle(node.title);
        setEditSlug(node.slug);
        setEditMediaFolder(node.mediaFolder ?? node.slug);
        setEditContentType(node.contentType);
        setEditDescription(node.description ?? "");
        setEditImageUrls(node.imageUrls ?? []);
        setEditError(null);
        setEditOpen(true);
    };

    const closeEditModal = () => {
        setEditOpen(false);
        setEditingNode(null);
        setEditError(null);
        setEditUploading(false);
        setEditSaving(false);
    };

    const normalizeUploadUrls = (payload: UploadResponse): string[] => {
        const raw = payload.urls ?? [];
        return raw
            .map((item) => (typeof item === "string" ? item : item?.url))
            .filter((item): item is string => typeof item === "string" && item.trim().length > 0);
    };

    const uploadEditImages = async (files: FileList | File[]) => {
        const selected = Array.from(files);
        if (selected.length === 0) return;

        setEditUploading(true);
        setEditError(null);

        try {
            const folder = (editMediaFolder.trim() || editSlug.trim() || editingNode?.slug || "content").trim();

            const formData = new FormData();
            formData.append("folder", folder);
            selected.forEach((file) => formData.append("files", file));

            const res = await fetch("/api/uploads/content-images", {
                method: "POST",
                body: formData,
            });

            const body: UploadResponse & { error?: string } = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(body.error || "Gagal upload gambar");
            }

            const urls = normalizeUploadUrls(body);
            setEditImageUrls((prev) => Array.from(new Set([...prev, ...urls])));
        } catch (err) {
            setEditError(err instanceof Error ? err.message : "Gagal upload gambar");
        } finally {
            setEditUploading(false);
            if (editImageInputRef.current) editImageInputRef.current.value = "";
        }
    };

    const removeEditImage = (url: string) => {
        setEditImageUrls((prev) => prev.filter((item) => item !== url));
    };

    const saveEditModal = async () => {
        if (!editingNode) return;

        setEditSaving(true);
        setEditError(null);

        try {
            const payload = {
                title: editTitle,
                slug: editSlug,
                mediaFolder: editMediaFolder.trim() || editSlug.trim() || editingNode.slug,
                contentType: editContentType,
                description: editDescription,
                imageUrls: editImageUrls,
            };

            const res = await fetch(`/api/contents/${editingNode.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const raw = await res.text();
            if (!res.ok) {
                let message = raw || "Gagal menyimpan perubahan";
                try {
                    const parsed = JSON.parse(raw);
                    message = parsed.error || message;
                } catch {
                    // ignore
                }
                throw new Error(message);
            }

            await loadTree(true);
            closeEditModal();
        } catch (err) {
            setEditError(err instanceof Error ? err.message : "Gagal menyimpan perubahan");
        } finally {
            setEditSaving(false);
        }
    };

    const totalNodes = countNodes(tree);

    useEffect(() => {
        if (!search.trim()) return;
        const q = search.toLowerCase();
        const ids = new Set<string>();

        const walk = (nodes: ContentNode[], ancestors: string[]) => {
            nodes.forEach((n) => {
                const matched =
                    n.title.toLowerCase().includes(q) ||
                    n.slug.toLowerCase().includes(q) ||
                    n.contentType.toLowerCase().includes(q) ||
                    (n.description ?? "").toLowerCase().includes(q) ||
                    (n.mediaFolder ?? "").toLowerCase().includes(q);

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
                <Loader2 className="animate-spin" size={16} /> Memuat data content hierarchy...
            </div>
        );
    }

    return (
        <div className="min-h-screen">
            <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-gray-200">
                <div className="max-w-5xl mx-auto px-5 py-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center text-white">
                            <Layers size={18} />
                        </div>
                        <div>
                            <h1 className="text-base font-semibold text-gray-900 leading-tight">
                                Content Hierarchy Manager
                            </h1>
                            <p className="text-xs text-gray-400 leading-tight flex items-center gap-1">
                                {totalNodes} content total
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
                            placeholder="Cari judul/slug/tipe/deskripsi/folder..."
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
                            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                        >
                            <Download size={14} /> Export
                        </button>
                    </div>
                </div>
            </header>

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

            <main className="max-w-5xl mx-auto px-5 py-6">
                <div className="flex items-center justify-between mb-4">
                    <p className="text-xs text-gray-400">
                        Edit detail konten dibuka lewat modal. Tree tetap ringkas agar lebih nyaman saat data sudah banyak.
                    </p>
                    <button
                        onClick={handleAddRoot}
                        className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-gray-900 text-white hover:bg-gray-800 shrink-0"
                    >
                        <Plus size={14} /> Tambah Top Level
                    </button>
                </div>

                <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-gray-500">Filter Root Content Type</label>
                            <select
                                value={rootContentTypeFilter}
                                onChange={(e) => setRootContentTypeFilter(e.target.value as RootContentTypeFilter)}
                                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                            >
                                <option value="all">All</option>
                                <option value="service">Service</option>
                                <option value="portfolio_category">Portfolio Category</option>
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-gray-500">Sort Root</label>
                            <select
                                value={rootSortMode}
                                onChange={(e) => setRootSortMode(e.target.value as RootSortMode)}
                                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                            >
                                <option value="order">Order</option>
                                <option value="title-asc">Title A-Z</option>
                                <option value="title-desc">Title Z-A</option>
                            </select>
                        </div>
                    </div>

                    <div className="text-xs text-gray-400 lg:text-right">
                        Menampilkan {visibleRoots.length} root dari {tree.length} root.
                        {!canDragRoot && (
                            <div className="mt-1 text-amber-600">
                                Drag reorder aktif hanya saat filter = All dan sort = Order.
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-gray-50/50 border border-gray-200 rounded-xl p-4">
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={visibleRoots.map((n) => n.id)} strategy={verticalListSortingStrategy}>
                            <div className="space-y-0.5">
                                {visibleRoots.map((node) => (
                                    <ContentTreeNode
                                        key={node.id}
                                        node={node}
                                        depth={0}
                                        onAddChild={handleAddChild}
                                        onDelete={handleDelete}
                                        onOpenEdit={openEditModal}
                                        expandedIds={expandedIds}
                                        toggleExpand={toggleExpand}
                                    />
                                ))}
                            </div>
                        </SortableContext>
                    </DndContext>

                    {tree.length === 0 && (
                        <div className="text-center py-10 text-sm text-gray-400">
                            Belum ada content. Klik &quot;Tambah Top Level&quot; untuk mulai, atau import dari file JSON.
                        </div>
                    )}
                </div>
            </main>

            <Dialog open={editOpen} onOpenChange={(open) => (open ? setEditOpen(true) : closeEditModal())}>
                <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Edit Content</DialogTitle>
                        <DialogDescription>
                            Ubah judul, slug, folder media, deskripsi, dan gambar untuk konten ini.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        {editError && (
                            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                                {editError}
                            </div>
                        )}

                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Title</label>
                                <Input
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    placeholder="Judul konten"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Slug</label>
                                <Input
                                    value={editSlug}
                                    onChange={(e) => setEditSlug(e.target.value)}
                                    placeholder="slug-konten"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Media Folder</label>
                                <Input
                                    value={editMediaFolder}
                                    onChange={(e) => setEditMediaFolder(e.target.value)}
                                    placeholder="folder media"
                                />
                                <p className="text-xs text-gray-400">
                                    Folder ini dipakai untuk upload gambar. Sebaiknya tetap stabil walau slug berubah.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Content Type</label>
                                <Input
                                    value={editContentType}
                                    onChange={(e) => setEditContentType(e.target.value)}
                                    placeholder="service / category / detail"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Description</label>
                            <Textarea
                                value={editDescription}
                                onChange={(e) => setEditDescription(e.target.value)}
                                placeholder="Deskripsi konten..."
                                rows={5}
                            />
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center justify-between gap-3">
                                <label className="text-sm font-medium">Images</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        ref={editImageInputRef}
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        className="hidden"
                                        onChange={(e) => {
                                            if (e.target.files?.length) {
                                                uploadEditImages(e.target.files);
                                            }
                                        }}
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => editImageInputRef.current?.click()}
                                        disabled={editUploading}
                                    >
                                        {editUploading ? "Uploading..." : "Upload Images"}
                                    </Button>
                                </div>
                            </div>

                            {editImageUrls.length > 0 ? (
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                    {editImageUrls.map((url) => (
                                        <div key={url} className="group relative overflow-hidden rounded-lg border bg-white">
                                            <img src={url} alt="" className="h-28 w-full object-cover" />
                                            <button
                                                type="button"
                                                onClick={() => removeEditImage(url)}
                                                className="absolute right-2 top-2 rounded-full bg-black/70 p-1 text-white hover:bg-black"
                                                title="Hapus gambar"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="rounded-lg border border-dashed px-4 py-6 text-sm text-gray-400">
                                    Belum ada gambar. Upload beberapa file sekaligus untuk menambah image konten.
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="mt-6 flex items-center justify-end gap-2">
                        <Button type="button" variant="outline" onClick={closeEditModal} disabled={editSaving}>
                            Batal
                        </Button>
                        <Button type="button" onClick={saveEditModal} disabled={editSaving || editUploading}>
                            {editSaving ? "Menyimpan..." : "Simpan"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { nanoid } from "nanoid";
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
  Save,
  X,
  Check,
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
type NodeType = {
  id: string;
  name: string;
  children: NodeType[];
};

// ---------- Initial Data (seeded from your hierarchy) ----------
const initialData: NodeType[] = [
  {
    id: nanoid(),
    name: "Service",
    children: [
      {
        id: nanoid(),
        name: "Field of Play",
        children: [
          {
            id: nanoid(),
            name: "Indoor",
            children: ["Flooring Gym", "Lapangan Vinyl", "Lapangan PU", "Lapangan Parquette"].map(
              (n) => ({ id: nanoid(), name: n, children: [] })
            ),
          },
          {
            id: nanoid(),
            name: "Outdoor",
            children: [
              "Lapangan Akrilik",
              "Rumput Sintetis",
              "Rumput Natural",
              "Lapangan Padel",
              "Lapangan Clay",
              "Jogging Track",
              "Track",
              "Interlock",
            ].map((n) => ({ id: nanoid(), name: n, children: [] })),
          },
          {
            id: nanoid(),
            name: "Playground",
            children: ["Wet Play", "Rumput Sintetis", "Dry Play"].map((n) => ({
              id: nanoid(),
              name: n,
              children: [],
            })),
          },
          {
            id: nanoid(),
            name: "Sport Building",
            children: ["Sport Tent", "Airdome"].map((n) => ({
              id: nanoid(),
              name: n,
              children: [],
            })),
          },
        ],
      },
      {
        id: nanoid(),
        name: "Equipment & Technology",
        children: [
          {
            id: nanoid(),
            name: "Seating",
            children: ["Telescopic", "Stadium", "Bleachers", "Auditorium"].map((n) => ({
              id: nanoid(),
              name: n,
              children: [],
            })),
          },
          {
            id: nanoid(),
            name: "Divider Curtain",
            children: ["Manual", "Electric"].map((n) => ({ id: nanoid(), name: n, children: [] })),
          },
          {
            id: nanoid(),
            name: "Equipment Sport & Gym",
            children: ["Outdoor Fitness", "Playground", "Sports", "Gymnastic Equipment"].map(
              (n) => ({ id: nanoid(), name: n, children: [] })
            ),
          },
          {
            id: nanoid(),
            name: "Technology",
            children: [
              "Video Scoreboard",
              "Timing System",
              "System Clock",
              "LED Perimeter",
              "Electronic Sub-Board",
              "Digital Scoreboard",
            ].map((n) => ({ id: nanoid(), name: n, children: [] })),
          },
        ],
      },
      {
        id: nanoid(),
        name: "Event Management",
        children: [
          {
            id: nanoid(),
            name: "Game Management System",
            children: [{ id: nanoid(), name: "Playpro", children: [] }],
          },
          {
            id: nanoid(),
            name: "Sports Event Organizer",
            children: [{ id: nanoid(), name: "Event Organizer", children: [] }],
          },
          {
            id: nanoid(),
            name: "Rental Equipment",
            children: [{ id: nanoid(), name: "Seiko", children: [] }],
          },
          {
            id: nanoid(),
            name: "Timing & Scoring System Operator",
            children: [{ id: nanoid(), name: "Timing & Scoring Operator", children: [] }],
          },
        ],
      },
    ],
  },
];

// ---------- Tree helpers (immutable ops) ----------
function updateNode(tree: NodeType[], id: string, updater: (n: NodeType) => NodeType): NodeType[] {
  return tree.map((n) => {
    if (n.id === id) return updater(n);
    if (n.children.length) return { ...n, children: updateNode(n.children, id, updater) };
    return n;
  });
}

function removeNode(tree: NodeType[], id: string): NodeType[] {
  return tree
    .filter((n) => n.id !== id)
    .map((n) => ({ ...n, children: removeNode(n.children, id) }));
}

function addChild(tree: NodeType[], parentId: string, child: NodeType): NodeType[] {
  return tree.map((n) => {
    if (n.id === parentId) return { ...n, children: [...n.children, child] };
    if (n.children.length) return { ...n, children: addChild(n.children, parentId, child) };
    return n;
  });
}

function reorderSiblings(
  tree: NodeType[],
  parentId: string | null,
  oldIndex: number,
  newIndex: number
): NodeType[] {
  if (parentId === null) {
    return arrayMove(tree, oldIndex, newIndex);
  }
  return tree.map((n) => {
    if (n.id === parentId) {
      return { ...n, children: arrayMove(n.children, oldIndex, newIndex) };
    }
    if (n.children.length) {
      return { ...n, children: reorderSiblings(n.children, parentId, oldIndex, newIndex) };
    }
    return n;
  });
}

function countNodes(tree: NodeType[]): number {
  return tree.reduce((acc, n) => acc + 1 + countNodes(n.children), 0);
}

// ---------- Sortable Node Component ----------
function TreeNode({
  node,
  depth,
  parentId,
  onAddChild,
  onDelete,
  onRename,
  expandedIds,
  toggleExpand,
}: {
  node: NodeType;
  depth: number;
  parentId: string | null;
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
                parentId={node.id}
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
export default function Page() {
  const [tree, setTree] = useState<NodeType[]>(initialData);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [dirty, setDirty] = useState(false);
  const [search, setSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Expand all root + first level by default
  useEffect(() => {
    const ids = new Set<string>();
    const collect = (nodes: NodeType[], depth: number) => {
      nodes.forEach((n) => {
        if (depth < 2) ids.add(n.id);
        collect(n.children, depth + 1);
      });
    };
    collect(tree, 0);
    setExpandedIds(ids);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Warn before leaving/reloading if unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const markDirty = () => setDirty(true);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const handleAddRoot = () => {
    const name = prompt("Nama top level baru:");
    if (!name?.trim()) return;
    setTree((t) => [...t, { id: nanoid(), name: name.trim(), children: [] }]);
    markDirty();
  };

  const handleAddChild = (parentId: string) => {
    const name = prompt("Nama sub-item baru:");
    if (!name?.trim()) return;
    setTree((t) => addChild(t, parentId, { id: nanoid(), name: name.trim(), children: [] }));
    setExpandedIds((prev) => new Set(prev).add(parentId));
    markDirty();
  };

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Hapus "${name}" beserta seluruh sub-item di dalamnya?`)) return;
    setTree((t) => removeNode(t, id));
    markDirty();
  };

  const handleRename = (id: string, name: string) => {
    setTree((t) => updateNode(t, id, (n) => ({ ...n, name })));
    markDirty();
  };

  // Build parent map for drag reorder (only supports reordering within same parent)
  const findParentAndIndex = (
    nodes: NodeType[],
    id: string,
    parentId: string | null = null
  ): { parentId: string | null; index: number; siblings: NodeType[] } | null => {
    const idx = nodes.findIndex((n) => n.id === id);
    if (idx !== -1) return { parentId, index: idx, siblings: nodes };
    for (const n of nodes) {
      const found = findParentAndIndex(n.children, id, n.id);
      if (found) return found;
    }
    return null;
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeInfo = findParentAndIndex(tree, active.id as string);
    const overInfo = findParentAndIndex(tree, over.id as string);
    if (!activeInfo || !overInfo) return;
    if (activeInfo.parentId !== overInfo.parentId) return; // only reorder among siblings

    setTree((t) => reorderSiblings(t, activeInfo.parentId, activeInfo.index, overInfo.index));
    markDirty();
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
    setDirty(false);
  };

  const handleImportClick = () => {
    if (dirty && !confirm("Perubahan belum disimpan. Lanjutkan import dan buang perubahan saat ini?")) {
      return;
    }
    fileInputRef.current?.click();
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        if (!Array.isArray(parsed)) throw new Error("Format tidak valid");
        setTree(parsed);
        setDirty(false);
        const ids = new Set<string>();
        const collect = (nodes: NodeType[], depth: number) => {
          nodes.forEach((n) => {
            if (depth < 2) ids.add(n.id);
            collect(n.children, depth + 1);
          });
        };
        collect(parsed, 0);
        setExpandedIds(ids);
      } catch {
        alert("Gagal membaca file. Pastikan format JSON valid hasil export dari aplikasi ini.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleMarkSaved = () => {
    setDirty(false);
  };

  const totalNodes = countNodes(tree);

  // simple filter: expand + highlight matches (visual only, non-destructive)
  const filteredTree = tree; // full tree always rendered; search only affects expand behavior below

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

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
              <p className="text-xs text-gray-400 leading-tight">
                {totalNodes} item total {dirty && <span className="text-amber-500">• belum disimpan</span>}
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
            <button
              onClick={handleMarkSaved}
              disabled={!dirty}
              className={clsx(
                "flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border",
                dirty
                  ? "border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                  : "border-gray-100 text-gray-300 cursor-not-allowed"
              )}
              title="Tandai sebagai sudah disimpan (tanpa export)"
            >
              <Save size={14} /> Tandai Tersimpan
            </button>
          </div>
        </div>
      </header>

      {/* Body */}
      <main className="max-w-5xl mx-auto px-5 py-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs text-gray-400">
            Drag ikon <GripVertical size={11} className="inline -mt-0.5" /> untuk mengubah urutan. Dobel klik nama untuk edit langsung.
          </p>
          <button
            onClick={handleAddRoot}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-gray-900 text-white hover:bg-gray-800"
          >
            <Plus size={14} /> Tambah Top Level
          </button>
        </div>

        <div className="bg-gray-50/50 border border-gray-200 rounded-xl p-4">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={filteredTree.map((n) => n.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-0.5">
                {filteredTree.map((node) => (
                  <TreeNode
                    key={node.id}
                    node={node}
                    depth={0}
                    parentId={null}
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

          {filteredTree.length === 0 && (
            <div className="text-center py-10 text-sm text-gray-400">
              Belum ada data. Klik &quot;Tambah Top Level&quot; untuk mulai.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
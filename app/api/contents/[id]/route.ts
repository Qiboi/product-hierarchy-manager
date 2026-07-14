import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { ContentModel } from "@/models/Content";
import { slugify } from "@/lib/slugify";

function normalizeImageUrls(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean);
}

async function getAllDescendantIds(id: string): Promise<string[]> {
    const children = await ContentModel.find({ parentId: id }).select("_id").lean();
    let ids: string[] = children.map((c) => String(c._id));
    for (const child of children) {
        const nested = await getAllDescendantIds(String(child._id));
        ids = ids.concat(nested);
    }
    return ids;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    await connectDB();
    const body = await req.json();

    const { id } = await params;

    const current = await ContentModel.findById(id);
    if (!current) return NextResponse.json({ error: "Content tidak ditemukan" }, { status: 404 });

    const update: Record<string, unknown> = {};

    if (typeof body.title === "string") update.title = body.title.trim();

    if (typeof body.description === "string") {
        const desc = body.description.trim();
        update.description = desc || null;
    }

    if (Array.isArray(body.imageUrls)) {
        update.imageUrls = body.imageUrls
            .filter((item: unknown): item is string => typeof item === "string")
            .map((item: string) => item.trim())
            .filter(Boolean);
    }

    if (typeof body.mediaFolder === "string" && body.mediaFolder.trim()) {
        update.mediaFolder = slugify(body.mediaFolder);
    }

    if (typeof body.contentType === "string") {
        const trimmed = body.contentType.trim();
        if (!trimmed) {
            return NextResponse.json({ error: "Tipe konten tidak boleh kosong" }, { status: 400 });
        }
        update.contentType = trimmed;
    }

    if (typeof body.slug === "string") {
        const newSlug = slugify(body.slug);
        const clash = await ContentModel.findOne({
            _id: { $ne: current._id },
            parentId: current.parentId,
            slug: newSlug,
        });
        if (clash) {
            return NextResponse.json(
                { error: `Slug "${newSlug}" sudah dipakai di level yang sama` },
                { status: 409 }
            );
        }
        update.slug = newSlug;
    }

    if (typeof body.order === "number") update.order = body.order;

    const updated = await ContentModel.findByIdAndUpdate(id, update, { new: true });

    if (update.slug) {
        await ContentModel.updateMany(
            { parentId: String(current._id) },
            { parentSlug: update.slug as string }
        );
    }

    return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    await connectDB();

    const { id } = await params;

    const descendantIds = await getAllDescendantIds(id);
    await ContentModel.deleteMany({ _id: { $in: [id, ...descendantIds] } });
    return NextResponse.json({ success: true });
}
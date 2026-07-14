import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { ContentModel } from "@/models/Content";
import { slugify } from "@/lib/slugify";
import { typeForDepth } from "@/lib/contentType";

function normalizeImageUrls(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean);
}

export async function GET() {
    await connectDB();
    const contents = await ContentModel.find().sort({ order: 1 }).lean();
    return NextResponse.json(contents);
}

export async function POST(req: NextRequest) {
    await connectDB();
    const body = await req.json();
    const { title, parentId } = body;
    let slug = body.slug;

    if (!title?.trim()) {
        return NextResponse.json({ error: "Title wajib diisi" }, { status: 400 });
    }

    slug = slug?.trim() ? slugify(slug) : slugify(title);

    let depth = 0;
    let parentSlug: string | null = null;

    if (parentId) {
        const parent = await ContentModel.findById(parentId);
        if (!parent) {
            return NextResponse.json({ error: "Parent tidak ditemukan" }, { status: 404 });
        }
        depth = parent.depth + 1;
        parentSlug = parent.slug;
    }

    const existing = await ContentModel.findOne({ parentId: parentId ?? null, slug });
    if (existing) {
        return NextResponse.json(
            { error: `Slug "${slug}" sudah dipakai di level yang sama` },
            { status: 409 }
        );
    }

    const siblingCount = await ContentModel.countDocuments({ parentId: parentId ?? null });

    const contentType =
        typeof body.contentType === "string" && body.contentType.trim()
            ? body.contentType.trim()
            : typeForDepth(depth);

    const description =
        typeof body.description === "string" ? body.description.trim() : null;

    const imageUrls = normalizeImageUrls(body.imageUrls);

    const content = await ContentModel.create({
        title: title.trim(),
        slug,
        description: description || null,
        imageUrls,
        parentId: parentId ?? null,
        parentSlug,
        contentType,
        depth,
        order: siblingCount,
    });

    return NextResponse.json(content, { status: 201 });
}
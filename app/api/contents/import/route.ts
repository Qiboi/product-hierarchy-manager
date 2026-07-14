import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { ContentModel } from "@/models/Content";
import { slugify } from "@/lib/slugify";
import { typeForDepth } from "@/lib/contentType";

interface ImportNode {
    title: string;
    slug?: string;
    description?: string;
    imageUrls?: string[];
    children: ImportNode[];
}

function normalizeImageUrls(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean);
}

export async function POST(req: NextRequest) {
    await connectDB();
    const { data }: { data: ImportNode[] } = await req.json();

    await ContentModel.deleteMany({});

    async function insertTree(
        nodes: ImportNode[],
        parentId: string | null,
        parentSlug: string | null,
        depth: number
    ) {
        for (let i = 0; i < nodes.length; i++) {
            const n = nodes[i];
            const slug = n.slug?.trim() ? slugify(n.slug) : slugify(n.title);

            const created = await ContentModel.create({
                title: n.title,
                slug,
                description: typeof n.description === "string" ? n.description.trim() || null : null,
                imageUrls: normalizeImageUrls(n.imageUrls),
                parentId,
                parentSlug,
                contentType: typeForDepth(depth),
                depth,
                order: i,
            });

            if (n.children?.length) {
                await insertTree(n.children, String(created._id), slug, depth + 1);
            }
        }
    }

    await insertTree(data, null, null, 0);
    return NextResponse.json({ success: true });
}
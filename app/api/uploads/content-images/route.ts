import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { slugify } from "@/lib/slugify";

export const runtime = "nodejs";

const STORAGE_ROOT = path.join(process.cwd(), "storage", "uploads");
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function mimeToExt(mime: string) {
    switch (mime) {
        case "image/jpeg":
            return ".jpg";
        case "image/png":
            return ".png";
        case "image/webp":
            return ".webp";
        case "image/gif":
            return ".gif";
        default:
            return "";
    }
}

async function getNextFilename(dir: string, folderSlug: string, ext: string) {
    await fs.mkdir(dir, { recursive: true });

    let index = 1;
    while (true) {
        const filename = `${folderSlug}-${index}${ext}`;
        const fullPath = path.join(dir, filename);

        try {
            await fs.access(fullPath);
            index += 1;
        } catch {
            return { filename, fullPath };
        }
    }
}

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();

        const folderRaw = formData.get("folder");
        const folderSlug =
            typeof folderRaw === "string" && folderRaw.trim()
                ? slugify(folderRaw)
                : "content";

        const files = formData
            .getAll("files")
            .filter((item): item is File => item instanceof File);

        if (files.length === 0) {
            return NextResponse.json({ error: "Tidak ada file yang diupload" }, { status: 400 });
        }

        const dir = path.join(STORAGE_ROOT, folderSlug);
        await fs.mkdir(dir, { recursive: true });

        const urls: { url: string; filename: string }[] = [];

        for (const file of files) {
            if (!ALLOWED_MIME.has(file.type)) {
                return NextResponse.json(
                    { error: `Format file tidak didukung: ${file.type}` },
                    { status: 400 }
                );
            }

            const ext = mimeToExt(file.type) || path.extname(file.name) || ".jpg";
            const { filename, fullPath } = await getNextFilename(dir, folderSlug, ext);

            const bytes = await file.arrayBuffer();
            await fs.writeFile(fullPath, Buffer.from(bytes));

            urls.push({
                filename,
                url: `/api/media/uploads/${folderSlug}/${filename}`,
            });
        }

        return NextResponse.json({ urls });
    } catch (error) {
        console.error("[UPLOAD] error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Upload gagal" },
            { status: 500 }
        );
    }
}
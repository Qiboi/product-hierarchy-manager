import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";

export const runtime = "nodejs";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "contents");
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

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const files = formData
            .getAll("files")
            .filter((item): item is File => item instanceof File);

        if (files.length === 0) {
            return NextResponse.json({ error: "Tidak ada file yang diupload" }, { status: 400 });
        }

        await fs.mkdir(UPLOAD_DIR, { recursive: true });

        const urls: string[] = [];

        for (const file of files) {
            if (!ALLOWED_MIME.has(file.type)) {
                return NextResponse.json(
                    { error: `Format file tidak didukung: ${file.type}` },
                    { status: 400 }
                );
            }

            const ext = mimeToExt(file.type) || path.extname(file.name) || ".jpg";
            const filename = `${Date.now()}-${crypto.randomUUID()}${ext}`;
            const filepath = path.join(UPLOAD_DIR, filename);

            const bytes = await file.arrayBuffer();
            await fs.writeFile(filepath, Buffer.from(bytes));

            urls.push(`/uploads/contents/${filename}`);
        }

        return NextResponse.json({ urls });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Upload gagal" },
            { status: 500 }
        );
    }
}
import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { slugify } from "@/lib/slugify";

export const runtime = "nodejs";

const ALLOWED_MIME = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
]);

function mimeToExt(mime: string) {
    switch (mime) {
        case "image/jpeg":
            return "jpg";
        case "image/png":
            return "png";
        case "image/webp":
            return "webp";
        case "image/gif":
            return "gif";
        default:
            return "jpg";
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

        if (!files.length) {
            return NextResponse.json(
                { error: "Tidak ada file yang diupload" },
                { status: 400 }
            );
        }

        const urls: { filename: string; url: string }[] = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];

            if (!ALLOWED_MIME.has(file.type)) {
                return NextResponse.json(
                    {
                        error: `Format file tidak didukung: ${file.type}`,
                    },
                    { status: 400 }
                );
            }

            const ext = mimeToExt(file.type);

            const filename = `${folderSlug}/${folderSlug}-${Date.now()}-${i + 1}.${ext}`;

            const blob = await put(filename, file, {
                access: "public",
                addRandomSuffix: false,
            });

            urls.push({
                filename,
                url: blob.url,
            });
        }

        return NextResponse.json({
            urls,
        });
    } catch (err) {
        console.error("[UPLOAD]", err);

        return NextResponse.json(
            {
                error:
                    err instanceof Error
                        ? err.message
                        : "Upload gagal",
            },
            {
                status: 500,
            }
        );
    }
}
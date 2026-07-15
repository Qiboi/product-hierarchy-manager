import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import sharp from "sharp";
import { slugify } from "@/lib/slugify";

export const runtime = "nodejs";

const ALLOWED_MIME = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
]);

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB — batas akhir setelah kompresi
const MAX_DIMENSION = 2000; // lebar/tinggi maksimal dalam px

function buildFolderPath(folderRaw: FormDataEntryValue | null): string {
    if (typeof folderRaw !== "string" || !folderRaw.trim()) {
        return "content";
    }
    const segments = folderRaw
        .split("/")
        .map((seg) => slugify(seg))
        .filter(Boolean);
    return segments.length ? segments.join("/") : "content";
}

/**
 * Semua gambar dikonversi ke WebP untuk efisiensi ukuran,
 * kecuali GIF (dibiarkan apa adanya agar animasi tidak rusak).
 */
async function compressImage(
    buffer: Buffer,
    mime: string
): Promise<{ buffer: Buffer; mime: string; ext: string }> {
    if (mime === "image/gif") {
        return { buffer, mime: "image/gif", ext: "gif" };
    }

    const out = await sharp(buffer)
        .resize({
            width: MAX_DIMENSION,
            height: MAX_DIMENSION,
            fit: "inside",
            withoutEnlargement: true,
        })
        .webp({ quality: 80 })
        .toBuffer();

    return { buffer: out, mime: "image/webp", ext: "webp" };
}

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();

        const folderRaw = formData.get("folder");
        const folderPath = buildFolderPath(folderRaw);
        const filePrefix = folderPath.split("/").pop() || "content";

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
                    { error: `Format file tidak didukung: ${file.type}` },
                    { status: 400 }
                );
            }

            const originalBuffer = Buffer.from(await file.arrayBuffer());

            let processed;
            try {
                processed = await compressImage(originalBuffer, file.type);
            } catch (err) {
                console.error("[UPLOAD] compress error:", err);
                return NextResponse.json(
                    { error: `File "${file.name}" gagal diproses — kemungkinan file rusak atau bukan gambar valid` },
                    { status: 400 }
                );
            }

            if (processed.buffer.length > MAX_FILE_SIZE) {
                return NextResponse.json(
                    {
                        error: `File "${file.name}" masih terlalu besar setelah dikompresi (${(processed.buffer.length / (1024 * 1024)).toFixed(1)}MB). Coba gunakan gambar dengan resolusi lebih kecil.`,
                    },
                    { status: 400 }
                );
            }

            const filename = `${folderPath}/${filePrefix}-${Date.now()}-${i + 1}.${processed.ext}`;

            const blob = await put(filename, processed.buffer, {
                access: "public",
                addRandomSuffix: false,
                contentType: processed.mime,
            });

            urls.push({
                filename,
                url: blob.url,
            });
        }

        return NextResponse.json({ urls });
    } catch (err) {
        console.error("[UPLOAD]", err);

        return NextResponse.json(
            {
                error: err instanceof Error ? err.message : "Upload gagal",
            },
            { status: 500 }
        );
    }
}
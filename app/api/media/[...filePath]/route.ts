import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { lookup as lookupMime } from "mime-types";

export const runtime = "nodejs";

const STORAGE_ROOT = path.join(process.cwd(), "storage");

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ filePath: string[] }> }
) {
    try {
        const { filePath } = await params;

        const safePath = filePath.filter(Boolean);
        const fullPath = path.join(STORAGE_ROOT, ...safePath);

        const data = await fs.readFile(fullPath);
        const contentType = lookupMime(fullPath) || "application/octet-stream";

        return new NextResponse(data, {
            status: 200,
            headers: {
                "Content-Type": contentType.toString(),
                "Cache-Control": "public, max-age=31536000, immutable",
            },
        });
    } catch (error) {
        console.error("[MEDIA] error:", error);
        return NextResponse.json({ error: "File tidak ditemukan" }, { status: 404 });
    }
}
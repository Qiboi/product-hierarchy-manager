import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { ContentModel } from "@/models/Content";

interface ReorderItem {
    id: string;
    order: number;
}

export async function POST(req: NextRequest) {
    await connectDB();

    const body = await req.json();
    const items: ReorderItem[] = body.items;

    if (!Array.isArray(items) || items.length === 0) {
        return NextResponse.json(
            { error: "Data reorder tidak valid" },
            { status: 400 }
        );
    }

    // Validasi setiap item punya id dan order yang valid
    for (const item of items) {
        if (typeof item.id !== "string" || typeof item.order !== "number") {
            return NextResponse.json(
                { error: "Setiap item harus memiliki id dan order yang valid" },
                { status: 400 }
            );
        }
    }

    try {
        await Promise.all(
            items.map((item) =>
                ContentModel.findByIdAndUpdate(item.id, { order: item.order })
            )
        );

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("[REORDER]", err);
        return NextResponse.json(
            {
                error: err instanceof Error ? err.message : "Gagal menyimpan urutan",
            },
            { status: 500 }
        );
    }
}
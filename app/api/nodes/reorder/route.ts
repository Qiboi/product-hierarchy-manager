import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { NodeModel } from "@/models/Node";

export async function POST(req: NextRequest) {
    await connectDB();
    const { items } = await req.json(); // [{ id, order }, ...]

    await Promise.all(
        items.map((item: { id: string; order: number }) =>
            NodeModel.findByIdAndUpdate(item.id, { order: item.order })
        )
    );

    return NextResponse.json({ success: true });
}
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { NodeModel } from "@/models/Node";

export async function GET() {
    await connectDB();
    const nodes = await NodeModel.find().sort({ order: 1 }).lean();
    return NextResponse.json(nodes);
}

export async function POST(req: NextRequest) {
    await connectDB();
    const body = await req.json();
    const { name, parentId } = body;

    if (!name?.trim()) {
        return NextResponse.json({ error: "Nama wajib diisi" }, { status: 400 });
    }

    const siblingCount = await NodeModel.countDocuments({ parentId: parentId ?? null });

    const node = await NodeModel.create({
        name: name.trim(),
        parentId: parentId ?? null,
        order: siblingCount,
    });

    return NextResponse.json(node, { status: 201 });
}
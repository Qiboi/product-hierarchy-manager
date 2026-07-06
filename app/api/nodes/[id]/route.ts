import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { NodeModel } from "@/models/Node";

async function getAllDescendantIds(id: string): Promise<string[]> {
    const children = await NodeModel.find({ parentId: id }).select("_id").lean();
    let ids: string[] = children.map((c) => String(c._id));
    for (const child of children) {
        const nested = await getAllDescendantIds(String(child._id));
        ids = ids.concat(nested);
    }
    return ids;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
    await connectDB();
    const body = await req.json();
    const update: Record<string, unknown> = {};

    if (typeof body.name === "string") update.name = body.name.trim();
    if (typeof body.order === "number") update.order = body.order;
    if (body.parentId !== undefined) update.parentId = body.parentId;

    const node = await NodeModel.findByIdAndUpdate(params.id, update, { new: true });
    if (!node) return NextResponse.json({ error: "Node tidak ditemukan" }, { status: 404 });

    return NextResponse.json(node);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
    await connectDB();
    const descendantIds = await getAllDescendantIds(params.id);
    await NodeModel.deleteMany({ _id: { $in: [params.id, ...descendantIds] } });
    return NextResponse.json({ success: true });
}
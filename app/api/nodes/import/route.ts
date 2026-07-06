import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { NodeModel } from "@/models/Node";

interface ImportNode {
    name: string;
    children: ImportNode[];
}

export async function POST(req: NextRequest) {
    await connectDB();
    const { data }: { data: ImportNode[] } = await req.json();

    await NodeModel.deleteMany({});

    async function insertTree(nodes: ImportNode[], parentId: string | null) {
        for (let i = 0; i < nodes.length; i++) {
            const created = await NodeModel.create({
                name: nodes[i].name,
                parentId,
                order: i,
            });
            if (nodes[i].children?.length) {
                await insertTree(nodes[i].children, String(created._id));
            }
        }
    }

    await insertTree(data, null);
    return NextResponse.json({ success: true });
}
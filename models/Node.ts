import mongoose, { Schema, Document, Model } from "mongoose";

export interface INode extends Document {
    name: string;
    parentId: string | null;
    order: number;
    createdAt: Date;
    updatedAt: Date;
}

const NodeSchema = new Schema<INode>(
    {
        name: { type: String, required: true, trim: true },
        parentId: { type: String, default: null, index: true },
        order: { type: Number, required: true, default: 0 },
    },
    { timestamps: true }
);

NodeSchema.index({ parentId: 1, order: 1 });

export const NodeModel: Model<INode> =
    mongoose.models.Node || mongoose.model<INode>("Node", NodeSchema);
import mongoose, { Schema, Document, Model } from "mongoose";

export interface IContent extends Document {
    title: string;
    slug: string;
    mediaFolder: string | null;
    description: string | null;
    imageUrls: string[];
    parentId: string | null;
    parentSlug: string | null;
    contentType: string;
    depth: number;
    order: number;
}

const ContentSchema = new Schema<IContent>(
    {
        title: { type: String, required: true, trim: true },
        slug: { type: String, required: true, trim: true },
        mediaFolder: { type: String, default: null, index: true },

        description: { type: String, default: null, trim: true },
        imageUrls: { type: [String], default: [] },

        parentId: { type: String, default: null, index: true },
        parentSlug: { type: String, default: null },
        contentType: { type: String, required: true },
        depth: { type: Number, required: true, default: 0 },
        order: { type: Number, required: true, default: 0 },
    },
    { timestamps: true }
);

// Unik hanya jika contentType + parentId + slug sama
ContentSchema.index({ contentType: 1, parentId: 1, slug: 1 }, { unique: true });
ContentSchema.index({ parentId: 1, order: 1 });

export const ContentModel: Model<IContent> =
    mongoose.models.Content || mongoose.model<IContent>("Content", ContentSchema);
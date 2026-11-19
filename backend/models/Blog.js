import mongoose from "mongoose";

const blogSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 4, maxlength: 140 },
    slug: { type: String, required: true, unique: true, index: true },
    content: { type: String, required: true, minlength: 30 },
    excerpt: { type: String, required: true, maxlength: 300 },
    coverImage: { type: String, default: "" },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    tags: [{ type: String, trim: true, maxlength: 30 }],
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    status: { type: String, enum: ["draft", "published"], default: "draft", index: true },
  },
  { timestamps: true },
);

blogSchema.index({ title: "text", content: "text", excerpt: "text", tags: "text" });
blogSchema.index({ status: 1, createdAt: -1 });
export default mongoose.model("Blog", blogSchema);

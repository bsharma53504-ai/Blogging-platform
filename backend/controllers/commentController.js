import Blog from "../models/Blog.js";
import Comment from "../models/Comment.js";
import asyncHandler from "../middleware/asyncHandler.js";

export const listComments = asyncHandler(async (req, res) => {
  const blog = await Blog.findOne({ slug: req.params.slug, status: "published" }).select("_id");
  if (!blog) return res.status(404).json({ message: "Story not found." });
  const comments = await Comment.find({ blog: blog._id }).populate("user", "name profileImage").sort({ createdAt: -1 });
  res.json({ comments });
});

export const createComment = asyncHandler(async (req, res) => {
  const blog = await Blog.findOne({ slug: req.params.slug, status: "published" }).select("_id");
  if (!blog) return res.status(404).json({ message: "Story not found." });
  if (typeof req.body.text !== "string" || !req.body.text.trim()) return res.status(400).json({ message: "Comment text is required." });
  const comment = await Comment.create({ blog: blog._id, user: req.user._id, text: req.body.text.trim() });
  res.status(201).json({ comment: await comment.populate("user", "name profileImage") });
});

export const deleteComment = asyncHandler(async (req, res) => {
  const comment = await Comment.findById(req.params.id);
  if (!comment) return res.status(404).json({ message: "Comment not found." });
  if (String(comment.user) !== String(req.user._id) && req.user.role !== "admin") return res.status(403).json({ message: "You can only delete your own comments." });
  await comment.deleteOne();
  res.json({ message: "Comment deleted." });
});

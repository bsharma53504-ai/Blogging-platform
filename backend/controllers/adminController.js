import User from "../models/User.js";
import Blog from "../models/Blog.js";
import Comment from "../models/Comment.js";
import asyncHandler from "../middleware/asyncHandler.js";
import { publicUser } from "../utils/token.js";

export const dashboardStats = asyncHandler(async (req, res) => {
  const [users, blogs, published, drafts, comments] = await Promise.all([
    User.countDocuments(),
    Blog.countDocuments(),
    Blog.countDocuments({ status: "published" }),
    Blog.countDocuments({ status: "draft" }),
    Comment.countDocuments(),
  ]);
  res.json({ stats: { users, blogs, published, drafts, comments } });
});

export const listUsers = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
  const [users, total] = await Promise.all([User.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit), User.countDocuments()]);
  res.json({ users: users.map(publicUser), pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

export const listAllBlogs = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
  const filter = req.query.status && req.query.status !== "all" ? { status: req.query.status } : {};
  const [blogs, total] = await Promise.all([
    Blog.find(filter).populate("author", "name profileImage").populate("category", "name").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Blog.countDocuments(filter),
  ]);
  res.json({ blogs, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

export const updateUserRole = asyncHandler(async (req, res) => {
  if (String(req.user._id) === req.params.id) return res.status(400).json({ message: "You cannot change your own role." });
  const { role } = req.body;
  if (!["user", "admin"].includes(role)) return res.status(400).json({ message: "Role must be user or admin." });
  const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true });
  if (!user) return res.status(404).json({ message: "User not found." });
  res.json({ user: publicUser(user) });
});

export const deleteUser = asyncHandler(async (req, res) => {
  if (String(req.user._id) === req.params.id) return res.status(400).json({ message: "You cannot delete your own account from admin tools." });
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: "User not found." });
  const blogs = await Blog.find({ author: user._id }).select("_id");
  await Promise.all([
    Blog.deleteMany({ author: user._id }),
    Blog.updateMany({ likes: user._id }, { $pull: { likes: user._id } }),
    Comment.deleteMany({ $or: [{ user: user._id }, { blog: { $in: blogs.map((blog) => blog._id) } }] }),
    user.deleteOne(),
  ]);
  res.json({ message: "User and their content deleted." });
});

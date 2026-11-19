import Blog from "../models/Blog.js";
import Comment from "../models/Comment.js";
import asyncHandler from "../middleware/asyncHandler.js";
import { uniqueSlug } from "../utils/slug.js";

const authorFields = "name profileImage";
const populateBlog = (query) => query.populate("author", authorFields).populate("category", "name");

export const listBlogs = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const maxLimit = req.query.mine === "true" ? 100 : 24;
  const limit = Math.min(maxLimit, Math.max(1, Number.parseInt(req.query.limit, 10) || 9));
  const filter = {};
  if (req.query.adminAll === "true" && req.user?.role === "admin") {
    if (req.query.status && req.query.status !== "all") filter.status = req.query.status;
  } else if (req.query.mine === "true") {
    if (!req.user) return res.status(401).json({ message: "Sign in to view your stories." });
    filter.author = req.user._id;
    if (req.query.status && req.query.status !== "all") filter.status = req.query.status;
    else filter.status = { $in: ["draft", "published"] };
  } else {
    filter.status = "published";
  }
  if (req.query.category) filter.category = req.query.category;
  if (req.query.search?.trim()) {
    const escaped = req.query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { title: { $regex: escaped, $options: "i" } },
      { excerpt: { $regex: escaped, $options: "i" } },
      { content: { $regex: escaped, $options: "i" } },
      { tags: { $regex: escaped, $options: "i" } },
    ];
  }
  const sort = req.query.sort === "oldest" ? { createdAt: 1 } : { createdAt: -1 };
  const [blogs, total] = await Promise.all([
    populateBlog(Blog.find(filter).sort(sort).skip((page - 1) * limit).limit(limit)),
    Blog.countDocuments(filter),
  ]);
  res.json({ blogs, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

export const getBlog = asyncHandler(async (req, res) => {
  const blog = await populateBlog(Blog.findOne({ slug: req.params.slug }));
  if (!blog || (blog.status !== "published" && req.user?.role !== "admin" && String(blog.author._id) !== String(req.user?._id))) {
    return res.status(404).json({ message: "This story could not be found." });
  }
  res.json({ blog });
});

export const createBlog = asyncHandler(async (req, res) => {
  const { title, content, excerpt, coverImage, category, tags, status } = req.body;
  if (!title?.trim() || !content?.trim() || !excerpt?.trim() || !category) {
    return res.status(400).json({ message: "Title, content, excerpt, and category are required." });
  }
  if (!["draft", "published"].includes(status || "draft")) return res.status(400).json({ message: "Status must be draft or published." });
  const blog = await Blog.create({
    title: title.trim(),
    slug: await uniqueSlug(title, Blog),
    content: content.trim(),
    excerpt: excerpt.trim(),
    coverImage: coverImage || "",
    category,
    author: req.user._id,
    tags: Array.isArray(tags) ? tags.map((tag) => String(tag).trim()).filter(Boolean).slice(0, 10) : [],
    status: status || "draft",
  });
  res.status(201).json({ blog: await populateBlog(Blog.findById(blog._id)) });
});

export const updateBlog = asyncHandler(async (req, res) => {
  const blog = await Blog.findById(req.params.id);
  if (!blog) return res.status(404).json({ message: "Story not found." });
  if (String(blog.author) !== String(req.user._id) && req.user.role !== "admin") return res.status(403).json({ message: "You can only edit your own stories." });
  const allowed = ["title", "content", "excerpt", "coverImage", "category", "tags", "status"];
  for (const key of allowed) if (req.body[key] !== undefined) blog[key] = req.body[key];
  if (req.body.title) blog.slug = await uniqueSlug(req.body.title, Blog, blog._id);
  if (!["draft", "published"].includes(blog.status)) return res.status(400).json({ message: "Status must be draft or published." });
  await blog.save();
  res.json({ blog: await populateBlog(Blog.findById(blog._id)) });
});

export const deleteBlog = asyncHandler(async (req, res) => {
  const blog = await Blog.findById(req.params.id);
  if (!blog) return res.status(404).json({ message: "Story not found." });
  if (String(blog.author) !== String(req.user._id) && req.user.role !== "admin") return res.status(403).json({ message: "You can only delete your own stories." });
  await Promise.all([blog.deleteOne(), Comment.deleteMany({ blog: blog._id })]);
  res.json({ message: "Story deleted." });
});

export const toggleLike = asyncHandler(async (req, res) => {
  const blog = await Blog.findOne({ slug: req.params.slug, status: "published" });
  if (!blog) return res.status(404).json({ message: "Story not found." });
  const liked = blog.likes.some((id) => String(id) === String(req.user._id));
  if (liked) blog.likes.pull(req.user._id);
  else blog.likes.addToSet(req.user._id);
  await blog.save();
  res.json({ likes: blog.likes.length, liked: !liked });
});

export const relatedBlogs = asyncHandler(async (req, res) => {
  const blog = await Blog.findOne({ slug: req.params.slug, status: "published" });
  if (!blog) return res.status(404).json({ message: "Story not found." });
  const blogs = await populateBlog(Blog.find({ category: blog.category, status: "published", _id: { $ne: blog._id } }).sort({ createdAt: -1 }).limit(3));
  res.json({ blogs });
});

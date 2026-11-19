import Category from "../models/Category.js";
import Blog from "../models/Blog.js";
import asyncHandler from "../middleware/asyncHandler.js";

export const listCategories = asyncHandler(async (req, res) => {
  const categories = await Category.aggregate([
    { $lookup: { from: "blogs", let: { categoryId: "$_id" }, pipeline: [{ $match: { $expr: { $and: [{ $eq: ["$category", "$$categoryId"] }, { $eq: ["$status", "published"] }] } } }, { $count: "count" }], as: "published" } },
    { $addFields: { postCount: { $ifNull: [{ $arrayElemAt: ["$published.count", 0] }, 0] } } },
    { $project: { published: 0 } },
    { $sort: { name: 1 } },
  ]);
  res.json({ categories });
});

export const createCategory = asyncHandler(async (req, res) => {
  const name = req.body.name?.trim();
  if (!name) return res.status(400).json({ message: "Category name is required." });
  const category = await Category.create({ name, description: req.body.description || "" });
  res.status(201).json({ category });
});

export const updateCategory = asyncHandler(async (req, res) => {
  const category = await Category.findByIdAndUpdate(req.params.id, { name: req.body.name?.trim(), description: req.body.description }, { new: true, runValidators: true });
  if (!category) return res.status(404).json({ message: "Category not found." });
  res.json({ category });
});

export const deleteCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) return res.status(404).json({ message: "Category not found." });
  if (await Blog.exists({ category: category._id })) return res.status(409).json({ message: "Reassign or delete posts in this category before removing it." });
  await category.deleteOne();
  res.json({ message: "Category deleted." });
});

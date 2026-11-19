import { Router } from "express";
import { createBlog, deleteBlog, getBlog, listBlogs, relatedBlogs, toggleLike, updateBlog } from "../controllers/blogController.js";
import { createComment, deleteComment, listComments } from "../controllers/commentController.js";
import { authorize, protect } from "../middleware/auth.js";
import { optionalAuth } from "../middleware/optionalAuth.js";

const router = Router();

router.get("/", optionalAuth, listBlogs);
router.post("/", protect, createBlog);
router.get("/:slug/related", relatedBlogs);
router.get("/:slug/comments", listComments);
router.post("/:slug/comments", protect, createComment);
router.delete("/comments/:id", protect, deleteComment);
router.post("/:slug/like", protect, toggleLike);
router.get("/:slug", optionalAuth, getBlog);
router.patch("/:id", protect, updateBlog);
router.delete("/:id", protect, deleteBlog);

export default router;

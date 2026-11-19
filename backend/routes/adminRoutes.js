import { Router } from "express";
import { dashboardStats, deleteUser, listAllBlogs, listUsers, updateUserRole } from "../controllers/adminController.js";
import { deleteBlog } from "../controllers/blogController.js";
import { authorize, protect } from "../middleware/auth.js";

const router = Router();
router.use(protect, authorize("admin"));
router.get("/stats", dashboardStats);
router.get("/users", listUsers);
router.patch("/users/:id/role", updateUserRole);
router.delete("/users/:id", deleteUser);
router.get("/blogs", listAllBlogs);
router.delete("/blogs/:id", deleteBlog);
export default router;

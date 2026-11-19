import mongoose from "mongoose";

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true, maxlength: 40 },
  description: { type: String, default: "", maxlength: 240 },
});

export default mongoose.model("Category", categorySchema);

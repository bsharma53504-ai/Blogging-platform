import mongoose from "mongoose";
import Category from "../models/Category.js";

const starterCategories = ["Technology", "Programming", "Education", "Lifestyle", "Travel", "Business", "Health"];

export async function connectDatabase() {
  await mongoose.connect(process.env.MONGODB_URI);
  await Category.bulkWrite(
    starterCategories.map((name) => ({
      updateOne: { filter: { name }, update: { $setOnInsert: { name, description: `${name} stories and ideas` } }, upsert: true },
    })),
  );
  console.log("MongoDB connected");
}

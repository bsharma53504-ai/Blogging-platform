import "dotenv/config";
import mongoose from "mongoose";
import User from "../models/User.js";

const [email, name, password] = process.argv.slice(2);
if (!email || !name || !password) {
  console.error("Usage: npm run seed:admin -- <email> <name> <password>");
  process.exit(1);
}
if (password.length < 12) {
  console.error("Admin password must be at least 12 characters.");
  process.exit(1);
}

try {
  await mongoose.connect(process.env.MONGODB_URI);
  let user = await User.findOne({ email: email.toLowerCase() });
  if (!user) user = new User({ name, email: email.toLowerCase(), password, role: "admin" });
  else {
    user.name = name;
    user.password = password;
    user.role = "admin";
  }
  await user.save();
  console.log(`Admin account ready: ${user.email}`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}

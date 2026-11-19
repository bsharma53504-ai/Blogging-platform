import jwt from "jsonwebtoken";

export function createToken(userId) {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "7d" });
}

export function publicUser(user) {
  return { id: user._id, name: user.name, email: user.email, profileImage: user.profileImage, role: user.role, createdAt: user.createdAt };
}

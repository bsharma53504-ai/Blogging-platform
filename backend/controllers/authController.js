import crypto from "node:crypto";
import nodemailer from "nodemailer";
import User from "../models/User.js";
import asyncHandler from "../middleware/asyncHandler.js";
import { createToken, publicUser } from "../utils/token.js";

function sendAuth(res, user, status = 200) {
  res.status(status).json({ token: createToken(user._id), user: publicUser(user) });
}

export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  if (!name?.trim() || !email?.trim() || !password) return res.status(400).json({ message: "Name, email, and password are required." });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: "Enter a valid email address." });
  if (password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters." });
  const user = await User.create({ name: name.trim(), email: email.toLowerCase().trim(), password });
  sendAuth(res, user, 201);
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: "Email and password are required." });
  const user = await User.findOne({ email: email.toLowerCase().trim() }).select("+password");
  if (!user || !(await user.comparePassword(password))) return res.status(401).json({ message: "Email or password is incorrect." });
  sendAuth(res, user);
});

export const me = asyncHandler(async (req, res) => res.json({ user: publicUser(req.user) }));

export const updateProfile = asyncHandler(async (req, res) => {
  const { name, email, profileImage } = req.body;
  if (name !== undefined) {
    if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 60) return res.status(400).json({ message: "Name must be between 2 and 60 characters." });
    req.user.name = name.trim();
  }
  if (email !== undefined) {
    if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: "Enter a valid email address." });
    req.user.email = email.toLowerCase().trim();
  }
  if (profileImage !== undefined) req.user.profileImage = profileImage;
  await req.user.save();
  res.json({ user: publicUser(req.user) });
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword || newPassword.length < 8) return res.status(400).json({ message: "Provide your current password and a new password of at least 8 characters." });
  const user = await User.findById(req.user.id).select("+password");
  if (!(await user.comparePassword(currentPassword))) return res.status(400).json({ message: "Current password is incorrect." });
  user.password = newPassword;
  await user.save();
  sendAuth(res, user);
});

export const forgotPassword = asyncHandler(async (req, res) => {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return res.status(503).json({ message: "Password reset email is not configured. Contact the site administrator." });
  }
  const email = req.body.email?.toLowerCase().trim();
  if (!email) return res.status(400).json({ message: "Email is required." });
  const user = await User.findOne({ email });
  if (user) {
    const rawToken = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = crypto.createHash("sha256").update(rawToken).digest("hex");
    user.resetPasswordExpires = Date.now() + 60 * 60 * 1000;
    await user.save({ validateBeforeSave: false });
    const resetUrl = `${process.env.CLIENT_URL}/reset-password/${rawToken}`;
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: user.email,
        subject: "Reset your Inkwell password",
        text: `Use this link within one hour to reset your password: ${resetUrl}`,
      });
    } catch (error) {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save({ validateBeforeSave: false });
      throw error;
    }
  }
  res.json({ message: "If an account exists for that email, a reset link has been sent." });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const hashedToken = crypto.createHash("sha256").update(req.params.token).digest("hex");
  const user = await User.findOne({ resetPasswordToken: hashedToken, resetPasswordExpires: { $gt: Date.now() } }).select("+resetPasswordToken +resetPasswordExpires");
  if (!user) return res.status(400).json({ message: "This password reset link is invalid or has expired." });
  if (typeof req.body.password !== "string" || req.body.password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters." });
  user.password = req.body.password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();
  sendAuth(res, user);
});

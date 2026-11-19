export function notFound(req, res) {
  res.status(404).json({ message: `No route found for ${req.method} ${req.path}` });
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (error.name === "ValidationError") {
    return res.status(400).json({ message: Object.values(error.errors).map((item) => item.message).join(", ") });
  }
  if (error.code === 11000) return res.status(409).json({ message: "That value is already in use." });
  if (error.name === "CastError") return res.status(400).json({ message: "The requested resource ID is invalid." });
  if (error.name === "MulterError") return res.status(400).json({ message: error.message });
  console.error(error);
  res.status(error.status || 500).json({ message: error.status ? error.message : "Something went wrong. Please try again." });
}

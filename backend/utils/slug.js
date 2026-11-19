import slugify from "slugify";

export async function uniqueSlug(title, Blog, excludedId) {
  const base = slugify(title, { lower: true, strict: true }) || "story";
  let slug = base;
  let suffix = 1;
  while (await Blog.exists({ slug, ...(excludedId ? { _id: { $ne: excludedId } } : {}) })) {
    slug = `${base}-${suffix++}`;
  }
  return slug;
}

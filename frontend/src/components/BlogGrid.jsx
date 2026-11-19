import BlogCard from "./BlogCard.jsx";

export default function BlogGrid({ blogs, featured = false }) {
  if (!blogs.length) return <div className="empty-state"><span className="empty-icon">✳</span><h3>No stories here yet</h3><p>Try a different search, or check back soon for something new.</p></div>;
  return <div className={`blog-grid ${featured ? "blog-grid-featured" : ""}`}>{blogs.map((blog, index) => <BlogCard key={blog._id} blog={blog} featured={featured && index === 0} />)}</div>;
}

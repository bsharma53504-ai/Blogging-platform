import { Link } from "react-router-dom";
import { FiArrowUpRight as ArrowUpRight, FiClock as Clock3, FiHeart as Heart } from "react-icons/fi";
import { imageUrl } from "../services/api.js";

export function readingTime(content = "") {
  return Math.max(1, Math.ceil(content.trim().split(/\s+/).filter(Boolean).length / 220));
}

export default function BlogCard({ blog, featured = false }) {
  return (
    <article className={`blog-card ${featured ? "blog-card-featured" : ""}`}>
      <Link className="card-image-link" to={`/story/${blog.slug}`} aria-label={`Read ${blog.title}`}>
        {blog.coverImage ? <img className="card-image" src={imageUrl(blog.coverImage)} alt="" /> : <div className="image-placeholder"><span>inkwell</span></div>}
      </Link>
      <div className="card-copy">
        <div className="card-overline"><span>{blog.category?.name || "Stories"}</span><span className="overline-dot">·</span><span>{new Date(blog.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span></div>
        <h3><Link to={`/story/${blog.slug}`}>{blog.title}</Link></h3>
        <p className="card-excerpt">{blog.excerpt}</p>
        <div className="card-bottom">
          <div className="byline">
            {blog.author?.profileImage ? <img className="avatar-small" src={imageUrl(blog.author.profileImage)} alt="" /> : <span className="avatar-small avatar-letter">{blog.author?.name?.charAt(0) || "I"}</span>}
            <span>{blog.author?.name || "Inkwell writer"}</span>
          </div>
          <div className="card-meta"><span><Clock3 size={14} /> {readingTime(blog.content)} min</span><span><Heart size={14} /> {blog.likes?.length || 0}</span></div>
        </div>
        {featured && <Link className="featured-read" to={`/story/${blog.slug}`}>Read story <ArrowUpRight size={16} /></Link>}
      </div>
    </article>
  );
}

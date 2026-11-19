import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FiArrowUpRight as ArrowUpRight, FiFilePlus as FilePlus2, FiHeart as Heart, FiEdit3 as PenLine, FiTrash2 as Trash2 } from "react-icons/fi";
import { api, errorMessage, imageUrl } from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import Loading from "../components/Loading.jsx";

export default function Dashboard() {
  const { user } = useAuth();
  const { notify } = useToast();
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  function refresh() {
    setLoading(true);
    api.get("/blogs?mine=true&limit=100").then(({ data }) => setBlogs(data.blogs)).catch((requestError) => setError(errorMessage(requestError))).finally(() => setLoading(false));
  }
  useEffect(() => { refresh(); }, []);

  async function remove(blog) {
    if (!window.confirm(`Delete “${blog.title}”? This cannot be undone.`)) return;
    try {
      await api.delete(`/blogs/${blog._id}`);
      setBlogs((items) => items.filter((item) => item._id !== blog._id));
      notify("Story deleted.");
    } catch (requestError) {
      notify(errorMessage(requestError), "error");
    }
  }

  const drafts = blogs.filter((blog) => blog.status === "draft");
  const published = blogs.filter((blog) => blog.status === "published");
  const visible = filter === "all" ? blogs : blogs.filter((blog) => blog.status === filter);
  const appreciationCount = published.reduce((total, blog) => total + (blog.likes?.length || 0), 0);

  return (
    <section className="dashboard-page">
      <div className="dashboard-welcome"><div><span className="eyebrow">YOUR WRITER’S DESK</span><h1>Good to see you, <em>{user.name.split(" ")[0]}.</em></h1><p>Your words are out there, doing their thing.</p></div><Link className="button button-dark" to="/write"><FilePlus2 size={16} /> New story</Link></div>
      <div className="stats-grid"><div className="stat-card"><span>Published</span><strong>{published.length}</strong><span className="stat-foot"><ArrowUpRight size={13} /> stories out in the world</span></div><div className="stat-card"><span>Drafts</span><strong>{drafts.length}</strong><span className="stat-foot"><PenLine size={13} /> ideas in progress</span></div><div className="stat-card"><span>Appreciations</span><strong>{appreciationCount}</strong><span className="stat-foot"><Heart size={13} /> from your readers</span></div><div className="stat-card stat-card-profile"><span>Your profile</span><strong>{user.name}</strong><span className="stat-foot">{user.email}</span><Link to="/account">Manage account <ArrowUpRight size={13} /></Link></div></div>
      <div className="dashboard-list-header"><div><span className="eyebrow">YOUR WRITING</span><h2>Stories & drafts</h2></div><div className="filter-tabs"><button className={filter === "all" ? "tab-active" : ""} onClick={() => setFilter("all")}>All <span>{blogs.length}</span></button><button className={filter === "published" ? "tab-active" : ""} onClick={() => setFilter("published")}>Published <span>{published.length}</span></button><button className={filter === "draft" ? "tab-active" : ""} onClick={() => setFilter("draft")}>Drafts <span>{drafts.length}</span></button></div></div>
      {error && <div className="inline-error">{error}</div>}
      {loading ? <Loading label="Gathering your stories" /> : visible.length ? <div className="dashboard-story-list">{visible.map((blog) => <div className="dashboard-story-row" key={blog._id}><div className="dashboard-story-art">{blog.coverImage ? <img src={imageUrl(blog.coverImage)} alt="" /> : <span>✳</span>}</div><div className="dashboard-story-info"><div className="row-category">{blog.category?.name} <span>·</span> <span className={`status-label ${blog.status}`}>{blog.status}</span></div><h3><Link to={blog.status === "published" ? `/story/${blog.slug}` : `/write/${blog._id}`}>{blog.title}</Link></h3><p>{blog.excerpt}</p><div className="row-meta">{blog.status === "published" ? `Published ${new Date(blog.createdAt).toLocaleDateString()}` : `Last saved ${new Date(blog.updatedAt).toLocaleDateString()}`} <span>·</span> <Heart size={13} /> {blog.likes?.length || 0}</div></div><div className="row-actions"><Link to={`/write/${blog._id}`} className="icon-button" aria-label="Edit story"><PenLine size={16} /></Link>{blog.status === "published" && <Link to={`/story/${blog.slug}`} className="icon-button" aria-label="View story"><ArrowUpRight size={17} /></Link>}<button className="icon-button delete-action" onClick={() => remove(blog)} aria-label="Delete story"><Trash2 size={16} /></button></div></div>)}</div> : <div className="empty-dashboard"><div className="empty-icon">✳</div><h3>Your next story starts here.</h3><p>There’s nothing in this view just yet. A blank page is full of possibility.</p><Link className="button button-dark" to="/write"><PenLine size={15} /> Write your first story</Link></div>}
    </section>
  );
}

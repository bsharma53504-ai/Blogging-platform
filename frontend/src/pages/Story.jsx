import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { FiArrowLeft as ArrowLeft, FiArrowUpRight as ArrowUpRight, FiClock as Clock3, FiHeart as Heart, FiSend as Send, FiShare2 as Share2, FiTrash2 as Trash2 } from "react-icons/fi";
import { api, errorMessage, imageUrl } from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { readingTime } from "../components/BlogCard.jsx";
import BlogGrid from "../components/BlogGrid.jsx";
import Loading from "../components/Loading.jsx";

export default function Story() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { notify } = useToast();
  const [blog, setBlog] = useState(null);
  const [comments, setComments] = useState([]);
  const [related, setRelated] = useState([]);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([api.get(`/blogs/${slug}`), api.get(`/blogs/${slug}/comments`), api.get(`/blogs/${slug}/related`)])
      .then(([postResponse, commentsResponse, relatedResponse]) => {
        setBlog(postResponse.data.blog);
        setComments(commentsResponse.data.comments);
        setRelated(relatedResponse.data.blogs);
      })
      .catch((requestError) => setError(errorMessage(requestError)))
      .finally(() => setLoading(false));
  }, [slug]);

  async function toggleLike() {
    if (!user) return navigate("/login", { state: { from: `/story/${slug}` } });
    try {
      const { data } = await api.post(`/blogs/${slug}/like`);
      setBlog((current) => {
        const likes = [...(current.likes || [])].filter((id) => String(id) !== user.id);
        if (data.liked) likes.push(user.id);
        return { ...current, likes };
      });
    } catch (requestError) {
      notify(errorMessage(requestError), "error");
    }
  }

  async function postComment(event) {
    event.preventDefault();
    if (!user) return navigate("/login", { state: { from: `/story/${slug}` } });
    try {
      const { data } = await api.post(`/blogs/${slug}/comments`, { text: comment });
      setComments((current) => [data.comment, ...current]);
      setComment("");
    } catch (requestError) {
      notify(errorMessage(requestError), "error");
    }
  }

  async function removeComment(id) {
    try {
      await api.delete(`/blogs/comments/${id}`);
      setComments((current) => current.filter((item) => item._id !== id));
      notify("Comment deleted.");
    } catch (requestError) {
      notify(errorMessage(requestError), "error");
    }
  }

  async function shareStory() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      notify("Story link copied to clipboard.");
    } catch {
      notify("Could not copy the story link.", "error");
    }
  }

  if (loading) return <Loading label="Opening this story" />;
  if (error || !blog) return <section className="section"><div className="inline-error">{error || "This story could not be found."}</div><Link className="subtle-link" to="/explore"><ArrowLeft size={15} /> Back to stories</Link></section>;

  const liked = user && blog.likes?.some((id) => String(id) === user.id);
  const canEdit = user && (user.id === blog.author?._id || user.role === "admin");

  return (
    <article className="story-page">
      <div className="story-topline"><Link className="back-link" to="/explore"><ArrowLeft size={15} /> All stories</Link><div className="story-actions"><button className={`story-action ${liked ? "is-liked" : ""}`} onClick={toggleLike} aria-label={liked ? "Unlike story" : "Like story"}><Heart size={17} fill={liked ? "currentColor" : "none"} /> {blog.likes?.length || 0}</button><button className="story-action" onClick={shareStory} aria-label="Share story"><Share2 size={17} /> Share</button>{canEdit && <Link className="story-action" to={`/write/${blog._id}`}>Edit story</Link>}</div></div>
      <header className="story-header">
        <Link className="story-category" to={`/explore?category=${blog.category?._id}`}>{blog.category?.name}</Link>
        <h1>{blog.title}</h1>
        <p className="story-excerpt">{blog.excerpt}</p>
        <div className="story-byline">
          {blog.author?.profileImage ? <img src={imageUrl(blog.author.profileImage)} alt="" /> : <span className="avatar-small avatar-letter">{blog.author?.name?.charAt(0)}</span>}
          <div><strong>{blog.author?.name}</strong><span>{new Date(blog.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</span></div>
          <span className="story-reading"><Clock3 size={14} /> {readingTime(blog.content)} min read</span>
        </div>
      </header>
      {blog.coverImage && <div className="story-cover"><img src={imageUrl(blog.coverImage)} alt="" /></div>}
      <div className="story-layout">
        <div className="story-body">{blog.content.split(/\n{2,}/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}{blog.tags?.length > 0 && <div className="story-tags">{blog.tags.map((tag) => <Link key={tag} to={`/explore?search=${encodeURIComponent(tag)}`}>#{tag}</Link>)}</div>}</div>
        <aside className="story-aside"><span className="aside-label">A GOOD STORY TRAVELS</span><p>If this resonated with you, pass it along to someone who might need it.</p><button className="button button-outline" onClick={shareStory}><Share2 size={15} /> Share this story</button><button className={`button button-outline ${liked ? "is-liked" : ""}`} onClick={toggleLike}><Heart size={15} /> {liked ? "You appreciate this" : "Appreciate this"}</button></aside>
      </div>

      <section className="comments-section">
        <div className="comments-heading"><span className="eyebrow">THE CONVERSATION</span><h2>{comments.length} {comments.length === 1 ? "thought" : "thoughts"} so far</h2></div>
        <form className="comment-form" onSubmit={postComment}><textarea aria-label="Write a comment" placeholder={user ? "Add something thoughtful to the conversation..." : "Sign in to join the conversation"} value={comment} onChange={(event) => setComment(event.target.value)} maxLength="2000" required disabled={!user} /><div className="comment-submit-row"><span>{user ? `Joining as ${user.name}` : <Link to="/login">Sign in to comment</Link>}</span><button className="button button-dark" disabled={!user || !comment.trim()}><Send size={14} /> Respond</button></div></form>
        <div className="comment-list">{comments.map((item) => <div className="comment-item" key={item._id}><div className="comment-avatar">{item.user?.profileImage ? <img src={imageUrl(item.user.profileImage)} alt="" /> : item.user?.name?.charAt(0)}</div><div className="comment-content"><div className="comment-meta"><strong>{item.user?.name}</strong><time>{new Date(item.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</time>{(user?.id === item.user?._id || user?.role === "admin") && <button className="icon-button comment-delete" onClick={() => removeComment(item._id)} aria-label="Delete comment"><Trash2 size={14} /></button>}</div><p>{item.text}</p></div></div>)}</div>
      </section>
      {related.length > 0 && <section className="section related-section"><div className="section-heading"><div><span className="eyebrow">KEEP WANDERING</span><h2>More to discover<span className="heading-period">.</span></h2></div><Link className="subtle-link" to="/explore">Explore more <ArrowUpRight size={15} /></Link></div><BlogGrid blogs={related} /></section>}
    </article>
  );
}

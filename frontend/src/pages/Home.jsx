import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FiArrowDownRight as ArrowDownRight, FiArrowRight as ArrowRight, FiArrowUpRight as ArrowUpRight, FiSearch as Search, FiZap as Sparkles } from "react-icons/fi";
import { api, errorMessage, imageUrl } from "../services/api.js";
import BlogGrid from "../components/BlogGrid.jsx";
import Loading from "../components/Loading.jsx";

export default function Home() {
  const [blogs, setBlogs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([api.get("/blogs?limit=7"), api.get("/categories")])
      .then(([blogResponse, categoryResponse]) => {
        setBlogs(blogResponse.data.blogs);
        setCategories(categoryResponse.data.categories);
      })
      .catch((requestError) => setError(errorMessage(requestError)))
      .finally(() => setLoading(false));
  }, []);

  const featured = blogs[0];
  const trending = [...blogs].sort((a, b) => (b.likes?.length || 0) - (a.likes?.length || 0)).slice(0, 3);

  return (
    <>
      <section className="hero-section">
        <div className="hero-inner">
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-line" /> A quieter corner of the internet</div>
            <h1>Good ideas<br />deserve <em>good stories.</em></h1>
            <p className="hero-description">A home for thoughtful writing, curious minds, and the stories that stay with you long after the last line.</p>
            <form className="hero-search" onSubmit={(event) => { event.preventDefault(); navigate(`/explore${search ? `?search=${encodeURIComponent(search)}` : ""}`); }}>
              <Search size={19} />
              <input aria-label="Search stories" placeholder="Search stories, topics, ideas..." value={search} onChange={(event) => setSearch(event.target.value)} />
              <button className="search-submit" aria-label="Submit search"><ArrowRight size={17} /></button>
            </form>
            <div className="hero-note"><Sparkles size={14} /> Independent voices. No noise.</div>
          </div>
          {featured ? (
            <Link to={`/story/${featured.slug}`} className="hero-feature">
              <div className="hero-feature-image">{featured.coverImage ? <img src={imageUrl(featured.coverImage)} alt="" /> : <div className="image-placeholder"><span>inkwell</span></div>}</div>
              <div className="hero-feature-caption"><span className="feature-label">THIS WEEK’S READ</span><ArrowUpRight size={18} /></div>
              <h2>{featured.title}</h2><p>{featured.excerpt}</p>
              <span className="feature-author">{featured.author?.name} <span>·</span> {featured.category?.name}</span>
            </Link>
          ) : !loading && (
            <div className="hero-art" aria-hidden="true"><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /><div className="art-center"><span>Ideas<br />in bloom.</span></div><div className="art-spark art-spark-one">✳</div><div className="art-spark art-spark-two">✳</div><div className="art-caption">WORDS THAT<br />MOVE US</div></div>
          )}
          {loading && <div className="hero-feature hero-feature-loading"><span className="skeleton skeleton-image" /><span className="skeleton skeleton-line" /><span className="skeleton skeleton-line short" /></div>}
        </div>
        <a className="scroll-cue" href="#latest"><ArrowDownRight size={15} /> Scroll to explore</a>
      </section>

      <section className="section category-strip">
        <div className="section-heading compact-heading"><div><span className="eyebrow">FIND YOUR THREAD</span><h2>Explore by topic</h2></div><Link className="subtle-link" to="/explore">All stories <ArrowUpRight size={15} /></Link></div>
        <div className="category-pills">
          {categories.map((category, index) => <Link key={category._id} to={`/explore?category=${category._id}`} className="category-pill"><span className={`category-dot category-dot-${index % 6}`} />{category.name}<span className="category-count">{category.postCount}</span></Link>)}
          {!categories.length && !loading && <Link className="category-pill" to="/explore">Browse all stories <ArrowRight size={15} /></Link>}
        </div>
      </section>

      <section className="section latest-section" id="latest">
        <div className="section-heading"><div><span className="eyebrow">FRESH FROM THE INKWELL</span><h2>Stories worth your time<span className="heading-period">.</span></h2></div><Link className="subtle-link" to="/explore">View all stories <ArrowUpRight size={15} /></Link></div>
        {error ? <div className="inline-error">{error}</div> : loading ? <Loading /> : <BlogGrid blogs={blogs.slice(0, 6)} />}
      </section>

      {trending.length > 0 && <section className="trending-section"><div className="trending-inner"><div className="trending-intro"><span className="eyebrow eyebrow-light">THE ONES YOU LOVE</span><h2>A little<br />well-loved.</h2><p>Stories readers are returning to, sharing, and talking about.</p><Link className="light-link" to="/explore">Find your next read <ArrowRight size={15} /></Link></div><div className="trending-list">{trending.map((blog, index) => <Link className="trending-item" key={blog._id} to={`/story/${blog.slug}`}><span className="trending-number">0{index + 1}</span><div><span className="trending-category">{blog.category?.name}</span><h3>{blog.title}</h3><span className="trending-author">{blog.author?.name} <span>·</span> {blog.likes?.length || 0} appreciations</span></div><ArrowUpRight className="trending-arrow" size={18} /></Link>)}</div></div></section>}

      <section className="write-cta"><div className="cta-flower">✳</div><span className="eyebrow">YOUR WORDS HAVE A HOME HERE</span><h2>Have something<br /><em>on your mind?</em></h2><p>Every great story begins with a first sentence. Make yours count.</p><Link className="button button-dark" to="/register">Start writing <ArrowUpRight size={16} /></Link></section>
    </>
  );
}

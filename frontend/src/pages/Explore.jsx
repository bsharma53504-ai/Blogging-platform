import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FiSearch as Search, FiSliders as SlidersHorizontal, FiX as X } from "react-icons/fi";
import { api, errorMessage } from "../services/api.js";
import BlogGrid from "../components/BlogGrid.jsx";
import Loading from "../components/Loading.jsx";

export default function Explore() {
  const [params, setParams] = useSearchParams();
  const [categories, setCategories] = useState([]);
  const [blogs, setBlogs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [search, setSearch] = useState(params.get("search") || "");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const category = params.get("category") || "";
  const sort = params.get("sort") || "latest";
  const page = Number(params.get("page") || 1);
  const searchParam = params.get("search") || "";

  useEffect(() => {
    api.get("/categories").then(({ data }) => setCategories(data.categories)).catch((requestError) => setError(errorMessage(requestError)));
  }, []);

  useEffect(() => {
    setLoading(true);
    const query = new URLSearchParams({ page, sort });
    if (category) query.set("category", category);
    if (searchParam) query.set("search", searchParam);
    api.get(`/blogs?${query}`).then(({ data }) => {
      setBlogs(data.blogs);
      setPagination(data.pagination);
      setError("");
    }).catch((requestError) => setError(errorMessage(requestError))).finally(() => setLoading(false));
  }, [page, category, sort, searchParam]);

  function changeFilter(key, value) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next);
  }

  return (
    <section className="section explore-page">
      <div className="page-intro"><span className="eyebrow">THE INKWELL LIBRARY</span><h1>Find a story<br /><em>that finds you.</em></h1><p>Explore ideas, perspectives, and the people behind them.</p></div>
      <form className="explore-search" onSubmit={(event) => { event.preventDefault(); changeFilter("search", search.trim()); }}>
        <Search size={19} /><input placeholder="Search titles, topics, keywords..." aria-label="Search stories" value={search} onChange={(event) => setSearch(event.target.value)} />
        {searchParam && <button className="clear-search" type="button" aria-label="Clear search" onClick={() => { setSearch(""); changeFilter("search", ""); }}><X size={16} /></button>}
        <button className="button button-dark" type="submit">Search</button>
      </form>
      <div className="filter-toolbar">
        <div className="filter-categories"><SlidersHorizontal size={16} /><button className={`filter-chip ${!category ? "filter-active" : ""}`} onClick={() => changeFilter("category", "")}>All topics</button>{categories.map((item) => <button key={item._id} className={`filter-chip ${category === item._id ? "filter-active" : ""}`} onClick={() => changeFilter("category", item._id)}>{item.name}</button>)}</div>
        <label className="sort-control">Sort by <select value={sort} onChange={(event) => changeFilter("sort", event.target.value)}><option value="latest">Latest</option><option value="oldest">Oldest</option></select></label>
      </div>
      <div className="results-caption"><span>{loading ? "Finding stories..." : `${pagination.total} ${pagination.total === 1 ? "story" : "stories"} to explore`}</span>{searchParam && <span className="search-term">for “{searchParam}” <button onClick={() => changeFilter("search", "")} aria-label="Clear search"><X size={13} /></button></span>}</div>
      {error ? <div className="inline-error">{error}</div> : loading ? <Loading /> : <BlogGrid blogs={blogs} />}
      {pagination.pages > 1 && <div className="pagination"><button className="button button-outline" disabled={page <= 1} onClick={() => changeFilter("page", String(page - 1))}>Previous</button><span>Page {page} of {pagination.pages}</span><button className="button button-outline" disabled={page >= pagination.pages} onClick={() => changeFilter("page", String(page + 1))}>Next</button></div>}
    </section>
  );
}

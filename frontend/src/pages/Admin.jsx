import { useEffect, useState } from "react";
import { FiArrowUpRight as ArrowUpRight, FiEdit3 as Edit, FiFileText as FileText, FiFolderPlus as FolderPlus, FiTrash2 as Trash2, FiUsers as Users, FiX as Close } from "react-icons/fi";
import { api, errorMessage, imageUrl } from "../services/api.js";
import { useToast } from "../context/ToastContext.jsx";
import Loading from "../components/Loading.jsx";

export default function Admin() {
  const { notify } = useToast();
  const [tab, setTab] = useState("overview");
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [blogs, setBlogs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoryForm, setCategoryForm] = useState({ name: "", description: "" });
  const [editingCategory, setEditingCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadTab(selected = tab) {
    setLoading(true);
    setError("");
    try {
      const [statsResponse, contentResponse, categoriesResponse] = await Promise.all([
        api.get("/admin/stats"),
        selected === "users" ? api.get("/admin/users?limit=50") : selected === "posts" ? api.get("/admin/blogs?limit=50") : Promise.resolve({ data: {} }),
        selected === "categories" ? api.get("/categories") : Promise.resolve({ data: {} }),
      ]);
      setStats(statsResponse.data.stats);
      if (selected === "users") setUsers(contentResponse.data.users);
      if (selected === "posts") setBlogs(contentResponse.data.blogs);
      if (selected === "categories") setCategories(categoriesResponse.data.categories);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { loadTab(tab); }, [tab]);

  async function changeRole(user) {
    const role = user.role === "admin" ? "user" : "admin";
    try {
      const { data } = await api.patch(`/admin/users/${user.id}/role`, { role });
      setUsers((current) => current.map((item) => item.id === user.id ? data.user : item));
      notify(`${user.name} is now ${role === "admin" ? "an admin" : "a member"}.`);
    } catch (requestError) {
      notify(errorMessage(requestError), "error");
    }
  }

  async function removeUser(user) {
    if (!window.confirm(`Remove ${user.name} and all of their content? This cannot be undone.`)) return;
    try {
      await api.delete(`/admin/users/${user.id}`);
      setUsers((current) => current.filter((item) => item.id !== user.id));
      notify("User and their content removed.");
    } catch (requestError) {
      notify(errorMessage(requestError), "error");
    }
  }

  async function removeBlog(blog) {
    if (!window.confirm(`Delete “${blog.title}”?`)) return;
    try {
      await api.delete(`/admin/blogs/${blog._id}`);
      setBlogs((current) => current.filter((item) => item._id !== blog._id));
      notify("Story removed.");
    } catch (requestError) {
      notify(errorMessage(requestError), "error");
    }
  }

  async function saveCategory(event) {
    event.preventDefault();
    try {
      const { data } = editingCategory
        ? await api.patch(`/categories/${editingCategory}`, categoryForm)
        : await api.post("/categories", categoryForm);
      setCategories((current) => {
        const next = editingCategory
          ? current.map((item) => item._id === editingCategory ? { ...item, ...data.category } : item)
          : [...current, data.category];
        return next.sort((a, b) => a.name.localeCompare(b.name));
      });
      setCategoryForm({ name: "", description: "" });
      setEditingCategory("");
      notify(editingCategory ? "Category updated." : "Category added.");
    } catch (requestError) {
      notify(errorMessage(requestError), "error");
    }
  }

  function editCategory(category) {
    setEditingCategory(category._id);
    setCategoryForm({ name: category.name, description: category.description || "" });
  }

  function cancelCategoryEdit() {
    setEditingCategory("");
    setCategoryForm({ name: "", description: "" });
  }

  async function removeCategory(category) {
    if (!window.confirm(`Delete the “${category.name}” category?`)) return;
    try {
      await api.delete(`/categories/${category._id}`);
      setCategories((current) => current.filter((item) => item._id !== category._id));
      notify("Category removed.");
    } catch (requestError) {
      notify(errorMessage(requestError), "error");
    }
  }

  return (
    <section className="admin-page">
      <div className="dashboard-welcome"><div><span className="eyebrow">THE INKWELL BACKSTAGE</span><h1>Good morning, <em>editor.</em></h1><p>A little overview of what’s happening around here.</p></div><span className="admin-badge">✳ Admin view</span></div>
      <div className="admin-tabs">{[["overview", "Overview"], ["users", "People"], ["posts", "Stories"], ["categories", "Topics"]].map(([key, label]) => <button key={key} className={tab === key ? "admin-tab-active" : ""} onClick={() => setTab(key)}>{label}</button>)}</div>
      {error && <div className="inline-error">{error}</div>}
      {loading ? <Loading label="Gathering the numbers" /> : <>
        {stats && <div className="stats-grid admin-stats"><div className="stat-card"><span>Community</span><strong>{stats.users}</strong><span className="stat-foot"><Users size={13} /> registered members</span></div><div className="stat-card"><span>Published stories</span><strong>{stats.published}</strong><span className="stat-foot"><FileText size={13} /> out in the world</span></div><div className="stat-card"><span>Drafts</span><strong>{stats.drafts}</strong><span className="stat-foot"><FileText size={13} /> still in progress</span></div><div className="stat-card"><span>Conversations</span><strong>{stats.comments}</strong><span className="stat-foot">Across {stats.blogs} total stories</span></div></div>}
        {tab === "overview" && <div className="admin-overview"><div className="admin-overview-card"><div><Users size={19} /><h3>A growing community</h3><p>There are {stats?.users || 0} voices sharing their ideas on Inkwell.</p></div><button onClick={() => setTab("users")}>Manage people <ArrowUpRight size={14} /></button></div><div className="admin-overview-card"><div><FileText size={19} /><h3>Stories in motion</h3><p>{stats?.published || 0} published stories and {stats?.drafts || 0} ideas still taking shape.</p></div><button onClick={() => setTab("posts")}>Manage stories <ArrowUpRight size={14} /></button></div><div className="admin-overview-card"><div><FolderPlus size={19} /><h3>Thoughtful organization</h3><p>Manage the topics that help readers find their next story.</p></div><button onClick={() => setTab("categories")}>Manage topics <ArrowUpRight size={14} /></button></div></div>}
        {tab === "users" && <div className="admin-table-wrap"><div className="admin-table-heading"><div><span className="eyebrow">THE PEOPLE HERE</span><h2>Community members</h2></div><span>{users.length} members</span></div><div className="admin-table-scroll"><table><thead><tr><th>Member</th><th>Joined</th><th>Role</th><th>Actions</th></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td><div className="table-user"><span>{user.profileImage ? <img src={imageUrl(user.profileImage)} alt="" /> : user.name.charAt(0)}</span><div><strong>{user.name}</strong><small>{user.email}</small></div></div></td><td>{new Date(user.createdAt).toLocaleDateString()}</td><td><span className={`role-pill ${user.role}`}>{user.role}</span></td><td><div className="table-actions"><button onClick={() => changeRole(user)}>{user.role === "admin" ? "Make member" : "Make admin"}</button><button className="table-delete" onClick={() => removeUser(user)} aria-label={`Delete ${user.name}`}><Trash2 size={15} /></button></div></td></tr>)}</tbody></table></div></div>}
        {tab === "posts" && <div className="admin-table-wrap"><div className="admin-table-heading"><div><span className="eyebrow">THE WORDS WE SHARE</span><h2>All stories</h2></div><span>{blogs.length} stories</span></div><div className="admin-table-scroll"><table><thead><tr><th>Story</th><th>Author</th><th>Topic</th><th>Status</th><th>Actions</th></tr></thead><tbody>{blogs.map((blog) => <tr key={blog._id}><td><strong className="admin-post-title">{blog.title}</strong><small>{new Date(blog.createdAt).toLocaleDateString()}</small></td><td>{blog.author?.name}</td><td>{blog.category?.name}</td><td><span className={`status-label ${blog.status}`}>{blog.status}</span></td><td><div className="table-actions">{blog.status === "published" && <a href={`/story/${blog.slug}`} className="table-open" aria-label="Open story"><ArrowUpRight size={15} /></a>}<button className="table-delete" onClick={() => removeBlog(blog)} aria-label="Delete story"><Trash2 size={15} /></button></div></td></tr>)}</tbody></table></div></div>}
        {tab === "categories" && <div className="categories-admin"><div className="category-create-card"><span className="eyebrow">{editingCategory ? "REFINE A STORY SHELF" : "MAKE ROOM FOR AN IDEA"}</span><h2>{editingCategory ? "Edit topic" : "Add a topic"}</h2><form onSubmit={saveCategory}><label>Topic name<input value={categoryForm.name} onChange={(event) => setCategoryForm((current) => ({ ...current, name: event.target.value }))} maxLength="40" required placeholder="e.g. Design" /></label><label>Short description<input value={categoryForm.description} onChange={(event) => setCategoryForm((current) => ({ ...current, description: event.target.value }))} maxLength="240" placeholder="What stories belong here?" /></label><div className="category-form-actions"><button className="button button-dark"><FolderPlus size={15} /> {editingCategory ? "Save topic" : "Add topic"}</button>{editingCategory && <button className="button button-outline" type="button" onClick={cancelCategoryEdit}><Close size={14} /> Cancel</button>}</div></form></div><div className="category-admin-list"><div className="admin-table-heading"><div><span className="eyebrow">CURRENT TOPICS</span><h2>Story shelves</h2></div><span>{categories.length} topics</span></div>{categories.map((category, index) => <div className="category-admin-row" key={category._id}><span className={`category-dot category-dot-${index % 6}`} /><div><strong>{category.name}</strong><small>{category.description || "No description"} · {category.postCount || 0} stories</small></div><button className="icon-button" aria-label={`Edit ${category.name}`} onClick={() => editCategory(category)}><Edit size={15} /></button><button className="icon-button delete-action" aria-label={`Delete ${category.name}`} onClick={() => removeCategory(category)}><Trash2 size={15} /></button></div>)}</div></div>}
      </>}
    </section>
  );
}

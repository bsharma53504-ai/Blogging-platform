import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { FiArrowLeft as ArrowLeft, FiImage as ImagePlus, FiSave as Save, FiSend as Send, FiX as X } from "react-icons/fi";
import { api, errorMessage, imageUrl } from "../services/api.js";
import { useToast } from "../context/ToastContext.jsx";

const initialForm = { title: "", excerpt: "", content: "", category: "", coverImage: "", tags: "", status: "draft" };

export default function Editor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { notify } = useToast();
  const [form, setForm] = useState(initialForm);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/categories").then(({ data }) => setCategories(data.categories))
      .catch((requestError) => setError(errorMessage(requestError)));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    api.get("/blogs?mine=true&status=all&limit=100").then(({ data }) => {
      const blog = data.blogs.find((item) => item._id === id);
      if (!blog) throw new Error("Story not found, or you do not have permission to edit it.");
      setForm({ title: blog.title, excerpt: blog.excerpt, content: blog.content, category: blog.category?._id || "", coverImage: blog.coverImage || "", tags: (blog.tags || []).join(", "), status: blog.status });
    }).catch((requestError) => setError(errorMessage(requestError))).finally(() => setLoading(false));
  }, [id]);

  function update(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function uploadImage(file) {
    if (!file) return;
    const data = new FormData();
    data.append("image", file);
    try {
      const result = await api.post("/uploads", data, { headers: { "Content-Type": "multipart/form-data" } });
      setForm((current) => ({ ...current, coverImage: result.data.url }));
      notify("Image uploaded.");
    } catch (requestError) {
      notify(errorMessage(requestError), "error");
    }
  }

  async function save(status) {
    setError("");
    setSaving(true);
    const payload = { ...form, status, tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean) };
    try {
      const { data } = id ? await api.patch(`/blogs/${id}`, payload) : await api.post("/blogs", payload);
      notify(status === "published" ? "Your story is published." : "Draft saved.");
      navigate(status === "published" ? `/story/${data.blog.slug}` : "/dashboard");
    } catch (requestError) {
      setError(errorMessage(requestError));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="editor-wrap"><div className="loading-state"><span className="spinner" /><span>Opening your draft</span></div></div>;

  return (
    <section className="editor-wrap">
      <div className="editor-top"><Link to="/dashboard" className="back-link"><ArrowLeft size={15} /> Your stories</Link><span className="editor-status"><span className={`status-dot ${form.status}`} /> {form.status === "published" ? "Published story" : "Draft"}</span><div className="editor-actions"><button className="button button-outline" disabled={saving} onClick={() => save("draft")}><Save size={15} /> Save draft</button><button className="button button-dark" disabled={saving} onClick={() => save("published")}><Send size={14} /> {saving ? "Saving..." : "Publish"}</button></div></div>
      {error && <div className="form-error editor-error" role="alert">{error}</div>}
      <form className="editor-form" onSubmit={(event) => { event.preventDefault(); save(form.status); }}>
        <span className="eyebrow">THE NEXT GREAT READ</span>
        <input className="editor-title" name="title" value={form.title} onChange={update} placeholder="Give your story a title..." minLength="4" maxLength="140" required aria-label="Story title" />
        <textarea className="editor-excerpt" name="excerpt" value={form.excerpt} onChange={update} placeholder="A short, inviting introduction..." maxLength="300" required aria-label="Story excerpt" rows="2" />
        <div className="editor-meta-fields"><label>Topic<select name="category" value={form.category} onChange={update} required><option value="">Choose a category</option>{categories.map((category) => <option key={category._id} value={category._id}>{category.name}</option>)}</select></label><label>Tags <span>(comma separated)</span><input name="tags" value={form.tags} onChange={update} placeholder="creativity, design, ideas" /></label></div>
        <div className="cover-upload">
          {form.coverImage ? <div className="cover-preview"><img src={imageUrl(form.coverImage)} alt="Story cover preview" /><button type="button" className="remove-cover" onClick={() => setForm((current) => ({ ...current, coverImage: "" }))} aria-label="Remove cover image"><X size={15} /></button></div> : <label className="upload-prompt"><ImagePlus size={19} /><span>Add a cover image</span><small>JPG, PNG, WebP or GIF · up to 5 MB</small><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => uploadImage(event.target.files?.[0])} /></label>}
        </div>
        <label className="content-label">Your story<textarea className="editor-content" name="content" value={form.content} onChange={update} placeholder="It all starts with a single thought..." minLength="30" required aria-label="Story content" /></label>
        <div className="editor-bottom"><span>Your story is saved to your account. Write at your own pace.</span><button className="button button-dark" type="submit" disabled={saving}>{saving ? "Saving..." : form.status === "published" ? "Update story" : "Save draft"} <Save size={15} /></button></div>
      </form>
    </section>
  );
}

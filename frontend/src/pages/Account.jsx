import { useState } from "react";
import { Link } from "react-router-dom";
import { FiArrowLeft as ArrowLeft, FiImage as ImagePlus, FiSave as Save, FiShield as ShieldCheck } from "react-icons/fi";
import { api, errorMessage, imageUrl } from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";

export default function Account() {
  const { user, updateUser, setSession } = useAuth();
  const { notify } = useToast();
  const [profile, setProfile] = useState({ name: user.name, email: user.email, profileImage: user.profileImage || "" });
  const [password, setPassword] = useState({ currentPassword: "", newPassword: "" });
  const [profileBusy, setProfileBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [error, setError] = useState("");

  async function upload(file) {
    if (!file) return;
    const formData = new FormData();
    formData.append("image", file);
    try {
      const { data } = await api.post("/uploads", formData, { headers: { "Content-Type": "multipart/form-data" } });
      setProfile((current) => ({ ...current, profileImage: data.url }));
    } catch (requestError) {
      notify(errorMessage(requestError), "error");
    }
  }

  async function saveProfile(event) {
    event.preventDefault();
    setError("");
    setProfileBusy(true);
    try {
      const { data } = await api.patch("/auth/profile", profile);
      updateUser(data.user);
      notify("Profile updated.");
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setProfileBusy(false);
    }
  }

  async function savePassword(event) {
    event.preventDefault();
    setError("");
    setPasswordBusy(true);
    try {
      const { data } = await api.patch("/auth/password", password);
      setSession(data);
      setPassword({ currentPassword: "", newPassword: "" });
      notify("Password changed successfully.");
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setPasswordBusy(false);
    }
  }

  return (
    <section className="account-page">
      <Link to="/dashboard" className="back-link"><ArrowLeft size={15} /> Your stories</Link>
      <div className="account-heading"><span className="eyebrow">YOUR LITTLE CORNER</span><h1>Account <em>settings.</em></h1><p>Keep your profile current and your account secure.</p></div>
      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="account-columns">
        <form className="account-card" onSubmit={saveProfile}>
          <div className="account-card-heading"><div><span className="eyebrow">THE PERSON BEHIND THE WORDS</span><h2>Your profile</h2></div></div>
          <label className="profile-image-upload">{profile.profileImage ? <img src={imageUrl(profile.profileImage)} alt="Profile" /> : <span className="avatar-large">{profile.name.charAt(0).toUpperCase()}</span>}<span className="profile-upload-overlay"><ImagePlus size={16} /> Change photo</span><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => upload(event.target.files?.[0])} /></label>
          <label>Display name<input value={profile.name} onChange={(event) => setProfile((current) => ({ ...current, name: event.target.value }))} minLength="2" maxLength="60" required /></label>
          <label>Email address<input type="email" value={profile.email} onChange={(event) => setProfile((current) => ({ ...current, email: event.target.value }))} required /></label>
          <div className="account-foot"><span>Member since {new Date(user.createdAt).toLocaleDateString(undefined, { month: "long", year: "numeric" })}</span><button className="button button-dark" disabled={profileBusy}><Save size={14} /> {profileBusy ? "Saving..." : "Save changes"}</button></div>
        </form>
        <form className="account-card password-card" onSubmit={savePassword}>
          <div className="account-card-heading"><div><span className="eyebrow">KEEP IT PRIVATE</span><h2>Change password</h2></div><ShieldCheck size={21} /></div>
          <p>Choose a new password you don’t use anywhere else. Make it at least 8 characters.</p>
          <label>Current password<input type="password" autoComplete="current-password" value={password.currentPassword} onChange={(event) => setPassword((current) => ({ ...current, currentPassword: event.target.value }))} required /></label>
          <label>New password<input type="password" autoComplete="new-password" minLength="8" value={password.newPassword} onChange={(event) => setPassword((current) => ({ ...current, newPassword: event.target.value }))} required /></label>
          <div className="account-foot"><span>Your password stays encrypted.</span><button className="button button-outline" disabled={passwordBusy}>{passwordBusy ? "Updating..." : "Update password"}</button></div>
        </form>
      </div>
    </section>
  );
}

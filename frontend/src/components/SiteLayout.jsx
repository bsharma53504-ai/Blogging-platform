import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { FiArrowUpRight as ArrowUpRight, FiBookOpen as BookOpen, FiMenu as Menu, FiMoon as Moon, FiEdit3 as PenLine, FiSun as Sun, FiX as X } from "react-icons/fi";
import { useAuth } from "../context/AuthContext.jsx";
import { imageUrl } from "../services/api.js";

export default function SiteLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dark, setDark] = useState(() => localStorage.getItem("inkwell-theme") === "dark");

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    localStorage.setItem("inkwell-theme", next ? "dark" : "light");
  }

  return (
    <div className="site-shell">
      <header className="topbar">
        <div className="nav-wrap">
          <Link className="brand" to="/" aria-label="Inkwell home"><span className="brand-mark"><BookOpen size={19} /></span> inkwell<span className="brand-period">.</span></Link>
          <nav className={`main-nav ${menuOpen ? "nav-open" : ""}`} aria-label="Main navigation">
            <NavLink to="/" end onClick={() => setMenuOpen(false)}>Home</NavLink>
            <NavLink to="/explore" onClick={() => setMenuOpen(false)}>Discover</NavLink>
            {user && <NavLink to="/dashboard" onClick={() => setMenuOpen(false)}>My stories</NavLink>}
            {user?.role === "admin" && <NavLink to="/admin" onClick={() => setMenuOpen(false)}>Admin</NavLink>}
          </nav>
          <div className="nav-actions">
            <button className="icon-button theme-toggle" onClick={toggleTheme} aria-label={`Switch to ${dark ? "light" : "dark"} mode`}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
            {user ? (
              <>
                <Link className="write-link" to="/write"><PenLine size={16} /> Write</Link>
                <Link className="avatar-link" to="/account" title="Account">{user.profileImage ? <img src={imageUrl(user.profileImage)} alt="" /> : user.name.charAt(0).toUpperCase()}</Link>
                <button className="text-button signout-button" onClick={() => { signOut(); navigate("/"); }}>Sign out</button>
              </>
            ) : (
              <>
                <Link className="text-button sign-in" to="/login">Sign in</Link>
                <Link className="button button-dark nav-join" to="/register">Get started <ArrowUpRight size={15} /></Link>
              </>
            )}
          </div>
          <button className="icon-button mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? "Close menu" : "Open menu"}>{menuOpen ? <X /> : <Menu />}</button>
        </div>
      </header>
      <main className="main-content"><Outlet /></main>
      <footer className="site-footer">
        <div className="footer-inner">
          <Link className="brand footer-brand" to="/"><span className="brand-mark"><BookOpen size={18} /></span> inkwell<span className="brand-period">.</span></Link>
          <p>Ideas are better when they’re shared.</p>
          <div className="footer-links"><Link to="/explore">Explore</Link><a href="https://www.instagram.com/" target="_blank" rel="noreferrer">Instagram ↗</a><a href="https://www.linkedin.com/" target="_blank" rel="noreferrer">LinkedIn ↗</a></div>
          <span className="copyright">© {new Date().getFullYear()} Inkwell</span>
        </div>
      </footer>
    </div>
  );
}

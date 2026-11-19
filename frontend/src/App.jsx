import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import SiteLayout from "./components/SiteLayout.jsx";
import Loading from "./components/Loading.jsx";
import Home from "./pages/Home.jsx";
import Explore from "./pages/Explore.jsx";
import Story from "./pages/Story.jsx";
import Editor from "./pages/Editor.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Account from "./pages/Account.jsx";
import Admin from "./pages/Admin.jsx";
import AuthPage from "./pages/Auth.jsx";
import NotFound from "./pages/NotFound.jsx";

function RequireAuth({ children, admin = false }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (admin && user.role !== "admin") return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  useEffect(() => {
    document.documentElement.dataset.theme = localStorage.getItem("inkwell-theme") || "light";
  }, []);

  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route index element={<Home />} />
        <Route path="explore" element={<Explore />} />
        <Route path="story/:slug" element={<Story />} />
        <Route path="login" element={<AuthPage mode="login" />} />
        <Route path="register" element={<AuthPage mode="register" />} />
        <Route path="forgot-password" element={<AuthPage mode="forgot" />} />
        <Route path="reset-password/:token" element={<AuthPage mode="reset" />} />
        <Route path="dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="write" element={<RequireAuth><Editor /></RequireAuth>} />
        <Route path="write/:id" element={<RequireAuth><Editor /></RequireAuth>} />
        <Route path="account" element={<RequireAuth><Account /></RequireAuth>} />
        <Route path="admin" element={<RequireAuth admin><Admin /></RequireAuth>} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

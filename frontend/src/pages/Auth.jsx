import { useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { FiArrowLeft as ArrowLeft, FiArrowRight as ArrowRight, FiBookOpen as BookOpen, FiCheckCircle as CheckCircle2 } from "react-icons/fi";
import { api, errorMessage } from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";

export default function AuthPage({ mode }) {
  const { token } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { signIn, signUp, setSession } = useAuth();
  const { notify } = useToast();
  const [values, setValues] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const titles = {
    login: ["Welcome back.", "Pick up where your curiosity left off."],
    register: ["Make yourself at home.", "Join a community that believes in the power of a good story."],
    forgot: ["Forgot your password?", "It happens. We’ll send you a link to get back in."],
    reset: ["A fresh start.", "Choose a new password for your account."],
  };
  const [title, subtitle] = titles[mode];

  function update(event) {
    setValues((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (mode === "register" && values.password !== values.confirmPassword) return setError("Your passwords do not match.");
    if (["register", "reset"].includes(mode) && values.password.length < 8) return setError("Password must be at least 8 characters.");
    setLoading(true);
    try {
      if (mode === "login") {
        await signIn({ email: values.email, password: values.password });
        navigate(location.state?.from || "/dashboard", { replace: true });
      } else if (mode === "register") {
        await signUp({ name: values.name, email: values.email, password: values.password });
        navigate("/dashboard", { replace: true });
      } else if (mode === "forgot") {
        const { data } = await api.post("/auth/forgot-password", { email: values.email });
        setSent(true);
        notify(data.message);
      } else {
        const { data } = await api.post(`/auth/reset-password/${token}`, { password: values.password });
        setSession(data);
        navigate("/dashboard", { replace: true });
      }
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-visual"><Link className="brand auth-brand" to="/"><span className="brand-mark"><BookOpen size={19} /></span> inkwell<span className="brand-period">.</span></Link><div className="auth-quote"><span className="eyebrow eyebrow-light">A NOTE TO THE CURIOUS</span><p>“A word after a word after a word is power.”</p><span>— Margaret Atwood</span></div><div className="auth-visual-footer">A place for your next big idea.</div><div className="auth-visual-mark">✳</div></div>
      <div className="auth-form-wrap">
        <div className="auth-form-inner">
          <Link className="back-home" to="/"><ArrowLeft size={15} /> Back to Inkwell</Link>
          <span className="eyebrow">{mode === "register" ? "YOUR STORY STARTS HERE" : mode === "login" ? "GOOD TO HAVE YOU BACK" : "ACCOUNT RECOVERY"}</span>
          <h1>{title}</h1><p className="auth-subtitle">{subtitle}</p>
          {sent ? <div className="success-panel"><CheckCircle2 size={26} /><h3>Check your inbox</h3><p>If an account exists for that email, a password reset link is on its way.</p><Link className="button button-dark" to="/login">Back to sign in</Link></div> : (
            <form className="auth-form" onSubmit={submit}>
              {mode === "register" && <label>Your name<input name="name" value={values.name} onChange={update} placeholder="How should we call you?" minLength="2" maxLength="60" required autoComplete="name" /></label>}
              {mode !== "reset" && <label>Email address<input name="email" type="email" value={values.email} onChange={update} placeholder="you@example.com" required autoComplete="email" /></label>}
              {["login", "register", "reset"].includes(mode) && <label>{mode === "reset" ? "New password" : "Password"}<input name="password" type="password" value={values.password} onChange={update} placeholder={mode === "login" ? "Your password" : "At least 8 characters"} minLength="8" required autoComplete={mode === "login" ? "current-password" : "new-password"} /></label>}
              {mode === "register" && <label>Confirm password<input name="confirmPassword" type="password" value={values.confirmPassword} onChange={update} placeholder="Type your password again" required autoComplete="new-password" /></label>}
              {error && <div className="form-error" role="alert">{error}</div>}
              <button className="button button-dark auth-submit" disabled={loading}>{loading ? "One moment..." : mode === "login" ? "Sign in" : mode === "register" ? "Create your account" : mode === "forgot" ? "Send reset link" : "Save new password"} <ArrowRight size={16} /></button>
            </form>
          )}
          <div className="auth-switch">
            {mode === "login" && <><span>New to Inkwell?</span> <Link to="/register">Create an account</Link><Link className="forgot-link" to="/forgot-password">Forgot password?</Link></>}
            {mode === "register" && <><span>Already a member?</span> <Link to="/login">Sign in</Link></>}
            {["forgot", "reset"].includes(mode) && <Link to="/login">Remembered your password? Sign in</Link>}
          </div>
          <p className="auth-terms">By continuing, you agree to our community guidelines and promise to be kind.</p>
        </div>
      </div>
    </div>
  );
}

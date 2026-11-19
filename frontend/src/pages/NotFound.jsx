import { Link } from "react-router-dom";
import { FiArrowLeft as ArrowLeft } from "react-icons/fi";

export default function NotFound() {
  return <section className="not-found"><span className="eyebrow">A LITTLE OFF THE PAGE</span><h1>404<span>.</span></h1><p>That story seems to have wandered somewhere else.</p><Link className="button button-dark" to="/"><ArrowLeft size={15} /> Back to Inkwell</Link></section>;
}

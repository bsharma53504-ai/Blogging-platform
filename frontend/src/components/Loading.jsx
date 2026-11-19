export default function Loading({ label = "Loading stories" }) {
  return <div className="loading-state" role="status"><span className="spinner" /><span>{label}</span></div>;
}

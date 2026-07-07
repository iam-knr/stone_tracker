export default function Spinner({ className = '' }) {
  return <span className={`spinner ${className}`} aria-label="Loading" role="status" />;
}

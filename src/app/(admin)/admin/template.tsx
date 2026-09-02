/**
 * Re-mounts on every admin navigation, giving page content a barely-there
 * entrance. Pure CSS; prefers-reduced-motion turns it off entirely.
 */
export default function AdminTemplate({ children }: { children: React.ReactNode }) {
  return <div className="admin-page-enter">{children}</div>;
}

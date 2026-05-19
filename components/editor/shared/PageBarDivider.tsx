/**
 * PageBarDivider — vertical hairline used between groups of actions in
 * the editor PageBar. Pulled into a shared atom because the same
 * `w-px h-4` divider was being duplicated inline in every editor mount.
 */

export default function PageBarDivider() {
  return (
    <span
      aria-hidden
      className="self-center w-px h-4 mx-1.5"
      style={{ backgroundColor: "rgba(255, 255, 255, 0.10)" }}
    />
  );
}

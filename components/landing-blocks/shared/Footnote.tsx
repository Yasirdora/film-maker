import { getFootnoteNumber } from "@/data/footnotes";

/**
 * Renders the superscript marker that links to a footnote in the footer.
 * The number is derived from the master list in `src/data/footnotes.tsx`,
 * so reordering the list updates every marker without code changes.
 *
 * Pass `styled` for inline body-text placement (different padding/color);
 * omit it for tile/header placement that uses the plain marker style.
 */
export default function Footnote({
  id,
  styled = false,
}: {
  id: string;
  styled?: boolean;
}) {
  const number = getFootnoteNumber(id);
  if (number === null) {
    if (process.env.NODE_ENV === "development") {
      console.warn(`[Footnote] Unknown id: "${id}"`);
    }
    return null;
  }
  return (
    <a
      className={styled ? "footnote-button-styled" : "footnoteButton"}
      aria-label={`Show footnote ${number}`}
      href={`#footnote:${id}`}
    >
      <sup>{number}</sup>
    </a>
  );
}

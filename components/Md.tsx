// Minimal inline markdown: **bold**, *italic*, `code`, and line breaks.
export default function Md({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\n)/g);
  return (
    <>
      {parts.map((p, i) =>
        p === "\n" ? <br key={i} />
        : p.startsWith("**") && p.length > 4 ? <strong key={i} className="font-semibold text-on-surface">{p.slice(2, -2)}</strong>
        : p.startsWith("*") && p.length > 2 ? <em key={i}>{p.slice(1, -1)}</em>
        : p.startsWith("`") && p.length > 2 ? <code key={i} className="font-label-sm text-label-sm px-1 py-0.5 rounded bg-surface-container text-primary">{p.slice(1, -1)}</code>
        : p,
      )}
    </>
  );
}

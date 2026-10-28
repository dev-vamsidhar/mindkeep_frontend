// Obsidian-flavoured markdown: GFM (headings, lists, task lists, tables, code, links) plus
// [[wiki links]] / [[Note|alias]], #tags and ==highlights==. Output is sanitized.
import DOMPurify from "dompurify";
import { Marked, type TokenizerAndRendererExtension } from "marked";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

// title -> note id, or undefined if no such note yet.
export type Resolve = (title: string) => string | undefined;

const wiki = (resolve: Resolve): TokenizerAndRendererExtension => ({
  name: "wiki", level: "inline",
  start: (src) => { const i = src.indexOf("[["); return i < 0 ? undefined : i; },
  tokenizer(src) {
    const m = /^\[\[([^\]|\n]+)(?:\|([^\]\n]+))?\]\]/.exec(src);
    if (m) return { type: "wiki", raw: m[0], target: m[1].split("#")[0].trim(), label: (m[2] ?? m[1]).trim() };
  },
  renderer(t) {
    const id = resolve(t.target);
    return id ? `<a href="/note?id=${esc(id)}" class="wiki">${esc(t.label)}</a>` : `<a href="#" class="wiki missing" data-missing="${esc(t.target)}">${esc(t.label)}</a>`;
  },
});

const tag: TokenizerAndRendererExtension = {
  name: "tag", level: "inline",
  start: (src) => { const m = /(^|\s)#[A-Za-z][\w/-]*/.exec(src); return m ? m.index + m[1].length : undefined; },
  tokenizer(src) { const m = /^#([A-Za-z][\w/-]*)/.exec(src); if (m) return { type: "tag", raw: m[0], tag: m[1] }; },
  renderer: (t) => `<span class="tag">#${esc(t.tag)}</span>`,
};

const highlight: TokenizerAndRendererExtension = {
  name: "mark", level: "inline",
  start: (src) => { const i = src.indexOf("=="); return i < 0 ? undefined : i; },
  tokenizer(src) { const m = /^==([^=\n]+)==/.exec(src); if (m) return { type: "mark", raw: m[0], tokens: this.lexer.inlineTokens(m[1]) }; },
  renderer(t) { return `<mark>${this.parser.parseInline(t.tokens ?? [])}</mark>`; },
};

const purify = (html: string) => DOMPurify.sanitize(html, { ADD_ATTR: ["data-missing"] });
// `sanitize` is swappable only so the Node test (no DOM) can run; the app always uses DOMPurify.
export function renderMarkdown(src: string, resolve: Resolve, sanitize = purify) {
  const md = new Marked({ gfm: true, breaks: true }, { extensions: [wiki(resolve), tag, highlight] });
  const html = sanitize(md.parse(src, { async: false }) as string);
  return html.replace(/<input([^>]*?) disabled=""/g, "<input$1"); // task checkboxes are clickable (see toggleTask)
}

const TASK = /^(\s*(?:[-*+]|\d+[.)])\s+\[)([ xX])(\])/;
// Flips the nth task checkbox ("- [ ]" <-> "- [x]") in the source, skipping fenced code blocks.
export function toggleTask(src: string, n: number) {
  let fence = false, i = 0;
  return src.split("\n").map((line) => {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence;
    if (fence || !TASK.test(line)) return line;
    return i++ === n ? line.replace(TASK, (_, a, x, b) => `${a}${x === " " ? "x" : " "}${b}`) : line;
  }).join("\n");
}

// [[link]] targets in a note body, for backlinks.
export const linksIn = (src: string) => [...src.matchAll(/\[\[([^\]|\n#]+)/g)].map((m) => m[1].trim().toLowerCase());

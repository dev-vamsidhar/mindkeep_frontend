"use client";
// Obsidian-style Live Preview: markdown is styled as you type, and syntax markers (#, **, `, [[ ]], link URLs)
// are hidden on every line except the ones the cursor is on, where you edit the raw text.
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting, syntaxTree } from "@codemirror/language";
import { EditorState, StateField, type Range } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, keymap, placeholder, ViewPlugin, type ViewUpdate, WidgetType } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";
import { useEffect, useRef } from "react";
import { renderMarkdown } from "@/lib/markdown";

type Props = {
  value: string;
  onChange: (v: string) => void;
  resolve: (title: string) => string | undefined; // [[title]] -> note id
  onOpenNote: (title: string) => void;
  autoFocus?: boolean;
};

const style = HighlightStyle.define([
  { tag: t.heading, fontWeight: "600" },
  { tag: t.strong, fontWeight: "700" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strikethrough, textDecoration: "line-through" },
  { tag: t.link, color: "rgb(var(--c-primary))" },
  { tag: t.url, color: "rgb(var(--c-outline))" },
  { tag: t.monospace, fontFamily: "var(--font-mono)", fontSize: "0.88em" },
  { tag: t.processingInstruction, color: "rgb(var(--c-outline))" }, // markers that are showing (cursor line)
  { tag: t.quote, color: "rgb(var(--c-on-surface-variant))" },
]);

const theme = EditorView.theme({
  "&": { fontFamily: "var(--font-serif)", fontSize: "17px", color: "rgb(var(--c-on-surface))", backgroundColor: "transparent" },
  "&.cm-focused": { outline: "none" },
  ".cm-content": { padding: "0", lineHeight: "1.7", caretColor: "rgb(var(--c-primary))", fontFamily: "var(--font-serif)" },
  ".cm-line": { padding: "0" },
  ".cm-cursor": { borderLeftColor: "rgb(var(--c-primary))" },
  ".cm-placeholder": { color: "rgb(var(--c-outline))" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": { backgroundColor: "rgb(var(--c-primary-container) / 0.3) !important" },
  ".cm-h1": { fontSize: "1.75rem", lineHeight: "1.35", paddingTop: "0.4em !important" },
  ".cm-h2": { fontSize: "1.4rem", lineHeight: "1.4", paddingTop: "0.3em !important" },
  ".cm-h3": { fontSize: "1.15rem", paddingTop: "0.2em !important" },
  ".cm-quote": { borderLeft: "3px solid rgb(var(--c-primary-container))", paddingLeft: "1em !important", color: "rgb(var(--c-on-surface-variant))" },
  ".cm-code-line": { fontFamily: "var(--font-mono)", fontSize: "14px", backgroundColor: "rgb(var(--c-surface-container))", padding: "0 0.9em !important" },
  ".cm-fence": { color: "rgb(var(--c-outline))" },
  ".cm-inline-code": { fontFamily: "var(--font-mono)", fontSize: "0.85em", padding: "0.1em 0.35em", borderRadius: "0.25rem", backgroundColor: "rgb(var(--c-surface-container))", color: "rgb(var(--c-primary))" },
  ".cm-wiki": { color: "rgb(var(--c-primary))", borderBottom: "1px solid rgb(var(--c-primary) / 0.4)", cursor: "pointer" },
  ".cm-wiki-missing": { color: "rgb(var(--c-outline))", borderBottomStyle: "dashed" },
  ".cm-link-text": { color: "rgb(var(--c-primary))", textDecoration: "underline", textUnderlineOffset: "2px", cursor: "pointer" },
  ".cm-tag": { fontFamily: "var(--font-mono)", fontSize: "0.85em", padding: "0.05em 0.45em", borderRadius: "0.25rem", backgroundColor: "rgb(var(--c-secondary-container))", color: "rgb(var(--c-on-secondary-fixed-variant))" },
  ".cm-hl": { backgroundColor: "rgb(217 154 50 / 0.35)", borderRadius: "0.125rem" },
  ".cm-done": { color: "rgb(var(--c-outline))", textDecoration: "line-through" },
  ".cm-bullet": { color: "rgb(var(--c-outline))", display: "inline-block", width: "1.1em" },
  ".cm-task": { width: "1rem", height: "1rem", margin: "0 0.45em 0 0", verticalAlign: "-0.15em", accentColor: "rgb(var(--c-primary-container))", cursor: "pointer" },
  ".cm-table": { margin: "0.25em 0", cursor: "text", whiteSpace: "normal" },
  ".cm-hr": { display: "inline-block", width: "100%", borderTop: "1px solid rgb(var(--c-outline-variant))", verticalAlign: "middle" },
});

class Checkbox extends WidgetType {
  constructor(readonly checked: boolean, readonly pos: number) { super(); }
  eq(o: Checkbox) { return o.checked === this.checked && o.pos === this.pos; }
  toDOM(view: EditorView) {
    const box = document.createElement("input");
    box.type = "checkbox";
    box.className = "cm-task";
    box.checked = this.checked;
    box.onmousedown = (e) => {
      e.preventDefault(); // tick without moving the cursor onto the line
      view.dispatch({ changes: { from: this.pos + 1, to: this.pos + 2, insert: this.checked ? " " : "x" } });
    };
    return box;
  }
  ignoreEvent() { return true; }
}
class Text extends WidgetType {
  constructor(readonly text: string, readonly cls: string) { super(); }
  eq(o: Text) { return o.text === this.text && o.cls === this.cls; }
  toDOM() { const s = document.createElement("span"); s.className = this.cls; s.textContent = this.text; return s; }
}

class Table extends WidgetType {
  constructor(readonly src: string) { super(); }
  eq(o: Table) { return o.src === this.src; }
  toDOM() { const d = document.createElement("div"); d.className = "md cm-table"; d.innerHTML = renderMarkdown(this.src, () => undefined); return d; }
  ignoreEvent() { return false; } // a click puts the cursor in the table, which shows its source
}

// Tables are rendered as real tables unless the cursor is inside one. Block widgets have to come from a state field.
const tables = StateField.define<DecorationSet>({
  create: (s) => tableDecos(s),
  update: (d, tr) => (tr.docChanged || tr.selection ? tableDecos(tr.state) : d),
  provide: (f) => EditorView.decorations.from(f),
});
function tableDecos(state: EditorState) {
  const deco: Range<Decoration>[] = [];
  syntaxTree(state).iterate({
    enter: (n) => {
      if (n.name !== "Table") return;
      const from = state.doc.lineAt(n.from).from, to = state.doc.lineAt(n.to).to;
      if (state.selection.ranges.some((r) => r.to >= from && r.from <= to)) return false;
      deco.push(Decoration.replace({ widget: new Table(state.sliceDoc(from, to)), block: true }).range(from, to));
      return false;
    },
  });
  return Decoration.set(deco);
}

const hide = Decoration.replace({});
const INLINE_RX = /\[\[([^\]|\n]+)(?:\|([^\]\n]+))?\]\]|(^|\s)(#[A-Za-z][\w/-]*)|==([^=\n]+)==/g;

function build(view: EditorView, resolve: Props["resolve"]): DecorationSet {
  const { state } = view;
  const active = new Set<number>();
  for (const r of state.selection.ranges) {
    if (!view.hasFocus && r.empty) continue; // unfocused: render everything
    for (let l = state.doc.lineAt(r.from).number; l <= state.doc.lineAt(r.to).number; l++) active.add(l);
  }
  const isActive = (pos: number) => active.has(state.doc.lineAt(pos).number);
  const deco: Range<Decoration>[] = [];
  const tree = syntaxTree(state);

  for (const { from, to } of view.visibleRanges) {
    tree.iterate({
      from, to,
      enter: (n) => {
        const name = n.name;
        const on = isActive(n.from);
        const h = /^ATXHeading(\d)$/.exec(name);
        if (h) deco.push(Decoration.line({ class: `cm-h${Math.min(+h[1], 3)}` }).range(state.doc.lineAt(n.from).from));
        else if (name === "HeaderMark" && !on) deco.push(hide.range(n.from, Math.min(n.to + 1, state.doc.lineAt(n.from).to)));
        else if ((name === "EmphasisMark" || name === "StrikethroughMark") && !on) deco.push(hide.range(n.from, n.to));
        else if (name === "InlineCode") {
          deco.push(Decoration.mark({ class: "cm-inline-code" }).range(n.from, n.to));
        } else if (name === "CodeMark" && !on && n.node.parent?.name === "InlineCode") deco.push(hide.range(n.from, n.to));
        else if (name === "FencedCode") {
          for (let l = state.doc.lineAt(n.from).number; l <= state.doc.lineAt(n.to).number; l++) {
            const line = state.doc.line(l);
            const fence = l === state.doc.lineAt(n.from).number || (l === state.doc.lineAt(n.to).number && /^\s*(```|~~~)/.test(line.text));
            deco.push(Decoration.line({ class: `cm-code-line${fence ? " cm-fence" : ""}` }).range(line.from));
          }
          return false; // nothing inside code is markdown
        } else if (name === "Blockquote") {
          for (let l = state.doc.lineAt(n.from).number; l <= state.doc.lineAt(n.to).number; l++) deco.push(Decoration.line({ class: "cm-quote" }).range(state.doc.line(l).from));
        } else if (name === "QuoteMark" && !on) deco.push(hide.range(n.from, Math.min(n.to + 1, state.doc.lineAt(n.from).to)));
        else if (name === "Link" && !on) {
          const url = n.node.getChild("URL");
          const marks = n.node.getChildren("LinkMark");
          if (url && marks.length >= 2) {
            deco.push(hide.range(marks[0].from, marks[0].to));
            deco.push(Decoration.mark({ class: "cm-link-text", attributes: { "data-url": state.sliceDoc(url.from, url.to) } }).range(marks[0].to, marks[1].from));
            deco.push(hide.range(marks[1].from, n.to));
          }
          return false;
        } else if (name === "ListMark" && !on) {
          const task = n.node.parent?.getChild("Task");
          if (task) deco.push(hide.range(n.from, Math.min(n.to + 1, task.from)));
          else if (/^[-*+]$/.test(state.sliceDoc(n.from, n.to))) deco.push(Decoration.replace({ widget: new Text("•", "cm-bullet") }).range(n.from, n.to + 1));
        } else if (name === "TaskMarker") {
          const checked = /x/i.test(state.sliceDoc(n.from, n.to));
          if (!on) deco.push(Decoration.replace({ widget: new Checkbox(checked, n.from) }).range(n.from, Math.min(n.to + 1, state.doc.lineAt(n.from).to)));
          if (checked) deco.push(Decoration.mark({ class: "cm-done" }).range(n.to, state.doc.lineAt(n.from).to));
        } else if (name === "HorizontalRule" && !on) deco.push(Decoration.replace({ widget: new Text("", "cm-hr") }).range(n.from, n.to));
      },
    });

    // Obsidian-only syntax the markdown parser doesn't know: [[wiki links]], #tags, ==highlights==.
    const text = state.sliceDoc(from, to);
    for (const m of text.matchAll(INLINE_RX)) {
      const start = from + m.index!;
      const inCode = (p: number) => { for (let x: ReturnType<typeof tree.resolveInner> | null = tree.resolveInner(p, 1); x; x = x.parent) if (/Code/.test(x.name)) return true; return false; };
      if (inCode(start)) continue;
      const on = isActive(start);
      if (m[1]) {
        const target = m[1].split("#")[0].trim();
        const end = start + m[0].length;
        const cls = `cm-wiki${resolve(target) ? "" : " cm-wiki-missing"}`;
        if (on) deco.push(Decoration.mark({ class: cls }).range(start, end));
        else {
          const labelFrom = m[2] ? start + 2 + m[1].length + 1 : start + 2;
          deco.push(hide.range(start, labelFrom));
          deco.push(Decoration.mark({ class: cls, attributes: { "data-wiki": target } }).range(labelFrom, end - 2));
          deco.push(hide.range(end - 2, end));
        }
      } else if (m[4]) {
        const s = start + m[3].length;
        deco.push(Decoration.mark({ class: "cm-tag" }).range(s, s + m[4].length));
      } else if (m[5]) {
        const end = start + m[0].length;
        if (on) deco.push(Decoration.mark({ class: "cm-hl" }).range(start, end));
        else { deco.push(hide.range(start, start + 2)); deco.push(Decoration.mark({ class: "cm-hl" }).range(start + 2, end - 2)); deco.push(hide.range(end - 2, end)); }
      }
    }
  }
  return Decoration.set(deco, true);
}

export default function LiveEditor({ value, onChange, resolve, onOpenNote, autoFocus }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const props = useRef({ onChange, resolve, onOpenNote });
  props.current = { onChange, resolve, onOpenNote };

  useEffect(() => {
    const preview = ViewPlugin.fromClass(class {
      decorations: DecorationSet;
      constructor(v: EditorView) { this.decorations = build(v, (x) => props.current.resolve(x)); }
      update(u: ViewUpdate) {
        if (u.docChanged || u.viewportChanged || u.selectionSet || u.focusChanged || syntaxTree(u.startState) !== syntaxTree(u.state))
          this.decorations = build(u.view, (x) => props.current.resolve(x));
      }
    }, { decorations: (p) => p.decorations });

    const v = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: value,
        extensions: [
          history(),
          keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
          markdown({ base: markdownLanguage }), // GFM: task lists, tables, strikethrough
          syntaxHighlighting(style),
          EditorView.lineWrapping,
          placeholder("Start writing. # Heading, - [ ] task, [[Another note]], #tag, ==highlight=="),
          theme,
          preview,
          tables,
          EditorView.updateListener.of((u) => { if (u.docChanged) props.current.onChange(u.state.doc.toString()); }),
          EditorView.domEventHandlers({
            mousedown(e) {
              const el = (e.target as HTMLElement).closest<HTMLElement>("[data-wiki],[data-url]");
              if (!el) return false;
              e.preventDefault();
              if (el.dataset.wiki) props.current.onOpenNote(el.dataset.wiki);
              else window.open(el.dataset.url, "_blank", "noopener");
              return true;
            },
          }),
        ],
      }),
    });
    view.current = v;
    if (autoFocus) v.focus();
    return () => v.destroy();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Outside changes (e.g. synced from another device) replace the text; our own typing already matches.
  useEffect(() => {
    const v = view.current;
    if (v && v.state.doc.toString() !== value) v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } });
  }, [value]);

  return <div ref={host} className="min-h-[60vh] cursor-text" onClick={(e) => e.target === e.currentTarget && view.current?.focus()} />;
}

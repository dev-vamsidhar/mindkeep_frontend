import { test } from "node:test";
import assert from "node:assert/strict";
import { linksIn, renderMarkdown, toggleTask } from "./markdown.ts";

const resolve = (t: string) => (t.toLowerCase() === "day 1" ? "n1" : undefined);

test("renders Obsidian syntax", () => {
  const html = renderMarkdown("# Title\n- [ ] todo\n- [x] done\n\nSee [[Day 1]], [[Day 1|yesterday]] and [[Day 2]] #idea ==key== `#nottag`", resolve, (h) => h);
  assert.match(html, /<h1[^>]*>Title<\/h1>/);
  assert.match(html, /<a href="\/notes\/n1" class="wiki">Day 1<\/a>/);
  assert.match(html, /class="wiki">yesterday</);
  assert.match(html, /class="wiki missing" data-missing="Day 2"/);
  assert.match(html, /<span class="tag">#idea<\/span>/);
  assert.match(html, /<mark>key<\/mark>/);
  assert.match(html, /<code>#nottag<\/code>/);
  assert.equal((html.match(/type="checkbox"/g) ?? []).length, 2);
  assert.doesNotMatch(html, /disabled/);
});

test("toggles the nth task, ignoring code fences", () => {
  const src = "- [ ] a\n```\n- [ ] in code\n```\n- [x] b";
  assert.equal(toggleTask(src, 0), "- [x] a\n```\n- [ ] in code\n```\n- [x] b");
  assert.equal(toggleTask(src, 1), "- [ ] a\n```\n- [ ] in code\n```\n- [ ] b");
});

test("finds wiki link targets", () => {
  assert.deepEqual(linksIn("[[A]] and [[b|alias]] and [[C#Heading]]"), ["a", "b", "c"]);
});

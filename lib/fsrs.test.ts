import { test } from "node:test";
import assert from "node:assert/strict";
import { next, preview, State, type Sched } from "./fsrs.ts";

const DAY = 86_400_000;
const fresh: Sched = { state: State.New, due: 0, stability: 0, difficulty: 0, reps: 0, lapses: 0, last_review: null };

test("new card intervals grow with rating", () => {
  const p = preview(fresh, 0);
  assert.equal(p[1], 10 * 60_000);
  assert.ok(p[2] < p[3] && p[3] < p[4], JSON.stringify(p));
  assert.equal(p[3], 4 * DAY); // S0(Good) = 3.7 days
});

test("successful reviews lengthen intervals, a lapse shortens them", () => {
  let c = next(fresh, 3, 0);
  const first = c.due;
  c = next(c, 3, c.due);
  assert.equal(c.state, State.Review);
  assert.ok(c.due - first > first, "second interval should exceed the first");

  const lapsed = next(c, 1, c.due);
  assert.equal(lapsed.state, State.Relearning);
  assert.equal(lapsed.lapses, 1);
  assert.ok(lapsed.stability < c.stability);
  assert.ok(lapsed.difficulty > c.difficulty);
});

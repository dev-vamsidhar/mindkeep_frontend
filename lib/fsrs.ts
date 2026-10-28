// FSRS-4.5 scheduler (https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm).
// ponytail: default weights for everyone; per-user optimized weights would need the optimizer over review logs.
const W = [0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755];
const DECAY = -0.5;
const FACTOR = 19 / 81; // makes R(S, S) = 0.9
const RETENTION = 0.9;
const DAY = 86_400_000;
const RELEARN_MS = 10 * 60_000; // "Again" brings the card back in 10 minutes

export const State = { New: 0, Learning: 1, Review: 2, Relearning: 3 } as const;
export type State = (typeof State)[keyof typeof State];
export type Rating = 1 | 2 | 3 | 4; // Again, Hard, Good, Easy

export type Sched = {
  state: State;
  due: number;
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  last_review: number | null;
};

const clampD = (d: number) => Math.min(10, Math.max(1, d));
const initD = (g: Rating) => clampD(W[4] - (g - 3) * W[5]);
export const retrievability = (days: number, s: number) => Math.pow(1 + FACTOR * days / s, DECAY);

export function next(c: Sched, g: Rating, now: number): Sched {
  let s: number, d: number;
  if (c.state === State.New) {
    s = W[g - 1];
    d = initD(g);
  } else {
    const r = retrievability(c.last_review != null ? Math.max(0, (now - c.last_review) / DAY) : 0, c.stability);
    s = g === 1
      ? W[11] * Math.pow(c.difficulty, -W[12]) * (Math.pow(c.stability + 1, W[13]) - 1) * Math.exp(W[14] * (1 - r))
      : c.stability * (1 + Math.exp(W[8]) * (11 - c.difficulty) * Math.pow(c.stability, -W[9]) *
          (Math.exp(W[10] * (1 - r)) - 1) * (g === 2 ? W[15] : 1) * (g === 4 ? W[16] : 1));
    d = clampD(W[7] * initD(3) + (1 - W[7]) * (c.difficulty - W[6] * (g - 3)));
  }
  s = Math.max(0.01, s);

  const again = g === 1;
  const days = Math.min(36500, Math.max(1, Math.round((s / FACTOR) * (Math.pow(RETENTION, 1 / DECAY) - 1))));
  return {
    state: again ? (c.state === State.Review || c.state === State.Relearning ? State.Relearning : State.Learning) : State.Review,
    due: again ? now + RELEARN_MS : now + days * DAY,
    stability: s,
    difficulty: d,
    reps: c.reps + 1,
    lapses: c.lapses + (again && c.state === State.Review ? 1 : 0),
    last_review: now,
  };
}

// Due time for each rating, so the UI can label the buttons ("< 10 min", "4 days", ...).
export const preview = (c: Sched, now: number) =>
  Object.fromEntries(([1, 2, 3, 4] as Rating[]).map((g) => [g, next(c, g, now).due - now])) as Record<Rating, number>;

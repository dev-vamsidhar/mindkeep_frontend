// Sample deck offered on an empty library.
export const sample: { name: string; cards: [string, string][] }[] = [
  {
    name: "Data Structures & Algos", cards: [
      ["Binary search time complexity?", "**O(log n)** worst and average, O(1) best."],
      ["Amortized cost of dynamic array append?", "**O(1)** — resizing doubles capacity, cost spreads over appends."],
      ["Why `mid = low + (high - low) // 2`?", "Avoids integer overflow of `low + high`."],
      ["BFS vs DFS data structure?", "BFS uses a **queue**, DFS uses a **stack**."],
      ["Hash table collision strategies?", "Chaining, open addressing (linear / quadratic probing), double hashing."],
      ["Heap insert complexity?", "**O(log n)** — sift up."],
    ],
  },
  {
    name: "System Design", cards: [
      ["Raft: what triggers leader step-down?", "Seeing a higher **term** in any RPC."],
      ["What does consistent hashing solve?", "Minimal key remapping when nodes join or leave."],
      ["LRU vs LFU eviction?", "LRU evicts least *recently* used; LFU least *frequently* used."],
      ["Replication lag causes?", "Network delay, slow followers, large write bursts."],
    ],
  },
  {
    name: "JavaScript Core", cards: [
      ["Microtask vs macrotask?", "Microtasks (promises) drain fully before the next macrotask (timers, I/O)."],
      ["What is a V8 hidden class?", "Shared object shape enabling fast property access via inline caches."],
      ["Prototype delegation?", "Missing properties are looked up along the `[[Prototype]]` chain."],
    ],
  },
  {
    name: "Machine Learning", cards: [
      ["Backprop in one line?", "Chain rule applied layer by layer to get ∂loss/∂weights."],
      ["Why gradient clipping?", "Prevents exploding gradients by capping the norm."],
      ["L2 regularization effect?", "Penalizes large weights → smoother models."],
    ],
  },
  {
    name: "CS Fundamentals", cards: [
      ["Process vs thread?", "Threads share memory within a process; processes are isolated."],
      ["What is a deadlock?", "Circular wait on resources; none can proceed."],
    ],
  },
];

"use client";
/** @jsxRuntime automatic */
/** @jsxImportSource preact */

// Real `"use client"` island reached through the generated registry. It is
// intentionally not statically imported by a host `pages/` file.

import { useState } from "preact/hooks";

export default function Counter(props: { start?: number }) {
  const [count, setCount] = useState(props.start ?? 0);
  return (
    <button type="button" data-counter onClick={() => setCount((c) => c + 1)}>
      count: {count}
    </button>
  );
}

Counter.displayName = "Counter";

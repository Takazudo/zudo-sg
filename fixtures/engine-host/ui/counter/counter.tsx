"use client";
/** @jsxRuntime automatic */
/** @jsxImportSource preact */

// Real `"use client"` island for the foreign-install verify script (ADR
// finding 4 amendment, #707/#714): reached only through
// `virtual:zudo-sg-registry` (never statically imported by a host `pages/`
// file), it proves half (b) of the amendment — the island scanner resolving
// plugin virtual modules — independently of `ConfiguredPreviewApp`, which
// proves half (a) through the injected route entrypoint.

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

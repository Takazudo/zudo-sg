"use client";
import { signal } from "@takazudo/zfb/zudo-react";
export function Counter() { const count = signal(0); return <button id="spike-counter" on:click={() => count.value++}>{count}</button>; }

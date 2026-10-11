"use client";
import { getScope } from "@takazudo/zfb/zudo-react";
export function Dashboard() { const scope = getScope(); const ref = { current: null as HTMLDivElement | null }; scope.onActivate(() => { let cleanup: undefined | (() => void); let alive = true; import("zfb4-spike-routes/adapter").then(({ mountDashboard }) => { if (alive && ref.current) cleanup = mountDashboard(ref.current, { tabs: [], title: "Spike Dashboard" }); }); return () => { alive = false; cleanup?.(); }; }); return <div id="spike-dashboard" ref={ref} />; }

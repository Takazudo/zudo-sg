import { h, render } from "preact";
import { TokenDashboard } from "@takazudo/zdtp/dashboard";
export function mountDashboard(host, props) { render(h(TokenDashboard, props), host); return () => render(null, host); }

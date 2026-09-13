// The root host's styleguide sidebar tree, built once from the registry
// instance. The desktop SidebarTree island and the mobile SidebarToggle drawer
// share this single array.

import { buildNavNodes } from "@takazudo/zudo-sg/registry";
import type { NavNode } from "@/utils/docs";
import { withBase } from "@/utils/base";
import { registry } from "./registry";

export const navNodes: NavNode[] = buildNavNodes(registry, { withBase });

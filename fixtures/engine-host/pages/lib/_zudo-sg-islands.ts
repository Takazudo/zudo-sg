// Dev-hydration seed (docs/adr/styleguide-engine.md finding 4): `zfb dev`
// scans host pages/ only, so the engine's own islands (reachable otherwise
// only through the injected package routes) must be statically imported from
// here.
import "@takazudo/zudo-sg/islands";

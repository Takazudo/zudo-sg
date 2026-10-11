// Keep the scan of dist JS outside zfb's configured output exclusion.
import { engineWindDefaults } from "../src/config/wind.ts";
export default { outDir: ".wind-manifest-output", wind: engineWindDefaults };

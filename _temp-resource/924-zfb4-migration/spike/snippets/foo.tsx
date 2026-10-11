import { Island } from "@takazudo/zfb";
import { getEntry } from "@takazudo/zfb/content";
import { chromeBindings } from "virtual:zudo-doc-chrome-bindings";
import { Counter } from "../client/Counter.js";
import { Dashboard } from "../client/Dashboard.js";
export default function Foo() { const doc = getEntry("docs", "getting-started/introduction"); return <html><head><title>Packed spike</title></head><body><h1>Packed source route</h1><div id="binding-proof">{chromeBindings.homeExtras?.({ locale: "en" })}</div>{doc && <doc.Content components={{ h2: (props) => <h2 data-spike-mdx="true">{props.children}</h2> }} />}<Island when="load" ssrFallback={<span>Loading counter</span>}><Counter /></Island><Island when="load"><Dashboard /></Island></body></html>; }

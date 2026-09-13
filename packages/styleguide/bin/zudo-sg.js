#!/usr/bin/env node
import { runZudoSgCli } from "../dist/cli/bin.js";

runZudoSgCli(process.argv.slice(2)).then((code) => {
  process.exitCode = code;
});

import { App } from "./App.js";

const debugFlag = process.argv.includes("--debug-mode");
App.start(debugFlag);

console.log("Dataset Editor started!");

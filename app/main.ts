import { App } from "./App.js";
import sharp from "sharp";

sharp.cache({ files: 0 });

const debugFlag = process.argv.includes("--debug-mode");
await App.start(debugFlag);

console.log("Dataset Editor started!");

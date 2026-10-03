// The one place that imports llama.rn, so that web can swap it out (llama.web.ts): the package
// looks up its native module at import time, which fails web's static render.
export { initLlama } from "llama.rn";

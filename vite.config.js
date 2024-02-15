// import { splitVendorChunkPlugin, defineConfig } from 'vite';
// import { dependencies } from './package.json';
// import topLevelAwait from "vite-plugin-top-level-await";

// function renderChunks(deps) {
//   let chunks = {};
//   Object.keys(deps).forEach((key) => {
//     if ([].includes(key)) return;
//     chunks[key] = [key];
//   });
//   return chunks;
// }

// export default defineConfig({
//     plugins: [splitVendorChunkPlugin(), topLevelAwait()],
//     build: {
//         sourcemap: false,
//         rollupOptions: {
//           output: {
//             manualChunks: {
//               file: "dist/index.js", 
//               format: "esm",
//               vendor: [],
//               ...renderChunks(dependencies),
//             },
//           },
//         },
//       },
//   })

import { defineConfig } from "vite";
import topLevelAwait from "vite-plugin-top-level-await";


export default defineConfig({
  plugins: [
    topLevelAwait()
  ]
})
/** @type {import('npm:vite').UserConfig} */
export default {
  root: ".",
  publicDir: "public",
  server: {
    port: 8080,
    open: true,
  },
  build: {
    outDir: "dist",
  },
};

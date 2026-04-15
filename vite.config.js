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
        rollupOptions: {
            output: {
                manualChunks: {
                    // Phaser is ~1.1MB minified / ~355KB gzip and doesn't change
                    // between deploys — split it so repeat visitors skip re-downloading.
                    phaser: ["phaser"],
                },
            },
        },
    },
};

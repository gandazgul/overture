import { join } from "jsr:@std/path";
import { existsSync } from "jsr:@std/fs/exists";

/**
 * Rewrite /rules to generated page and serve it directly.
 * @returns {import('npm:vite').Plugin}
 */
function rulesRoutePlugin() {
    const rewriteRulesPath = async (req, res, next) => {
        if (!req.url) return next();

        const [pathname] = req.url.split("?");

        if (pathname === "/rules" || pathname === "/rules/") {
            const rulesFile = join(Deno.cwd(), "public", "rules.html");

            // 1. Generate the file if it's missing
            if (!existsSync(rulesFile)) {
                console.log("Generating rules page...");
                const command = new Deno.Command(Deno.execPath(), {
                    args: [
                        "run",
                        "-A",
                        join(Deno.cwd(), 'scripts', 'generate-rules-page.js'),
                    ],
                });

                const { code, stderr } = await command.output();
                if (code !== 0) {
                    res.statusCode = 500;
                    return res.end(new TextDecoder().decode(stderr));
                }
            }

            // 2. Serve the file MANUALLY
            try {
                const content = await Deno.readFile(rulesFile);
                res.setHeader("Content-Type", "text/html");
                res.statusCode = 200;

                return res.end(content);
            } catch (err) {
                console.error("Failed to read generated file:", err);
                res.statusCode = 500;

                return res.end("Error reading generated rules.");
            }
        }

        next();
    };

    return {
        name: "rules-route-plugin",
        configureServer(server) {
            // Use 'pre' to ensure our middleware runs before Vite's internal SPA fallback
            server.middlewares.use(rewriteRulesPath);
        },
        configurePreviewServer(server) {
            server.middlewares.use(rewriteRulesPath);
        },
    };
}

/** @type {import('npm:vite').UserConfig} */
export default {
    root: ".",
    base: "./", // Use relative asset paths
    publicDir: "public",
    plugins: [rulesRoutePlugin()],
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

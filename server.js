import { serveDir, serveFile } from "jsr:@std/http/file-server";

Deno.serve({ port: 8080, hostname: "0.0.0.0" }, (req) => {
    const url = new URL(req.url);

    // Friendly rulebook route: /rules should resolve without /index.html.
    if (url.pathname === "/rules" || url.pathname === "/rules/") {
        return serveFile(req, "dist/rules/index.html");
    }

    return serveDir(req, {
        fsRoot: "dist",
        quiet: true,
    });
});

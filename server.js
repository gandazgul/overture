import { serveDir } from "jsr:@std/http/file-server";

Deno.serve({ port: 8080, hostname: "0.0.0.0" }, (req) => {
    return serveDir(req, {
        fsRoot: "dist",
        quiet: true,
    });
});

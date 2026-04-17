import { serveDir } from "@std/http/file-server";

/**
 * @param {Request} req
 */
function handleStatic(req) {
    return serveDir(req, {
        fsRoot: "dist",
        quiet: true,
    });
}

export { handleStatic };

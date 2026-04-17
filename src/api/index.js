import { serveFile } from "@std/http/file-server";

/**
 * @param {Request} req
 */
function handleIndex(req) {
    return serveFile(req, "dist/index.html");
}

export { handleIndex };

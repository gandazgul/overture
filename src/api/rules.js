import { serveFile } from "@std/http/file-server";

/**
 * @param {Request} req
 */
function handleRules(req) {
    return serveFile(req, "dist/rules/index.html");
}

export { handleRules };

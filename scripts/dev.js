import { join } from "jsr:@std/path";

const serverProcess = new Deno.Command(Deno.execPath(), {
    args: ["run", "-A", "--env-file", "server.js"],
    env: { PORT: "8081" },
    stdout: "inherit",
    stderr: "inherit",
}).spawn();

const viteProcess = new Deno.Command(Deno.execPath(), {
    args: ["run", "-A", "npm:vite@5", "dev"],
    stdout: "inherit",
    stderr: "inherit",
}).spawn();

Deno.addSignalListener("SIGINT", () => {
    serverProcess.kill("SIGINT");
    viteProcess.kill("SIGINT");
    Deno.exit(0);
});

Promise.all([serverProcess.status, viteProcess.status]).then(() => {
    Deno.exit(0);
});

/// <reference lib="deno.ns" />
import { Layouts } from "../types.js";
import { summarizeExperiment } from "./experiment.js";

/** @typedef {import('./experiment.js').ExperimentConfig} ExperimentConfig */
/** @typedef {import('./experiment.js').UnitResult} UnitResult */
/**
 * @typedef {ExperimentConfig & {workers: number, candidate: string, baselineRef: string, baselineFile: string | null}} CliConfig
 */

/** @param {string[]} args @returns {CliConfig} */
export function parseExperimentArgs(args) {
    /** @type {CliConfig} */
    const config = {
        mode: "compare",
        samples: 5000,
        seed: 2000001,
        workers: Math.min(12, navigator.hardwareConcurrency || 4),
        layout: "grand-empress",
        opening: "random",
        turnOrder: "fixed",
        tiebreak: "live",
        winTolerance: 0.01,
        scoreTolerance: 0.5,
        candidate: "src/ai.js",
        baselineRef: "a53fc75",
        baselineFile: null,
        candidateOptions: {},
    };
    for (let i = 0; i < args.length; i += 2) {
        const flag = args[i];
        const value = args[i + 1];
        if (value === undefined || value.startsWith("--")) throw new Error(`Missing value for ${flag}`);
        switch (flag) {
            case "--mode":
                if (value !== "compare" && value !== "balance") throw new Error("--mode must be compare or balance");
                config.mode = value;
                break;
            case "--samples":
                config.samples = Number(value);
                break;
            case "--seed":
                config.seed = Number(value);
                break;
            case "--workers":
                config.workers = Number(value);
                break;
            case "--layout":
                config.layout = value;
                break;
            case "--candidate":
                config.candidate = value;
                break;
            case "--baseline-ref":
                config.baselineRef = value;
                break;
            case "--baseline-file":
                config.baselineFile = value;
                break;
            case "--win-tolerance":
                config.winTolerance = Number(value);
                break;
            case "--score-tolerance":
                config.scoreTolerance = Number(value);
                break;
            case "--potential-scale":
                config.candidateOptions = { ...config.candidateOptions, potentialScale: Number(value) };
                break;
            case "--future-weight":
                config.candidateOptions = { ...config.candidateOptions, futureWeight: Number(value) };
                break;
            case "--blind-first":
                if (value !== "true" && value !== "false") throw new Error("--blind-first must be true or false");
                config.candidateOptions = { ...config.candidateOptions, blindFirst: value === "true" };
                break;
            case "--baseline-potential-scale":
                config.baselineOptions = { ...config.baselineOptions, potentialScale: Number(value) };
                break;
            case "--baseline-future-weight":
                config.baselineOptions = { ...config.baselineOptions, futureWeight: Number(value) };
                break;
            case "--baseline-blind-first":
                if (value !== "true" && value !== "false") {
                    throw new Error("--baseline-blind-first must be true or false");
                }
                config.baselineOptions = { ...config.baselineOptions, blindFirst: value === "true" };
                break;
            case "--opening":
                if (value !== "random" && value !== "fixed") throw new Error("--opening must be random or fixed");
                config.opening = value;
                break;
            case "--turn-order":
                if (value !== "fixed" && value !== "rotating") {
                    throw new Error("--turn-order must be fixed or rotating");
                }
                config.turnOrder = value;
                break;
            case "--tiebreak":
                if (value !== "live" && value !== "noisy-later" && value !== "diversity-later") {
                    throw new Error("--tiebreak must be live, noisy-later, or diversity-later");
                }
                config.tiebreak = value;
                break;
            default:
                throw new Error(`Unknown option: ${flag}`);
        }
    }
    for (const key of /** @type {const} */ (["samples", "workers"])) {
        if (!Number.isSafeInteger(config[key]) || config[key] < 1) throw new Error(`${key} must be a positive integer`);
    }
    if (!Number.isSafeInteger(config.seed) || config.seed < 0 || config.seed + config.samples > 2 ** 32) {
        throw new Error("Seed range must fit in uint32 without wrapping or repeating");
    }
    if (!Layouts[config.layout]) throw new Error(`Unknown layout: ${config.layout}`);
    if (!(config.winTolerance > 0 && config.winTolerance < 0.5)) throw new Error("Invalid win tolerance");
    if (!(config.scoreTolerance > 0 && Number.isFinite(config.scoreTolerance))) {
        throw new Error("Invalid score tolerance");
    }
    for (const options of [config.candidateOptions, config.baselineOptions]) {
        for (const [key, value] of Object.entries(options ?? {})) {
            if (key === "blindFirst") continue;
            if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 2) {
                throw new Error(`${key} must be between 0 and 2`);
            }
        }
    }
    if (config.mode === "balance" && config.baselineOptions) throw new Error("Balance mode has no baseline policy");
    return config;
}

/** @param {string} content */
async function sha256(content) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(content));
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** @param {string[]} args @param {URL} root */
async function git(args, root) {
    const result = await new Deno.Command("git", { args, cwd: root, stdout: "piped", stderr: "piped" }).output();
    if (!result.success) throw new Error(new TextDecoder().decode(result.stderr));
    return new TextDecoder().decode(result.stdout);
}

/**
 * Freeze the pure runtime for the entire run. Historical AI shares the current
 * scoring rules and RNG with the candidate, while its source remains unchanged.
 * @param {CliConfig} config
 * @param {URL} directory
 * @param {URL} root
 */
async function snapshot(config, directory, root) {
    const source = new URL("source/", directory);
    await Deno.mkdir(new URL("simulator/", source), { recursive: true });
    const files = [
        "scoring.js",
        "types.js",
        "utils.js",
        "winner.js",
        "simulator/simulator.js",
        "simulator/experiment.js",
        "simulator/experiment-worker.js",
    ];
    /** @type {Record<string, string>} */
    const hashes = {};
    for (const file of files) {
        const text = await Deno.readTextFile(new URL(`src/${file}`, root));
        await Deno.writeTextFile(new URL(file, source), text);
        hashes[file] = await sha256(text);
    }
    const candidate = await Deno.readTextFile(new URL(config.candidate, root));
    let baseline = candidate;
    let baselineRevision = null;
    if (config.mode === "compare") {
        if (config.baselineFile) {
            baseline = await Deno.readTextFile(new URL(config.baselineFile, root));
        } else {
            baselineRevision =
                (await git(["rev-parse", "--verify", "--end-of-options", `${config.baselineRef}^{commit}`], root))
                    .trim();
            baseline = await git(["show", `${baselineRevision}:src/ai.js`], root);
        }
    }
    await Deno.writeTextFile(new URL("ai.js", source), candidate);
    await Deno.writeTextFile(new URL("baseline.js", source), baseline);
    hashes["ai.js"] = await sha256(candidate);
    hashes["baseline.js"] = await sha256(baseline);
    return { source, hashes, baselineRevision };
}

/** @param {CliConfig} config */
async function run(config) {
    const root = new URL("../../", import.meta.url);
    const id = `experiment_${new Date().toISOString().replace(/[:.]/g, "-")}_${crypto.randomUUID().slice(0, 8)}`;
    const directory = new URL(`sim-results/${id}/`, root);
    await Deno.mkdir(directory, { recursive: true });
    const { source, hashes, baselineRevision } = await snapshot(config, directory, root);
    const manifest = {
        config,
        hashes,
        baselineRevision,
        createdAt: new Date().toISOString(),
        runtime: Deno.version,
        platform: Deno.build,
        intervalUnit: config.mode === "compare" ? "seed pair" : "game seed",
        // Set before any outcomes are observed, so the target cannot drift.
        criteria: {
            winRate: [0.5 - config.winTolerance, 0.5 + config.winTolerance],
            vpMargin: [-config.scoreTolerance, config.scoreTolerance],
        },
    };
    await Deno.writeTextFile(new URL("manifest.json", directory), JSON.stringify(manifest, null, 2));
    const output = await Deno.open(new URL("samples.jsonl", directory), { write: true, createNew: true });
    const encoder = new TextEncoder();
    /** @type {UnitResult[]} */
    const units = [];
    /** @type {Worker[]} */
    const workers = [];
    let completed = 0;
    let lastProgress = performance.now();
    const startTime = performance.now();
    console.log(`${config.mode}: ${config.samples} independent samples; ${directory.pathname}`);
    console.log(`Candidate ${hashes["ai.js"]}; baseline ${hashes["baseline.js"]}`);
    try {
        const workerCount = Math.min(config.workers, config.samples);
        /** @type {Promise<void>[]} */
        const jobs = [];
        for (let w = 0; w < workerCount; w++) {
            const start = Math.floor(w * config.samples / workerCount);
            const end = Math.floor((w + 1) * config.samples / workerCount);
            const worker = new Worker(new URL("simulator/experiment-worker.js", source).href, { type: "module" });
            workers.push(worker);
            jobs.push(
                new Promise((resolve, reject) => {
                    worker.onerror = (event) => {
                        event.preventDefault();
                        reject(new Error(event.message));
                    };
                    worker.onmessageerror = () => reject(new Error("Worker message deserialization failed"));
                    worker.onmessage = (event) => {
                        const message =
                            /** @type {{type: string, units?: UnitResult[], message?: string}} */ (event.data);
                        try {
                            if (message.type === "error") throw new Error(message.message);
                            if (message.type === "done") {
                                resolve();
                                return;
                            }
                            if (message.type !== "batch" || !message.units) throw new Error("Invalid worker response");
                            for (const unit of message.units) {
                                units.push(unit);
                                const bytes = encoder.encode(`${JSON.stringify(unit)}\n`);
                                let written = 0;
                                while (written < bytes.length) written += output.writeSync(bytes.subarray(written));
                            }
                            completed += message.units.length;
                            const now = performance.now();
                            if (now - lastProgress >= 10000 || completed === config.samples) {
                                console.log(
                                    `${completed}/${config.samples} samples (${
                                        ((now - startTime) / 1000).toFixed(0)
                                    }s)`,
                                );
                                lastProgress = now;
                            }
                        } catch (error) {
                            reject(error);
                        }
                    };
                    worker.postMessage({
                        config,
                        start,
                        count: end - start,
                        candidateUrl: new URL("ai.js", source).href,
                        baselineUrl: new URL("baseline.js", source).href,
                    });
                }),
            );
        }
        await Promise.all(jobs);
        units.sort((a, b) => a.seed - b.seed);
        if (units.length !== config.samples || units.some((unit, i) => unit.seed !== config.seed + i)) {
            throw new Error("Missing or duplicated sample seeds");
        }
        const summary = summarizeExperiment(config, units);
        const report = { ...manifest, durationMs: performance.now() - startTime, summary };
        await Deno.writeTextFile(new URL("report.json", directory), JSON.stringify(report, null, 2));
        console.log(JSON.stringify(summary, null, 2));
        console.log(`Report: ${new URL("report.json", directory).pathname}`);
    } catch (error) {
        await Deno.writeTextFile(
            new URL("failure.json", directory),
            JSON.stringify({ completed, error: String(error) }),
        );
        throw error;
    } finally {
        for (const worker of workers) worker.terminate();
        output.close();
    }
}

if (import.meta.main) {
    try {
        if (Deno.args.includes("--help")) {
            console.log("deno run -A src/simulator/experiment-cli.js --mode compare|balance --samples N --seed N");
            console.log("Options: --workers N --layout ID --candidate FILE --baseline-ref REF --baseline-file FILE");
            console.log("Candidate-only tuning: --potential-scale 1 --future-weight 0.8 (live defaults)");
            console.log(
                "2P draw override: --blind-first true|false (omitted: module default; current Hard enables it)",
            );
            console.log(
                "Baseline-only tuning: --baseline-potential-scale N --baseline-future-weight N --baseline-blind-first true|false",
            );
            console.log(
                "Rules for both policies: --opening random|fixed --turn-order fixed|rotating --tiebreak live|noisy-later|diversity-later",
            );
            console.log("Balance targets: --win-tolerance 0.01 --score-tolerance 0.5");
        } else {
            await run(parseExperimentArgs(Deno.args));
        }
    } catch (error) {
        console.error(error);
        Deno.exitCode = 1;
    }
}

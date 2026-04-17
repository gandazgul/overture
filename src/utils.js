const two32 = 4294967296;

/**
 * @typedef {object} RNG
 * @property {function(): number} random - A function that returns a random number between 0 and 1
 * @property {function(): number} uint32 - A function that returns a random 32bit integer
 */

function r() {
    const buf = new Uint32Array(1);

    crypto.getRandomValues(buf);

    return buf[0] / two32;
}

/**
 * Returns a seeded RNG. the Crypto implementation is seeded by default with a
 * cryptographically strong seed.
 *
 * @return {RNG}
 */
function getSeededRNG() {
    return {
        random: r,
        uint32: () => r() * two32,
    };
}

/**
 * Like Math.random() but consistent across platforms, and it uses crypto when available
 *
 * @return {number} A random number between 0 and 1
 */
function random() {
    return getSeededRNG().random();
}

/**
 * Returns a pseudo random integer between min (inclusive) and max (inclusive).
 *
 * If no arguments are passed, it will return a number between 0 and Number.MAX_VALUE
 * If only one argument is passed, it will return a number between 0 and the argument
 * If two arguments are passed, it will return a number between the two arguments (inclusive of both)
 *
 * Use this instead of Math.round() because that will give you a non-uniform distribution!
 *
 * @param {...number} args min, max or just max or nothing
 *
 * @return {number}
 */
function randomInt(...args) {
    const randomInt32 = getSeededRNG().uint32();

    if (args.length === 0) {
        return randomInt32 % (Number.MAX_VALUE + 1);
    }

    if (args.length === 1) {
        const max = Math.floor(args[0]);

        return randomInt32 % (max + 1);
    }

    const min = Math.ceil(args[0]);
    const max = Math.floor(args[1]);

    return min + (randomInt32 % (max - min + 1));
}

/**
 * @param {string} path
 */
function getParentDir(path) {
    const normalized = path.replaceAll("\\", "/");
    const lastSlash = normalized.lastIndexOf("/");

    if (lastSlash <= 0) {
        return ".";
    }

    return normalized.slice(0, lastSlash);
}

/**
 * @param {string} path
 */
async function ensureParentDir(path) {
    await Deno.mkdir(getParentDir(path), { recursive: true });
}

/**
 * @param {Request} req
 */
function getClientIp(req) {
    const forwarded = req.headers.get("x-forwarded-for");
    if (forwarded) {
        const first = forwarded.split(",")[0]?.trim();
        if (first) {
            return first;
        }
    }

    const realIp = req.headers.get("x-real-ip");
    if (realIp) {
        return realIp;
    }

    const cfIp = req.headers.get("cf-connecting-ip");
    if (cfIp) {
        return cfIp;
    }

    return "unknown";
}

export { ensureParentDir, getClientIp, random, randomInt };

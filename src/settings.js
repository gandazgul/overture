// @ts-check

/**
 * ========================================================================
 * SETTINGS — Phaser Registry + localStorage persistence
 * ========================================================================
 * Uses Phaser's built-in Game Registry (scene.registry) as the global
 * in-memory store, with localStorage as the persistence layer.
 *
 * Settings are hydrated from localStorage into the registry on startup,
 * and a changedata event listener auto-persists on mutation.
 * ========================================================================
 */

const STORAGE_KEY = "theater-ushers-settings";

/**
 * All setting keys managed by this module.
 * @type {string[]}
 */
const SETTING_KEYS = ["showAllScores"];

/**
 * Default values for all settings.
 * @type {Record<string, any>}
 */
const DEFAULTS = {
    showAllScores: true,
};

/**
 * Load settings from localStorage and hydrate the Phaser registry.
 * Should be called once during game startup (e.g. in TitleScene.create()).
 *
 * Also wires up a changedata listener so any future registry.set() calls
 * for setting keys are automatically persisted to localStorage.
 *
 * @param {Phaser.Data.DataManager} registry - scene.registry or game.registry
 */
export function loadSettings(registry) {
    /** @type {Record<string, any>} */
    let stored = {};

    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            stored = JSON.parse(raw);
        }
    } catch {
        // Corrupted or unavailable — use defaults
    }

    // Merge stored values with defaults, then push into the registry
    for (const key of SETTING_KEYS) {
        const value = key in stored ? stored[key] : DEFAULTS[key];
        registry.set(key, value);
    }

    // Auto-persist on change — listen to each setting key individually
    for (const key of SETTING_KEYS) {
        registry.events.on(`changedata-${key}`, () => {
            saveSettings(registry);
        });
    }
}

/**
 * Persist current settings from the Phaser registry to localStorage.
 *
 * @param {Phaser.Data.DataManager} registry - scene.registry or game.registry
 */
export function saveSettings(registry) {
    /** @type {Record<string, any>} */
    const data = {};

    for (const key of SETTING_KEYS) {
        data[key] = registry.get(key);
    }

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
        // localStorage full or unavailable — silently fail
    }
}

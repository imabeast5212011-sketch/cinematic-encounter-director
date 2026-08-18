import { INTEGRATION_TARGETS, PROVIDERS, RESULT_STATUS } from "../constants.js";
import { createResult } from "../state/schema.js";
import { PublicApiActionAdapter } from "./public-api-action-adapter.js";

const METHOD_CANDIDATES = {
  "narrators-jukebox.playMusic": {
    playMusic: ["playMusic", "music.play", "playTrack", "tracks.play", "playPlaylist", "playMood", "broadcastMusic", "play"],
    default: ["playMusic", "music.play", "playTrack", "tracks.play", "play"]
  },
  "narrators-jukebox.stopMusic": {
    stopMusic: ["stopMusic", "music.stop", "stopTrack", "tracks.stop", "fadeOut", "stopAll", "stop"],
    default: ["stopMusic", "music.stop", "stopTrack", "tracks.stop", "stop"]
  },
  "narrators-jukebox.ambience": {
    startAmbience: ["startAmbience", "playAmbience", "ambience.play", "loadAmbiencePreset", "playAmbiencePreset", "playPreset", "play"],
    stopAmbience: ["stopAmbience", "ambience.stop", "stopAmbiencePreset", "stopPreset", "stop"],
    default: ["startAmbience", "playAmbience", "ambience.play", "loadAmbiencePreset", "playPreset"]
  },
  "narrators-jukebox.soundCue": {
    playSoundCue: ["playSoundCue", "soundboard.play", "soundBoard.play", "playSound", "playSfx", "playEffect", "playCue", "play"],
    default: ["playSoundCue", "soundboard.play", "playSound", "playCue"]
  }
};

export class NarratorsJukeboxAdapter extends PublicApiActionAdapter {
  constructor() {
    super(INTEGRATION_TARGETS.narratorsJukebox, METHOD_CANDIDATES);
  }

  getAdditionalPublicApiCandidates() {
    return [
      { source: "globalThis.NarratorJukeboxAPI", api: globalThis.NarratorJukeboxAPI },
      { source: "globalThis.NarratorsJukebox.api", api: globalThis.NarratorsJukebox?.api },
      { source: "globalThis.NarratorsJukebox", api: globalThis.NarratorsJukebox },
      { source: "globalThis.NarratorJukebox.api", api: globalThis.NarratorJukebox?.api },
      { source: "globalThis.NarratorJukebox", api: globalThis.NarratorJukebox },
      { source: "globalThis.narratorsJukebox.api", api: globalThis.narratorsJukebox?.api },
      { source: "globalThis.narratorsJukebox", api: globalThis.narratorsJukebox },
      { source: "globalThis.narratorJukebox.api", api: globalThis.narratorJukebox?.api },
      { source: "globalThis.narratorJukebox", api: globalThis.narratorJukebox },
      { source: "game.narratorsJukebox.api", api: globalThis.game?.narratorsJukebox?.api },
      { source: "game.narratorsJukebox", api: globalThis.game?.narratorsJukebox },
      { source: "game.narratorJukebox.api", api: globalThis.game?.narratorJukebox?.api },
      { source: "game.narratorJukebox", api: globalThis.game?.narratorJukebox }
    ];
  }

  hasFn(api, key) {
    return typeof api?.[key] === "function";
  }

  getNativeCapabilities(api, bridge) {
    const capabilities = super.getNativeCapabilities(api, bridge);
    const methods = [
      "playMusic",
      "playTrackByName",
      "playPlaylist",
      "playPlaylistByName",
      "playRandomByTag",
      "stop",
      "stopAll",
      "playSoundboardSound",
      "playSoundboardSoundByName",
      "stopAllSoundboardSounds",
      "playAmbienceLayer",
      "stopAmbienceLayer",
      "stopAllAmbienceLayers",
      "loadAmbiencePreset",
      "open"
    ];
    for (const method of methods) {
      if (this.hasFn(api, method)) capabilities.push(method);
    }
    return [...new Set(capabilities)];
  }

  statusFromDetection(module, api, bridge, capabilities) {
    if (!module.active) return "Inactive";
    if (!api) return "API not detected";
    if (capabilities.includes("playMusic") || capabilities.includes("playSoundboardSound") || capabilities.includes("playAmbienceLayer")) return "Ready";
    return super.statusFromDetection(module, api, bridge, capabilities);
  }

  getUnsupportedCapabilities(api, _bridge) {
    const unsupported = [];
    if (!api) return ["No Narrator's Jukebox public API object detected."];
    if (!this.hasFn(api, "playMusic")) unsupported.push("Narrator's Jukebox playMusic API was not detected.");
    if (!this.hasFn(api, "playSoundboardSound")) unsupported.push("Narrator's Jukebox soundboard API was not detected.");
    if (!this.hasFn(api, "playAmbienceLayer")) unsupported.push("Narrator's Jukebox ambience layer API was not detected.");
    return unsupported;
  }

  firstConfigValue(config = {}, keys = []) {
    for (const key of keys) {
      const value = config[key];
      if (value !== undefined && value !== null && value !== "") return value;
    }
    return "";
  }

  callSpec(action, _context = {}, api = null) {
    const config = action.config ?? {};
    const operation = String(config.operation || "").trim();
    const normalized = operation || String(action.type ?? "").split(".").at(-1) || "playMusic";
    const channel = config.channel || (action.type === "narrators-jukebox.ambience" ? "ambience" : "music");
    const id = this.firstConfigValue(config, ["trackId", "musicId", "externalId", "id"]);
    const name = this.firstConfigValue(config, ["trackName", "musicName", "name"]);
    const playlistId = this.firstConfigValue(config, ["playlistId"]);
    const playlistName = this.firstConfigValue(config, ["playlistName"]);
    const tag = this.firstConfigValue(config, ["tag", "mood", "moodTag"]);
    const soundId = this.firstConfigValue(config, ["soundId", "soundboardSoundId", "externalId", "id"]);
    const soundName = this.firstConfigValue(config, ["soundName", "soundboardSoundName", "name"]);
    const presetId = this.firstConfigValue(config, ["presetId", "ambiencePresetId"]);
    const ambienceTrackId = this.firstConfigValue(config, ["ambienceTrackId", "trackId", "externalId", "id"]);
    const result = (key, args, nameForDisplay = key, missing = "") => ({ owner: api, key, fn: api?.[key], args, name: nameForDisplay, missing });

    if (normalized === "open" || normalized === "toggle") return result(normalized, [], normalized);

    if (action.type === "narrators-jukebox.stopMusic" || ["stopMusic", "stop", "stopAmbience"].includes(normalized)) {
      if (config.stopAll || normalized === "stopAll") return result("stopAll", [], "stopAll");
      return result("stop", [config.channel || (normalized === "stopAmbience" ? "ambience" : "music")], "stop");
    }

    if (action.type === "narrators-jukebox.soundCue" || ["playSoundCue", "soundCue", "soundboard"].includes(normalized)) {
      const options = config.options && typeof config.options === "object" ? config.options : {};
      if (soundName) return result("playSoundboardSoundByName", [soundName, options], "playSoundboardSoundByName");
      return result("playSoundboardSound", [soundId, options], "playSoundboardSound", soundId ? "" : "Narrator's Jukebox soundboard action needs config.soundId, config.soundName, or config.externalId.");
    }

    if (action.type === "narrators-jukebox.ambience" || ["startAmbience", "playAmbience", "loadAmbiencePreset", "stopAmbienceLayer", "stopAllAmbienceLayers"].includes(normalized)) {
      if (["stopAllAmbienceLayers", "stopAmbienceLayers"].includes(normalized) || config.stopAll) return result("stopAllAmbienceLayers", [], "stopAllAmbienceLayers");
      if (normalized === "stopAmbienceLayer") return result("stopAmbienceLayer", [ambienceTrackId], "stopAmbienceLayer", ambienceTrackId ? "" : "Narrator's Jukebox ambience stop needs config.ambienceTrackId or config.externalId.");
      if (presetId || normalized === "loadAmbiencePreset") return result("loadAmbiencePreset", [presetId || id], "loadAmbiencePreset", (presetId || id) ? "" : "Narrator's Jukebox ambience preset needs config.presetId or config.externalId.");
      if (config.mode === "channel") {
        if (name) return result("playTrackByName", [name, "ambience"], "playTrackByName");
        return result("playMusic", [ambienceTrackId, "ambience"], "playMusic", ambienceTrackId ? "" : "Narrator's Jukebox ambience channel needs config.trackId or config.externalId.");
      }
      return result("playAmbienceLayer", [ambienceTrackId, { volume: config.volume }], "playAmbienceLayer", ambienceTrackId ? "" : "Narrator's Jukebox ambience layer needs config.ambienceTrackId, config.trackId, or config.externalId.");
    }

    if (playlistId) return result("playPlaylist", [playlistId, Boolean(config.shuffleStart)], "playPlaylist");
    if (playlistName) return result("playPlaylistByName", [playlistName, Boolean(config.shuffleStart)], "playPlaylistByName");
    if (tag) return result("playRandomByTag", [tag, config.library || "music"], "playRandomByTag");
    if (name) return result("playTrackByName", [name, channel], "playTrackByName");
    return result("playMusic", [id, channel], "playMusic", id ? "" : "Narrator's Jukebox music action needs config.trackId, config.trackName, config.playlistId, config.playlistName, config.tag, or config.externalId.");
  }

  resultFromApi(call, apiResult, status) {
    return createResult(RESULT_STATUS.SUCCESS, `Called Narrator's Jukebox ${call.name}.`, { status, apiMethod: call.name, result: apiResult });
  }

  async validate(action, context = {}) {
    const status = await this.getStatus();
    if (status.status === "Disabled by setting") return createResult(RESULT_STATUS.UNSUPPORTED, "Narrator's Jukebox integration is disabled by setting.", { status });
    if (!status.installed) return createResult(RESULT_STATUS.UNSUPPORTED, "Narrator's Jukebox is not installed or could not be detected.", { status });
    if (!status.active) return createResult(RESULT_STATUS.UNSUPPORTED, "Narrator's Jukebox is installed but inactive.", { status });

    const api = this.getPublicApi(this.detectModule());
    if (!api) return createResult(RESULT_STATUS.UNSUPPORTED, "Narrator's Jukebox public API is unavailable.", { status });
    if (action.config?.method) return super.validate(action, context);

    const call = this.callSpec(action, context, api);
    if (call.missing) return createResult(RESULT_STATUS.WARNING, call.missing, { status, apiMethod: call.name });
    if (typeof call.fn !== "function") return createResult(RESULT_STATUS.UNSUPPORTED, `Narrator's Jukebox ${call.name} API is unavailable.`, { status, apiMethod: call.name });
    return createResult(RESULT_STATUS.SUCCESS, `Narrator's Jukebox ${call.name} API is available.`, { status, apiMethod: call.name });
  }

  async execute(action, context = {}) {
    const status = await this.getStatus();
    const api = this.getPublicApi(this.detectModule());
    if (!status.installed || !status.active) return createResult(RESULT_STATUS.UNSUPPORTED, `Narrator's Jukebox action is unavailable: ${status.status}.`, { status });
    if (!api) return createResult(RESULT_STATUS.UNSUPPORTED, "Narrator's Jukebox public API is unavailable.", { status });
    if (action.config?.method) return super.execute(action, context);

    const call = this.callSpec(action, context, api);
    if (call.missing) return createResult(RESULT_STATUS.WARNING, call.missing, { status, apiMethod: call.name });
    if (typeof call.fn !== "function") return createResult(RESULT_STATUS.UNSUPPORTED, `Narrator's Jukebox ${call.name} API is unavailable.`, { status, apiMethod: call.name });
    if (context?.dryRun) return createResult(RESULT_STATUS.DRY_RUN, `Dry run: would call Narrator's Jukebox ${call.name}.`, { status, apiMethod: call.name });

    try {
      const apiResult = await call.fn.apply(call.owner, call.args);
      return this.resultFromApi(call, apiResult, status);
    } catch (error) {
      this.lastError = error?.message ?? String(error);
      return createResult(RESULT_STATUS.FAILURE, `Narrator's Jukebox ${call.name} failed: ${this.lastError}`, { status, apiMethod: call.name });
    }
  }

  minimizeExecutionContext(context) {
    return {
      ...super.minimizeExecutionContext(context),
      providerHint: PROVIDERS.NARRATORS_JUKEBOX
    };
  }
}

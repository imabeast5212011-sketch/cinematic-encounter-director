import { INTEGRATION_TARGETS, PROVIDERS, RESULT_STATUS } from "../constants.js";
import { createResult } from "../state/schema.js";
import { PublicApiActionAdapter } from "./public-api-action-adapter.js";

const METHOD_CANDIDATES = {
  "exalted-scenes.broadcast": {
    broadcast: ["broadcastScene", "broadcast", "broadcastContent", "playScene", "startScene", "presentScene", "present", "start", "play"],
    open: ["openGMPanel", "openPanel", "open", "openScene", "show"],
    openGMPanel: ["openGMPanel"],
    default: ["broadcastScene", "broadcast", "broadcastContent", "playScene", "presentScene", "present", "openGMPanel"]
  },
  "exalted-scenes.stop": {
    stop: ["stopBroadcast", "stopPresentation", "stopScene", "stop", "clearBroadcast", "clearPresentation", "clear", "end", "close"],
    default: ["stopBroadcast", "stopPresentation", "stopScene", "stop", "clear"]
  }
};

export class ExaltedScenesAdapter extends PublicApiActionAdapter {
  constructor() {
    super(INTEGRATION_TARGETS.exaltedScenes, METHOD_CANDIDATES);
  }

  getAdditionalPublicApiCandidates() {
    return [
      { source: "globalThis.ExaltedScenes.api", api: globalThis.ExaltedScenes?.api },
      { source: "globalThis.ExaltedScenes", api: globalThis.ExaltedScenes },
      { source: "globalThis.exaltedScenes.api", api: globalThis.exaltedScenes?.api },
      { source: "globalThis.exaltedScenes", api: globalThis.exaltedScenes },
      { source: "game.exaltedScenes.api", api: globalThis.game?.exaltedScenes?.api },
      { source: "game.exaltedScenes", api: globalThis.game?.exaltedScenes },
      { source: "game.exalted?.scenes?.api", api: globalThis.game?.exalted?.scenes?.api },
      { source: "game.exalted?.scenes", api: globalThis.game?.exalted?.scenes }
    ];
  }

  hasFn(api, path) {
    const owner = path.slice(0, -1).reduce((value, key) => value?.[key], api);
    return typeof owner?.[path.at(-1)] === "function";
  }

  getNativeCapabilities(api, bridge) {
    const capabilities = super.getNativeCapabilities(api, bridge);
    const checks = [
      ["broadcast.scene", ["broadcast", "scene"]],
      ["broadcast.stop", ["broadcast", "stop"]],
      ["slideshows.play", ["slideshows", "play"]],
      ["slideshows.stop", ["slideshows", "stop"]],
      ["sequences.start", ["sequences", "start"]],
      ["sequences.stop", ["sequences", "stop"]],
      ["castOnly.start", ["castOnly", "start"]],
      ["castOnly.stop", ["castOnly", "stop"]],
      ["audio.playSceneAudio", ["audio", "playSceneAudio"]],
      ["audio.stopAll", ["audio", "stopAll"]],
      ["audio.playSoundboardSound", ["audio", "playSoundboardSound"]]
    ];
    for (const [capability, path] of checks) {
      if (this.hasFn(api, path)) capabilities.push(capability);
    }
    return [...new Set(capabilities)];
  }

  statusFromDetection(module, api, bridge, capabilities) {
    if (!module.active) return "Inactive";
    if (!api) return "API not detected";
    if (capabilities.some((capability) => capability.startsWith("broadcast.") || capability.startsWith("slideshows.") || capability.startsWith("sequences."))) return "Ready";
    return super.statusFromDetection(module, api, bridge, capabilities);
  }

  getUnsupportedCapabilities(api, _bridge) {
    const unsupported = [];
    if (!api) return ["No Exalted Scenes public API object detected."];
    if (!this.hasFn(api, ["broadcast", "scene"])) unsupported.push("Exalted Scenes broadcast.scene API was not detected.");
    if (!this.hasFn(api, ["broadcast", "stop"])) unsupported.push("Exalted Scenes broadcast.stop API was not detected.");
    if (!this.hasFn(api, ["slideshows", "play"])) unsupported.push("Exalted Scenes slideshow playback API was not detected.");
    if (!this.hasFn(api, ["sequences", "start"])) unsupported.push("Exalted Scenes sequence playback API was not detected.");
    return unsupported;
  }

  firstConfigValue(config = {}, keys = []) {
    for (const key of keys) {
      const value = config[key];
      if (value !== undefined && value !== null && value !== "") return value;
    }
    return "";
  }

  callSpec(action, context = {}, api = null) {
    const config = action.config ?? {};
    const operation = String(config.operation || "").trim();
    const normalized = operation || (action.type === "exalted-scenes.stop" ? "stop" : "broadcast");
    const sceneId = this.firstConfigValue(config, ["sceneId", "exaltedSceneId", "externalId", "id"]);
    const slideshowId = this.firstConfigValue(config, ["slideshowId", "externalId", "id"]);
    const soundId = this.firstConfigValue(config, ["soundId", "soundboardSoundId", "externalId", "id"]);
    const options = config.options && typeof config.options === "object" ? config.options : {};
    const result = (owner, key, args, name, missing = "") => ({ owner, key, fn: owner?.[key], args, name, missing });

    if (action.type === "exalted-scenes.stop") {
      if (["stopSlideshow", "slideshow", "slideshows.stop"].includes(normalized)) return result(api?.slideshows, "stop", [], "slideshows.stop");
      if (["stopSequence", "sequence", "sequences.stop"].includes(normalized)) return result(api?.sequences, "stop", [], "sequences.stop");
      if (["stopCastOnly", "castOnly", "castOnly.stop"].includes(normalized)) return result(api?.castOnly, "stop", [], "castOnly.stop");
      if (["stopAudio", "audio", "audio.stopAll"].includes(normalized)) return result(api?.audio, "stopAll", [sceneId || undefined], "audio.stopAll");
      return result(api?.broadcast, "stop", [], "broadcast.stop");
    }

    if (["playSlideshow", "slideshow", "slideshows.play"].includes(normalized)) {
      return result(api?.slideshows, "play", [slideshowId], "slideshows.play", slideshowId ? "" : "Exalted slideshow playback needs config.slideshowId or config.externalId.");
    }
    if (["startSequence", "sequence", "sequences.start"].includes(normalized)) {
      return result(api?.sequences, "start", [sceneId, options], "sequences.start", sceneId ? "" : "Exalted sequence playback needs config.sceneId or config.externalId.");
    }
    if (["nextSequence", "sequences.next"].includes(normalized)) return result(api?.sequences, "next", [], "sequences.next");
    if (["previousSequence", "sequences.previous"].includes(normalized)) return result(api?.sequences, "previous", [], "sequences.previous");
    if (["goToSequence", "sequences.goTo"].includes(normalized)) return result(api?.sequences, "goTo", [Number(config.index ?? 0)], "sequences.goTo");
    if (["castOnly", "startCastOnly", "castOnly.start"].includes(normalized)) {
      const characterIds = Array.isArray(config.characterIds) ? config.characterIds : [];
      return result(api?.castOnly, "start", [characterIds, config.layoutSettings ?? config.layout ?? {}], "castOnly.start", characterIds.length ? "" : "Exalted cast-only mode needs config.characterIds.");
    }
    if (["playSceneAudio", "audio.playSceneAudio"].includes(normalized)) {
      return result(api?.audio, "playSceneAudio", [sceneId], "audio.playSceneAudio", sceneId ? "" : "Exalted scene audio needs config.sceneId or config.externalId.");
    }
    if (["restoreSceneAudio", "audio.restoreSceneAudio"].includes(normalized)) {
      return result(api?.audio, "restoreSceneAudio", [sceneId, options], "audio.restoreSceneAudio", sceneId ? "" : "Exalted scene audio restore needs config.sceneId or config.externalId.");
    }
    if (["playSoundboardSound", "soundboard", "audio.playSoundboardSound"].includes(normalized)) {
      return result(api?.audio, "playSoundboardSound", [soundId], "audio.playSoundboardSound", soundId ? "" : "Exalted soundboard playback needs config.soundId or config.externalId.");
    }
    if (["setVolume", "audio.setVolume"].includes(normalized)) {
      return result(api?.audio, "setVolume", [Number(config.volume ?? 1)], "audio.setVolume");
    }

    return result(api?.broadcast, "scene", [sceneId], "broadcast.scene", sceneId ? "" : "Exalted scene broadcast needs config.sceneId or config.externalId.");
  }

  resultFromApi(call, apiResult, status) {
    if (apiResult?.success === false) {
      return createResult(RESULT_STATUS.FAILURE, `Exalted Scenes ${call.name} failed: ${apiResult.error || "No error details returned."}`, { status, apiMethod: call.name, result: apiResult });
    }
    return createResult(RESULT_STATUS.SUCCESS, `Called Exalted Scenes ${call.name}.`, { status, apiMethod: call.name, result: apiResult });
  }

  async validate(action, context = {}) {
    const status = await this.getStatus();
    if (status.status === "Disabled by setting") return createResult(RESULT_STATUS.UNSUPPORTED, "Exalted Scenes integration is disabled by setting.", { status });
    if (!status.installed) return createResult(RESULT_STATUS.UNSUPPORTED, "Exalted Scenes is not installed or could not be detected.", { status });
    if (!status.active) return createResult(RESULT_STATUS.UNSUPPORTED, "Exalted Scenes is installed but inactive.", { status });

    const api = this.getPublicApi(this.detectModule());
    if (!api) return createResult(RESULT_STATUS.UNSUPPORTED, "Exalted Scenes public API is unavailable.", { status });
    if (action.config?.method) return super.validate(action, context);

    const call = this.callSpec(action, context, api);
    if (call.missing) return createResult(RESULT_STATUS.WARNING, call.missing, { status, apiMethod: call.name });
    if (typeof call.fn !== "function") return createResult(RESULT_STATUS.UNSUPPORTED, `Exalted Scenes ${call.name} API is unavailable.`, { status, apiMethod: call.name });
    return createResult(RESULT_STATUS.SUCCESS, `Exalted Scenes ${call.name} API is available.`, { status, apiMethod: call.name });
  }

  async execute(action, context = {}) {
    const status = await this.getStatus();
    const api = this.getPublicApi(this.detectModule());
    if (!status.installed || !status.active) return createResult(RESULT_STATUS.UNSUPPORTED, `Exalted Scenes action is unavailable: ${status.status}.`, { status });
    if (!api) return createResult(RESULT_STATUS.UNSUPPORTED, "Exalted Scenes public API is unavailable.", { status });
    if (action.config?.method) return super.execute(action, context);

    const call = this.callSpec(action, context, api);
    if (call.missing) return createResult(RESULT_STATUS.WARNING, call.missing, { status, apiMethod: call.name });
    if (typeof call.fn !== "function") return createResult(RESULT_STATUS.UNSUPPORTED, `Exalted Scenes ${call.name} API is unavailable.`, { status, apiMethod: call.name });
    if (context?.dryRun) return createResult(RESULT_STATUS.DRY_RUN, `Dry run: would call Exalted Scenes ${call.name}.`, { status, apiMethod: call.name });

    try {
      const apiResult = await call.fn.apply(call.owner, call.args);
      return this.resultFromApi(call, apiResult, status);
    } catch (error) {
      this.lastError = error?.message ?? String(error);
      return createResult(RESULT_STATUS.FAILURE, `Exalted Scenes ${call.name} failed: ${this.lastError}`, { status, apiMethod: call.name });
    }
  }

  minimizeExecutionContext(context) {
    return {
      ...super.minimizeExecutionContext(context),
      providerHint: PROVIDERS.EXALTED_SCENES
    };
  }
}

import { INTEGRATION_TARGETS, PROVIDERS, RESULT_STATUS } from "../constants.js";
import { createResult } from "../state/schema.js";
import { BaseAdapter } from "./base-adapter.js";

function getFxMasterApi() {
  return globalThis.FXMASTER?.api ?? null;
}

function hasFn(object, key) {
  return typeof object?.[key] === "function";
}

function getSceneReference(config = {}, context = {}) {
  return config.scene ?? config.sceneUuid ?? context?.sequence?.sceneUuid ?? context?.sceneUuid ?? null;
}

function getPresetName(config = {}) {
  return config.preset ?? config.presetName ?? config.externalId ?? config.name ?? "";
}

function getPresetOptions(config = {}, context = {}) {
  const options = { ...(config.options ?? {}) };
  const allowed = [
    "topDown",
    "direction",
    "color",
    "speed",
    "density",
    "belowTokens",
    "belowTiles",
    "belowForeground",
    "darknessActivationEnabled",
    "darknessActivationMin",
    "darknessActivationMax",
    "soundFx",
    "levels",
    "splash",
    "silent"
  ];

  for (const key of allowed) {
    if (config[key] !== undefined && options[key] === undefined) options[key] = config[key];
  }

  const scene = getSceneReference(config, context);
  if (scene && options.scene === undefined) options.scene = scene;
  return options;
}

function getEffectsPayload(config = {}, context = {}) {
  const payload = { ...(config.payload ?? {}) };
  if (Array.isArray(config.effects) && payload.effects === undefined) payload.effects = config.effects;
  if (Array.isArray(config.particles) && payload.particles === undefined) payload.particles = config.particles;
  if (Array.isArray(config.filters) && payload.filters === undefined) payload.filters = config.filters;
  if (config.skipFading !== undefined && payload.skipFading === undefined) payload.skipFading = Boolean(config.skipFading);

  const scene = getSceneReference(config, context);
  if (scene && payload.scene === undefined) payload.scene = scene;

  const toggleKey = config.toggleKey ?? config.key ?? config.effectKey;
  if (toggleKey && payload.toggleKey === undefined) payload.toggleKey = toggleKey;
  return payload;
}

function hasEffectsPayload(payload = {}) {
  return [payload.effects, payload.particles, payload.filters].some((entries) => Array.isArray(entries) && entries.length > 0);
}

export class FXMasterAdapter extends BaseAdapter {
  constructor() {
    super(INTEGRATION_TARGETS.fxmaster);
  }

  getPublicApi(module) {
    const globalApi = getFxMasterApi();
    if (globalApi && typeof globalApi === "object") return globalApi;
    return super.getPublicApi(module);
  }

  getNativeCapabilities(api, bridge) {
    const capabilities = super.getNativeCapabilities(api, bridge);
    if (hasFn(api?.presets, "play")) capabilities.push("presetPlay");
    if (hasFn(api?.presets, "stop")) capabilities.push("presetStop");
    if (hasFn(api?.presets, "toggle")) capabilities.push("presetToggle");
    if (hasFn(api?.presets, "switch")) capabilities.push("presetSwitch");
    if (hasFn(api?.presets, "list")) capabilities.push("presetList");
    if (hasFn(api?.presets, "listValid")) capabilities.push("presetListValid");
    if (hasFn(api?.presets, "listActive")) capabilities.push("presetListActive");
    if (hasFn(api?.effects, "play")) capabilities.push("effectPlay");
    if (hasFn(api?.effects, "stop")) capabilities.push("effectStop");
    if (hasFn(api?.effects, "toggle")) capabilities.push("effectToggle");
    if (hasFn(api, "stopSceneEffects")) capabilities.push("stopSceneEffects");
    if (hasFn(api, "stopRegionEffects")) capabilities.push("stopRegionEffects");
    if (hasFn(api, "startRegionEffects")) capabilities.push("startRegionEffects");
    return capabilities;
  }

  statusFromDetection(module, api, bridge, capabilities) {
    if (!module.active) return "Inactive";
    if (!api) return "API not detected";
    if (capabilities.some((capability) => capability.startsWith("preset") || capability.startsWith("effect") || capability === "stopSceneEffects")) return "Ready";
    return super.statusFromDetection(module, api, bridge, capabilities);
  }

  getUnsupportedCapabilities(api, bridge) {
    const unsupported = [];
    if (!api) return ["No FXMASTER.api object detected."];
    if (!api.presets) unsupported.push("FXMaster presets API was not detected.");
    if (!api.effects) unsupported.push("FXMaster effects API was not detected.");
    if (!hasFn(api, "stopSceneEffects")) unsupported.push("FXMaster scene effect stop API was not detected.");
    if (!bridge) unsupported.push("No Encounter Director bridge was detected; using confirmed FXMASTER global API.");
    return unsupported;
  }

  async validate(action, context = {}) {
    const status = await this.getStatus();
    if (status.status === "Disabled by setting") return createResult(RESULT_STATUS.UNSUPPORTED, "FXMaster integration is disabled by setting.", { status });
    if (!status.installed) return createResult(RESULT_STATUS.UNSUPPORTED, "FXMaster is not installed or could not be detected.", { status });
    if (!status.active) return createResult(RESULT_STATUS.UNSUPPORTED, "FXMaster is installed but inactive.", { status });
    if (status.status !== "Ready") return createResult(RESULT_STATUS.UNSUPPORTED, `FXMaster API is unavailable: ${status.status}.`, { status });

    const config = action.config ?? {};
    if (action.type === "fxmaster.preset") {
      const operation = config.operation ?? "playPreset";
      const presetName = getPresetName(config);
      if (!presetName && operation !== "switchPreset" && operation !== "clearDirectorEffects") {
        return createResult(RESULT_STATUS.WARNING, "FXMaster preset action needs config.preset, config.presetName, or config.externalId.", { status });
      }
      return createResult(RESULT_STATUS.SUCCESS, "FXMaster preset API is available.", { status });
    }

    if (action.type === "fxmaster.effect") {
      const payload = getEffectsPayload(config, context);
      if (!hasEffectsPayload(payload)) {
        return createResult(RESULT_STATUS.WARNING, "FXMaster effect action needs effects, particles, filters, or a payload copied from FXMaster.", { status });
      }
      return createResult(RESULT_STATUS.SUCCESS, "FXMaster effects API is available.", { status });
    }

    if (action.type === "fxmaster.clearDirectorEffects") {
      return createResult(RESULT_STATUS.SUCCESS, "FXMaster Director-owned effect cleanup API is available where handles or API presets are present.", { status });
    }

    if (action.type === "fxmaster.clearAll") {
      if (!status.capabilities.includes("stopSceneEffects")) return createResult(RESULT_STATUS.UNSUPPORTED, "FXMaster stopSceneEffects API is unavailable.", { status });
      return createResult(RESULT_STATUS.SUCCESS, "FXMaster scene effect stop API is available.", { status });
    }

    return super.validate(action, context);
  }

  async executePreset(action, context, api, status) {
    const config = action.config ?? {};
    const operation = config.operation ?? "playPreset";
    const presetName = getPresetName(config);
    const options = getPresetOptions(config, context);

    if ((operation === "stopPreset" || operation === "stop") && hasFn(api?.presets, "stop")) {
      if (!presetName) return createResult(RESULT_STATUS.WARNING, "FXMaster stop preset needs a preset name.", { status });
      const result = await api.presets.stop(presetName, options);
      return createResult(RESULT_STATUS.SUCCESS, `Stopped FXMaster preset ${presetName}.`, { status, result });
    }

    if ((operation === "togglePreset" || operation === "toggle") && hasFn(api?.presets, "toggle")) {
      if (!presetName) return createResult(RESULT_STATUS.WARNING, "FXMaster toggle preset needs a preset name.", { status });
      const result = await api.presets.toggle(presetName, options);
      return createResult(RESULT_STATUS.SUCCESS, `Toggled FXMaster preset ${presetName}.`, { status, result });
    }

    if ((operation === "switchPreset" || operation === "switch" || operation === "clearDirectorEffects") && hasFn(api?.presets, "switch")) {
      const result = await api.presets.switch(presetName || undefined, options);
      const message = presetName ? `Switched FXMaster preset to ${presetName}.` : "Stopped active FXMaster API presets.";
      return createResult(RESULT_STATUS.SUCCESS, message, { status, result });
    }

    if (hasFn(api?.presets, "play")) {
      if (!presetName) return createResult(RESULT_STATUS.WARNING, "FXMaster play preset needs a preset name.", { status });
      const result = await api.presets.play(presetName, options);
      return createResult(RESULT_STATUS.SUCCESS, `Played FXMaster preset ${presetName}.`, { status, result });
    }

    return createResult(RESULT_STATUS.UNSUPPORTED, "FXMaster preset operation is unavailable.", { status });
  }

  async executeEffect(action, context, api, status) {
    const config = action.config ?? {};
    const operation = config.operation ?? "startEffect";
    const payload = getEffectsPayload(config, context);
    if (!hasEffectsPayload(payload)) {
      return createResult(RESULT_STATUS.WARNING, "FXMaster effect action did not include effects, particles, filters, or a payload.", { status });
    }

    if ((operation === "stopEffect" || operation === "stop") && hasFn(api?.effects, "stop")) {
      const result = await api.effects.stop(payload);
      return createResult(RESULT_STATUS.SUCCESS, "Stopped FXMaster API effects.", { status, result });
    }

    if ((operation === "toggleEffect" || operation === "toggle") && hasFn(api?.effects, "toggle")) {
      const result = await api.effects.toggle(payload);
      return createResult(RESULT_STATUS.SUCCESS, "Toggled FXMaster API effects.", { status, result });
    }

    if (hasFn(api?.effects, "play")) {
      const result = await api.effects.play(payload);
      return createResult(RESULT_STATUS.SUCCESS, "Played FXMaster API effects.", { status, result });
    }

    return createResult(RESULT_STATUS.UNSUPPORTED, "FXMaster effects operation is unavailable.", { status });
  }

  async execute(action, context = {}) {
    if (action.type === "fxmaster.clearAll" && !action.confirmedDangerous) {
      return createResult(RESULT_STATUS.FAILURE, "Dangerous FXMaster clear-all requires explicit GM confirmation.");
    }

    const status = await this.getStatus();
    const api = this.getPublicApi(this.detectModule());
    if (status.status !== "Ready") return createResult(RESULT_STATUS.UNSUPPORTED, `FXMaster action is unavailable: ${status.status}.`, { status });
    if (context?.dryRun) return createResult(RESULT_STATUS.DRY_RUN, `Dry run: would run FXMaster action ${action.name}.`, { status });

    if (action.type === "fxmaster.preset") return this.executePreset(action, context, api, status);
    if (action.type === "fxmaster.effect") return this.executeEffect(action, context, api, status);

    if (action.type === "fxmaster.clearDirectorEffects") {
      const config = action.config ?? {};
      const payload = getEffectsPayload(config, context);
      const details = {};
      let didWork = false;
      if (hasFn(api?.presets, "switch")) {
        details.presets = await api.presets.switch(undefined, getPresetOptions(config, context));
        didWork = true;
      }
      if (hasEffectsPayload(payload) && hasFn(api?.effects, "stop")) {
        details.effects = await api.effects.stop(payload);
        didWork = true;
      }
      if (!didWork) return createResult(RESULT_STATUS.WARNING, "No FXMaster Director-owned preset or effect handles were available to clear.", { status });
      return createResult(RESULT_STATUS.SUCCESS, "Cleared FXMaster Director-owned API effects where handles were available.", { status, ...details });
    }

    if (action.type === "fxmaster.clearAll") {
      const config = action.config ?? {};
      const scene = getSceneReference(config, context) ?? canvas?.scene ?? null;
      const options = { scene, skipFading: config.skipFading !== false };
      const details = {};
      if (hasFn(api, "stopSceneEffects")) details.sceneEffects = await api.stopSceneEffects(options);
      if (config.includeRegionEffects && hasFn(api, "stopRegionEffects")) details.regionEffects = await api.stopRegionEffects(options);
      return createResult(RESULT_STATUS.SUCCESS, "Stopped FXMaster scene effects.", { status, ...details });
    }

    return super.execute(action, context);
  }

  minimizeExecutionContext(context) {
    return {
      ...super.minimizeExecutionContext(context),
      providerHint: PROVIDERS.FXMASTER
    };
  }
}

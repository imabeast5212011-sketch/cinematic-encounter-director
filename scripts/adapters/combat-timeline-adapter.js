import { INTEGRATION_TARGETS, PROVIDERS, RESULT_STATUS } from "../constants.js";
import { createResult } from "../state/schema.js";
import { BaseAdapter } from "./base-adapter.js";

export class CombatTimelineAdapter extends BaseAdapter {
  constructor() {
    super(INTEGRATION_TARGETS.combatTimeline);
  }

  getNativeCapabilities(api) {
    const capabilities = [];
    if (typeof api?.openCountdownConfig === "function") capabilities.push("openCountdownConfig");
    if (api?.controller) capabilities.push("controllerStatus");
    const bridge = this.getDirectorBridge(api);
    if (bridge) capabilities.push("directorBridge");
    return capabilities;
  }

  getUnsupportedCapabilities(api, bridge) {
    const unsupported = [];
    if (!api) return ["No public API object detected."];
    if (!bridge) {
      unsupported.push(
        "Local Cinematic Combat Timeline 0.1.13 exposes api.controller, api.openCountdownConfig, and api.destroy only.",
        "No confirmed create/update/reset/disable/remove countdown public API is available.",
        "The Director will not write timeline private Combat flags directly."
      );
    }
    return unsupported;
  }

  statusFromDetection(module, api, bridge, capabilities) {
    if (!module.active) return "Inactive";
    if (!api) return "API not detected";
    if (capabilities.includes("openCountdownConfig")) return bridge ? "Ready" : "Limited";
    return super.statusFromDetection(module, api, bridge, capabilities);
  }

  async validate(action) {
    if (action.type === "combat-timeline.openConfig") {
      const status = await this.getStatus();
      if (!status.installed) return createResult(RESULT_STATUS.UNSUPPORTED, "Cinematic Combat Timeline is not installed.", { status });
      if (!status.active) return createResult(RESULT_STATUS.UNSUPPORTED, "Cinematic Combat Timeline is inactive.", { status });
      if (!status.capabilities.includes("openCountdownConfig")) {
        return createResult(RESULT_STATUS.UNSUPPORTED, "Timeline openCountdownConfig API is not available.", { status });
      }
      return createResult(RESULT_STATUS.SUCCESS, "Timeline openCountdownConfig API is available.", { status });
    }
    if (action.type === "combat-timeline.countdown") {
      return createResult(RESULT_STATUS.UNSUPPORTED, "Countdown mutation API was not exposed by the inspected Cinematic Combat Timeline version.");
    }
    return super.validate(action);
  }

  async execute(action, context) {
    if (action.type === "combat-timeline.openConfig") {
      const module = this.detectModule();
      const api = this.getPublicApi(module);
      if (!module?.active || typeof api?.openCountdownConfig !== "function") {
        return createResult(RESULT_STATUS.UNSUPPORTED, "Timeline openCountdownConfig API is unavailable.");
      }
      if (context?.dryRun) return createResult(RESULT_STATUS.DRY_RUN, "Dry run: would open Timeline countdown config.");
      await api.openCountdownConfig();
      return createResult(RESULT_STATUS.SUCCESS, "Opened Cinematic Combat Timeline countdown configuration.");
    }
    if (action.type === "combat-timeline.countdown") {
      return createResult(RESULT_STATUS.UNSUPPORTED, "Countdown mutation requires a future confirmed public Timeline API.");
    }
    return super.execute(action, context);
  }

  minimizeExecutionContext(context) {
    return {
      ...super.minimizeExecutionContext(context),
      providerHint: PROVIDERS.COMBAT_TIMELINE
    };
  }
}

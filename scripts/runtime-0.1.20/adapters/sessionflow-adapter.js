import { INTEGRATION_TARGETS, PROVIDERS, RESULT_STATUS } from "../constants.js";
import { createResult } from "../state/schema.js";
import { PublicApiActionAdapter } from "./public-api-action-adapter.js";

const METHOD_CANDIDATES = {
  "sessionflow.trigger": {
    trigger: ["trigger", "triggerContent", "run", "runContent", "execute", "executeContent", "play", "broadcast", "broadcastContent", "broadcastScene", "openScene"],
    default: ["trigger", "triggerContent", "run", "runContent", "execute", "broadcast", "broadcastContent"]
  },
  "sessionflow.open": {
    open: ["open", "openContent", "openGMPanel", "openPanel", "openWorkspace", "openSession", "openScene", "show", "showContent", "focus"],
    default: ["open", "openContent", "openGMPanel", "openPanel", "openWorkspace"]
  }
};

const PRESENTATION_SOCKET_HOOKS = Object.freeze({
  showImage: "sessionflow:showImage",
  hideImage: "sessionflow:hideImage",
  startTimer: "sessionflow:startTimer",
  pauseTimer: "sessionflow:pauseTimer",
  stopTimer: "sessionflow:stopTimer",
  timerEnd: "sessionflow:timerEnd",
  showClock: "sessionflow:showClock",
  updateClock: "sessionflow:updateClock",
  hideClock: "sessionflow:hideClock",
  flashClock: "sessionflow:flashClock",
  showSky: "sessionflow:showSky",
  updateSky: "sessionflow:updateSky",
  hideSky: "sessionflow:hideSky",
  flashSky: "sessionflow:flashSky",
  animateSky: "sessionflow:animateSky",
  showMap: "sessionflow:showMap",
  updateMap: "sessionflow:updateMap",
  hideMap: "sessionflow:hideMap",
  flashMap: "sessionflow:flashMap",
  showQuests: "sessionflow:showQuests",
  updateQuests: "sessionflow:updateQuests",
  hideQuests: "sessionflow:hideQuests",
  flashQuest: "sessionflow:flashQuest",
  showTreasury: "sessionflow:showTreasury",
  updateTreasury: "sessionflow:updateTreasury",
  hideTreasury: "sessionflow:hideTreasury",
  flashTreasury: "sessionflow:flashTreasury",
  showTracker: "sessionflow:showTracker",
  updateTracker: "sessionflow:updateTracker",
  hideTracker: "sessionflow:hideTracker",
  flashTracker: "sessionflow:flashTracker",
  showFaction: "sessionflow:showFaction",
  updateFaction: "sessionflow:updateFaction",
  hideFaction: "sessionflow:hideFaction",
  flashFaction: "sessionflow:flashFaction"
});

function hooksAvailable() {
  return typeof globalThis.Hooks?.call === "function";
}

function normalizeOperation(config = {}, fallback = "togglePanel") {
  return String(config.operation || config.action || fallback).trim() || fallback;
}

function normalizeArgs(value) {
  return Array.isArray(value) ? value : [];
}

function externalId(config = {}) {
  return config.externalId || config.id || config.sessionId || config.beatId || config.sceneId || "";
}

function payloadFromConfig(config = {}, context = {}) {
  return {
    ...(config.payload ?? config.data ?? {}),
    senderId: globalThis.game?.user?.id ?? "",
    source: "cinematic-encounter-director",
    context: {
      sequenceId: context?.sequence?.id ?? "",
      beatId: context?.beat?.id ?? "",
      sceneUuid: context?.sequence?.sceneUuid ?? ""
    }
  };
}

export class SessionFlowAdapter extends PublicApiActionAdapter {
  constructor() {
    super(INTEGRATION_TARGETS.sessionflow, METHOD_CANDIDATES);
  }

  getAdditionalPublicApiCandidates() {
    return [
      { source: "globalThis.SessionFlow.api", api: globalThis.SessionFlow?.api },
      { source: "globalThis.SessionFlow", api: globalThis.SessionFlow },
      { source: "globalThis.sessionFlow.api", api: globalThis.sessionFlow?.api },
      { source: "globalThis.sessionFlow", api: globalThis.sessionFlow },
      { source: "globalThis.sessionflow.api", api: globalThis.sessionflow?.api },
      { source: "globalThis.sessionflow", api: globalThis.sessionflow },
      { source: "game.sessionFlow.api", api: globalThis.game?.sessionFlow?.api },
      { source: "game.sessionFlow", api: globalThis.game?.sessionFlow },
      { source: "game.sessionflow.api", api: globalThis.game?.sessionflow?.api },
      { source: "game.sessionflow", api: globalThis.game?.sessionflow }
    ];
  }

  getNativeCapabilities(api, bridge) {
    const capabilities = super.getNativeCapabilities(api, bridge);
    if (hooksAvailable()) {
      capabilities.push("hooks:togglePanel", "hooks:navigatePanels", "socket:presentationHud");
    }
    if (api?.Widget && typeof api?.registerWidgetType === "function") capabilities.push("widgetRegistration");
    if (api?.chronicle3D) capabilities.push("chronicle3D");
    return [...new Set(capabilities)];
  }

  statusFromDetection(module, api, bridge, capabilities) {
    if (!module.active) return "Inactive";
    if (capabilities.includes("hooks:togglePanel") || capabilities.includes("socket:presentationHud")) return "Ready";
    return super.statusFromDetection(module, api, bridge, capabilities);
  }

  getUnsupportedCapabilities(api, _bridge) {
    const unsupported = [];
    if (!hooksAvailable()) unsupported.push("Foundry Hooks API was unavailable, so SessionFlow panel hooks cannot be called.");
    if (!api) unsupported.push("SessionFlow public API object was not detected; hook/socket integration may still work while the module is active.");
    if (!api?.Widget) unsupported.push("SessionFlow widget-registration API was not detected.");
    return unsupported;
  }

  buildHookCall(action, context = {}) {
    const config = action.config ?? {};
    const operation = normalizeOperation(config, action.type === "sessionflow.open" ? "togglePanel" : "callHook");

    if (operation === "togglePanel" || operation === "openPanel" || operation === "openWorkspace") {
      return { hook: "sessionflow:togglePanel", args: [] };
    }

    if (operation === "selectSession" || operation === "openSession") {
      const sessionId = config.sessionId || externalId(config);
      return sessionId ? { hook: "sessionflow:selectSession", args: [sessionId] } : { error: "SessionFlow session navigation needs config.sessionId or config.externalId." };
    }

    if (operation === "selectBeat" || operation === "openBeat") {
      const sessionId = config.sessionId || config.externalId || "";
      const beatId = config.beatId || config.id || "";
      return sessionId && beatId
        ? { hook: "sessionflow:selectBeat", args: [sessionId, beatId] }
        : { error: "SessionFlow beat navigation needs config.sessionId and config.beatId." };
    }

    if (operation === "selectScene" || operation === "openScene") {
      const sessionId = config.sessionId || "";
      const beatId = config.beatId || "";
      const sceneId = config.sessionflowSceneId || config.sceneId || config.externalId || "";
      return sessionId && beatId && sceneId
        ? { hook: "sessionflow:selectScene", args: [sessionId, beatId, sceneId] }
        : { error: "SessionFlow scene navigation needs config.sessionId, config.beatId, and config.sceneId." };
    }

    if (operation === "setAnchor") {
      return {
        hook: "sessionflow:setAnchor",
        args: [
          config.panelType || config.panel || "storyline",
          config.sessionId ?? null,
          config.beatId ?? null,
          config.sceneId ?? null
        ]
      };
    }

    if (operation === "navigateBack" || operation === "back") return { hook: "sessionflow:navigateBack", args: [] };
    if (operation === "closeStoryline" || operation === "close") return { hook: "sessionflow:closeStoryline", args: [] };
    if (operation === "togglePlayerPanel") return { hook: "sessionflow:togglePlayerPanel", args: [] };

    if (operation === "callHook") {
      const hook = String(config.hookName || config.hook || "").trim();
      if (!hook.startsWith("sessionflow:")) return { error: "SessionFlow custom hook actions require config.hookName starting with sessionflow:." };
      const args = Array.isArray(config.args) ? config.args : config.payload !== undefined ? [config.payload] : [];
      return { hook, args };
    }

    const socketHook = PRESENTATION_SOCKET_HOOKS[operation];
    if (socketHook) {
      const payload = { ...payloadFromConfig(config, context), action: operation };
      return { hook: socketHook, args: [payload], socketAction: operation, payload };
    }

    return { error: `Unsupported SessionFlow operation: ${operation}.` };
  }

  async validate(action, context = {}) {
    const status = await this.getStatus();
    if (status.status === "Disabled by setting") return createResult(RESULT_STATUS.UNSUPPORTED, "SessionFlow integration is disabled by setting.", { status });
    if (!status.installed) return createResult(RESULT_STATUS.UNSUPPORTED, "SessionFlow is not installed or could not be detected.", { status });
    if (!status.active) return createResult(RESULT_STATUS.UNSUPPORTED, "SessionFlow is installed but inactive.", { status });
    if (status.status !== "Ready") return createResult(RESULT_STATUS.UNSUPPORTED, `SessionFlow hook interface is unavailable: ${status.status}.`, { status });

    const call = this.buildHookCall(action, context);
    if (call.error) return createResult(RESULT_STATUS.WARNING, call.error, { status });
    return createResult(RESULT_STATUS.SUCCESS, `SessionFlow hook is available: ${call.hook}.`, { status, hook: call.hook, socketAction: call.socketAction ?? "" });
  }

  async execute(action, context = {}) {
    const status = await this.getStatus();
    if (status.status !== "Ready") return createResult(RESULT_STATUS.UNSUPPORTED, `SessionFlow action is unavailable: ${status.status}.`, { status });

    const call = this.buildHookCall(action, context);
    if (call.error) return createResult(RESULT_STATUS.WARNING, call.error, { status });
    if (context?.dryRun) return createResult(RESULT_STATUS.DRY_RUN, `Dry run: would call ${call.hook}.`, { status, hook: call.hook });

    try {
      if (call.socketAction && (action.config?.emitSocket ?? action.config?.broadcast ?? true)) {
        globalThis.game?.socket?.emit?.("module.sessionflow", call.payload);
      }
      globalThis.Hooks.call(call.hook, ...normalizeArgs(call.args));
      return createResult(RESULT_STATUS.SUCCESS, `Called SessionFlow ${call.hook}.`, { status, hook: call.hook, socketAction: call.socketAction ?? "" });
    } catch (error) {
      this.lastError = error?.message ?? String(error);
      return createResult(RESULT_STATUS.FAILURE, `SessionFlow ${call.hook} failed: ${this.lastError}`, { status, hook: call.hook });
    }
  }

  minimizeExecutionContext(context) {
    return {
      ...super.minimizeExecutionContext(context),
      providerHint: PROVIDERS.SESSIONFLOW
    };
  }
}

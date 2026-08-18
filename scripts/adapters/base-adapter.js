import { RESULT_STATUS } from "../constants.js";
import { createResult, safeString } from "../state/schema.js";
import { isIntegrationPermitted } from "../settings.js";

function normalizeText(value) {
  return String(value ?? "").toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export class BaseAdapter {
  constructor({ providerId, displayName, setting = "", moduleIdCandidates = [], titleMatchers = [] }) {
    this.providerId = providerId;
    this.displayName = displayName;
    this.setting = setting;
    this.moduleIdCandidates = moduleIdCandidates;
    this.titleMatchers = titleMatchers.map(normalizeText);
    this.lastError = "";
    this._status = null;
  }

  get enabledBySetting() {
    try {
      return isIntegrationPermitted(this.setting);
    } catch (_error) {
      return true;
    }
  }

  detectModule() {
    const modules = game.modules;
    for (const id of this.moduleIdCandidates) {
      const module = modules.get(id);
      if (module) return module;
    }

    const values = Array.from(modules?.values?.() ?? []);
    return values.find((module) => {
      const normalizedId = normalizeText(module.id);
      const normalizedTitle = normalizeText(module.title ?? module.name ?? "");
      return this.titleMatchers.some((matcher) => matcher && (normalizedId.includes(matcher) || normalizedTitle.includes(matcher)));
    }) ?? null;
  }

  getPublicApi(module) {
    const api = module?.api;
    if (!api || typeof api !== "object") return null;
    return api;
  }

  getDirectorBridge(api) {
    const bridge = api?.cinematicEncounterDirector ?? api?.encounterDirector;
    if (!bridge || typeof bridge !== "object") return null;
    return bridge;
  }

  async getStatus() {
    if (!this.enabledBySetting) {
      return this._status = {
        providerId: this.providerId,
        displayName: this.displayName,
        moduleId: this.moduleIdCandidates[0] ?? "",
        installed: false,
        active: false,
        version: "",
        apiDetected: false,
        status: "Disabled by setting",
        capabilities: [],
        unsupported: ["Integration disabled in world settings."],
        lastError: this.lastError,
        liveVerificationRequired: true
      };
    }

    try {
      const module = this.detectModule();
      if (!module) {
        return this._status = {
          providerId: this.providerId,
          displayName: this.displayName,
          moduleId: this.moduleIdCandidates[0] ?? "",
          installed: false,
          active: false,
          version: "",
          apiDetected: false,
          status: "Missing",
          capabilities: [],
          unsupported: ["Module was not detected locally at runtime."],
          lastError: this.lastError,
          liveVerificationRequired: true
        };
      }

      const api = this.getPublicApi(module);
      const bridge = this.getDirectorBridge(api);
      const bridgeCapabilities = await this.getBridgeCapabilities(bridge);
      const capabilities = this.getNativeCapabilities(api, bridge).concat(bridgeCapabilities);
      const apiDetected = Boolean(api);
      const status = this.statusFromDetection(module, api, bridge, capabilities);
      return this._status = {
        providerId: this.providerId,
        displayName: this.displayName,
        moduleId: module.id,
        installed: true,
        active: Boolean(module.active),
        version: safeString(module.version ?? module.versionId ?? "", 80),
        apiDetected,
        status,
        capabilities,
        unsupported: this.getUnsupportedCapabilities(api, bridge),
        lastError: this.lastError,
        liveVerificationRequired: status !== "Ready"
      };
    } catch (error) {
      this.lastError = error?.message ?? String(error);
      return this._status = {
        providerId: this.providerId,
        displayName: this.displayName,
        moduleId: this.moduleIdCandidates[0] ?? "",
        installed: false,
        active: false,
        version: "",
        apiDetected: false,
        status: "Error",
        capabilities: [],
        unsupported: [],
        lastError: this.lastError,
        liveVerificationRequired: true
      };
    }
  }

  statusFromDetection(module, api, bridge, capabilities) {
    if (!module.active) return "Inactive";
    if (!api) return "API not detected";
    if (!bridge && !capabilities.length) return "Detected only";
    if (capabilities.length) return "Ready";
    return "Detected only";
  }

  async getBridgeCapabilities(bridge) {
    if (!bridge) return [];
    try {
      if (typeof bridge.getCapabilities === "function") {
        const capabilities = await bridge.getCapabilities();
        return Array.isArray(capabilities) ? capabilities.map((capability) => safeString(capability, 120)).filter(Boolean) : [];
      }
      if (Array.isArray(bridge.capabilities)) return bridge.capabilities.map((capability) => safeString(capability, 120)).filter(Boolean);
      return [];
    } catch (error) {
      this.lastError = error?.message ?? String(error);
      return [];
    }
  }

  getNativeCapabilities(_api, bridge) {
    if (bridge) return ["directorBridge"];
    return [];
  }

  getUnsupportedCapabilities(_api, bridge) {
    return bridge ? [] : ["No confirmed Encounter Director bridge API detected."];
  }

  manualCueResult(action, status) {
    return createResult(
      RESULT_STATUS.WARNING,
      `Manual cue only: ${this.displayName} is ${status.status}; run "${action.name}" yourself during this Beat.`,
      { status, manualCue: true }
    );
  }

  async validate(action) {
    const status = await this.getStatus();
    if (status.status === "Disabled by setting") {
      return createResult(RESULT_STATUS.UNSUPPORTED, `${this.displayName} integration is disabled by setting.`, { status });
    }
    if (!status.installed) return createResult(RESULT_STATUS.UNSUPPORTED, `${this.displayName} is not installed or could not be detected.`, { status });
    if (!status.active) return createResult(RESULT_STATUS.UNSUPPORTED, `${this.displayName} is installed but inactive.`, { status });
    if (!status.apiDetected) return this.manualCueResult(action, status);
    const module = this.detectModule();
    const bridge = this.getDirectorBridge(this.getPublicApi(module));
    if (!bridge) return this.manualCueResult(action, status);
    if (typeof bridge.validateAction === "function") {
      try {
        const result = await bridge.validateAction({ providerId: this.providerId, action });
        return normalizeExternalResult(result, RESULT_STATUS.SUCCESS, `${this.displayName} reference validated.`);
      } catch (error) {
        this.lastError = error?.message ?? String(error);
        return createResult(RESULT_STATUS.FAILURE, `${this.displayName} validation failed: ${this.lastError}`);
      }
    }
    return createResult(RESULT_STATUS.WARNING, `${this.displayName} bridge detected but does not expose validateAction.`);
  }

  async execute(action, context) {
    const status = await this.getStatus();
    if (status.status !== "Ready") {
      if (status.installed && status.active && status.status !== "Disabled by setting") {
        return createResult(
          RESULT_STATUS.SKIPPED,
          `Manual cue: ${this.displayName} cannot be automated yet; GM should run "${action.name}" manually.`,
          { status, manualCue: true }
        );
      }
      return createResult(RESULT_STATUS.UNSUPPORTED, `${this.displayName} action is unavailable: ${status.status}.`, { status });
    }
    const module = this.detectModule();
    const bridge = this.getDirectorBridge(this.getPublicApi(module));
    if (!bridge || typeof bridge.executeAction !== "function") {
      return createResult(RESULT_STATUS.UNSUPPORTED, `${this.displayName} bridge does not expose executeAction.`);
    }
    try {
      const result = await bridge.executeAction({
        providerId: this.providerId,
        action,
        context: this.minimizeExecutionContext(context)
      });
      return normalizeExternalResult(result, RESULT_STATUS.SUCCESS, `${this.displayName} action completed.`);
    } catch (error) {
      this.lastError = error?.message ?? String(error);
      return createResult(RESULT_STATUS.FAILURE, `${this.displayName} action failed: ${this.lastError}`);
    }
  }

  async rollback(action, context) {
    const module = this.detectModule();
    const bridge = this.getDirectorBridge(this.getPublicApi(module));
    if (!bridge || typeof bridge.rollbackAction !== "function") {
      return createResult(RESULT_STATUS.UNSUPPORTED, `${this.displayName} does not expose rollbackAction.`);
    }
    try {
      const result = await bridge.rollbackAction({
        providerId: this.providerId,
        action,
        context: this.minimizeExecutionContext(context)
      });
      return normalizeExternalResult(result, RESULT_STATUS.ROLLED_BACK, `${this.displayName} action rolled back.`);
    } catch (error) {
      this.lastError = error?.message ?? String(error);
      return createResult(RESULT_STATUS.FAILURE, `${this.displayName} rollback failed: ${this.lastError}`);
    }
  }

  async emergencyStop(_context) {
    const module = this.detectModule();
    const bridge = this.getDirectorBridge(this.getPublicApi(module));
    if (!bridge || typeof bridge.emergencyStop !== "function") return createResult(RESULT_STATUS.SKIPPED, `${this.displayName} has no Director-owned stop handler.`);
    try {
      const result = await bridge.emergencyStop({ providerId: this.providerId });
      return normalizeExternalResult(result, RESULT_STATUS.SUCCESS, `${this.displayName} emergency stop completed.`);
    } catch (error) {
      this.lastError = error?.message ?? String(error);
      return createResult(RESULT_STATUS.WARNING, `${this.displayName} emergency stop warning: ${this.lastError}`);
    }
  }

  minimizeExecutionContext(context) {
    return {
      executionId: context?.executionId ?? "",
      sequenceId: context?.sequence?.id ?? "",
      beatId: context?.beat?.id ?? "",
      sceneUuid: context?.sequence?.sceneUuid ?? "",
      dryRun: Boolean(context?.dryRun)
    };
  }
}

export function normalizeExternalResult(result, fallbackStatus, fallbackMessage) {
  if (!result || typeof result !== "object") return createResult(fallbackStatus, fallbackMessage);
  return createResult(result.status ?? fallbackStatus, result.message ?? fallbackMessage, result.details ?? {});
}

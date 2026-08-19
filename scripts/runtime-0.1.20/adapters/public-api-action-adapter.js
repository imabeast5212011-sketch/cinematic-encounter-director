import { RESULT_STATUS } from "../constants.js";
import { createResult } from "../state/schema.js";
import { BaseAdapter, findPublicApiMethod, listPublicApiMethods } from "./base-adapter.js";

function unique(values) {
  return [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];
}

function configMethods(config = {}) {
  const values = [
    config.method,
    config.apiMethod,
    config.functionName,
    ...(Array.isArray(config.methodCandidates) ? config.methodCandidates : [])
  ];
  return unique(values);
}

function externalId(config = {}) {
  return config.externalId || config.id || config.sceneId || config.trackId || config.presetId || config.contentId || "";
}

function normalizeOperation(config = {}) {
  return String(config.operation ?? "").trim();
}

function tokenize(value) {
  return String(value ?? "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLocaleLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter(Boolean);
}

function actionOperationTokens(action) {
  const operation = normalizeOperation(action.config ?? {}) || String(action.type ?? "").split(".").at(-1) || "";
  const tokens = tokenize(operation);
  if (operation === "playMusic") return ["play", "music"];
  if (operation === "stopMusic") return ["stop", "music"];
  if (operation === "startAmbience") return ["start", "ambience"];
  if (operation === "stopAmbience") return ["stop", "ambience"];
  if (operation === "playSoundCue") return ["play", "sound"];
  return tokens;
}

function methodMatchesTokens(methodName, tokens) {
  if (!tokens.length) return false;
  const methodTokens = tokenize(methodName);
  const joined = methodTokens.join(" ");
  return tokens.every((token) => methodTokens.includes(token) || joined.includes(token));
}

function publicMethodNames(api) {
  return listPublicApiMethods(api);
}

export class PublicApiActionAdapter extends BaseAdapter {
  constructor(target, methodCandidates = {}) {
    super(target);
    this.methodCandidates = methodCandidates;
  }

  getNativeCapabilities(api, bridge) {
    const capabilities = super.getNativeCapabilities(api, bridge);
    if (publicMethodNames(api).length) capabilities.push("publicApiCall");
    return capabilities;
  }

  statusFromDetection(module, api, bridge, capabilities) {
    if (!module.active) return "Inactive";
    if (!api) return "API not detected";
    if (capabilities.includes("publicApiCall")) return "Ready";
    return super.statusFromDetection(module, api, bridge, capabilities);
  }

  getUnsupportedCapabilities(api, bridge) {
    const unsupported = [];
    if (!api) return [`No ${this.displayName} public API object detected.`];
    if (!publicMethodNames(api).length) unsupported.push(`${this.displayName} API exposed no callable public methods.`);
    if (!bridge) unsupported.push("No Encounter Director bridge was detected; public API calls require action config.method or a known method name.");
    return unsupported;
  }

  getActionMethodCandidates(action) {
    const config = action.config ?? {};
    const operation = normalizeOperation(config);
    const byType = this.methodCandidates[action.type] ?? {};
    return unique([
      ...configMethods(config),
      ...(Array.isArray(byType[operation]) ? byType[operation] : []),
      ...(Array.isArray(byType.default) ? byType.default : []),
      ...(Array.isArray(this.methodCandidates.default) ? this.methodCandidates.default : [])
    ]);
  }

  resolveMethod(api, action) {
    const configured = findPublicApiMethod(api, this.getActionMethodCandidates(action));
    if (configured) return configured;

    const tokens = actionOperationTokens(action);
    const inferred = publicMethodNames(api).filter((methodName) => methodMatchesTokens(methodName, tokens));
    return findPublicApiMethod(api, inferred);
  }

  buildPayload(action, context = {}) {
    const config = action.config ?? {};
    const id = externalId(config);
    return {
      providerId: this.providerId,
      actionType: action.type,
      actionName: action.name,
      operation: normalizeOperation(config),
      externalId: id,
      id,
      config,
      context: this.minimizeExecutionContext(context)
    };
  }

  buildArgs(action, context, methodName) {
    const config = action.config ?? {};
    if (Array.isArray(config.args)) return config.args;

    const id = externalId(config);
    const payload = this.buildPayload(action, context);
    const callStyle = config.callStyle || (methodName?.startsWith("open") && !id ? "none" : "object");

    if (callStyle === "none") return [];
    if (callStyle === "id") return id ? [id] : [];
    if (callStyle === "idObject") return id ? [id, payload] : [payload];
    if (callStyle === "config") return [config];
    return [payload];
  }

  async validate(action, context = {}) {
    const status = await this.getStatus();
    if (status.status === "Disabled by setting") return createResult(RESULT_STATUS.UNSUPPORTED, `${this.displayName} integration is disabled by setting.`, { status });
    if (!status.installed) return createResult(RESULT_STATUS.UNSUPPORTED, `${this.displayName} is not installed or could not be detected.`, { status });
    if (!status.active) return createResult(RESULT_STATUS.UNSUPPORTED, `${this.displayName} is installed but inactive.`, { status });
    if (!status.apiDetected) return this.manualCueResult(action, status);

    const api = this.getPublicApi(this.detectModule());
    const method = this.resolveMethod(api, action);
    if (!method) {
      return createResult(
        RESULT_STATUS.WARNING,
        `${this.displayName} API is detected, but no callable method matched this Action. Set config.method to one of the Public API methods shown in Integration Health.`,
        { status, apiMethods: publicMethodNames(api), candidates: this.getActionMethodCandidates(action), manualCue: true }
      );
    }
    return createResult(RESULT_STATUS.SUCCESS, `${this.displayName} public API method is available: ${method.name}.`, { status, apiMethod: method.name });
  }

  async execute(action, context = {}) {
    const status = await this.getStatus();
    if (!status.installed || !status.active || !status.apiDetected) return createResult(RESULT_STATUS.UNSUPPORTED, `${this.displayName} action is unavailable: ${status.status}.`, { status });
    const api = this.getPublicApi(this.detectModule());
    const method = this.resolveMethod(api, action);
    if (!method) {
      return createResult(
        RESULT_STATUS.SKIPPED,
        `Manual cue: ${this.displayName} has no matched public API method for "${action.name}".`,
        { status, apiMethods: publicMethodNames(api), candidates: this.getActionMethodCandidates(action), manualCue: true }
      );
    }
    if (context?.dryRun) return createResult(RESULT_STATUS.DRY_RUN, `Dry run: would call ${this.displayName}.${method.name}.`, { status, apiMethod: method.name });

    try {
      const result = await method.fn.apply(method.owner, this.buildArgs(action, context, method.name));
      return createResult(RESULT_STATUS.SUCCESS, `Called ${this.displayName}.${method.name}.`, { status, apiMethod: method.name, result });
    } catch (error) {
      this.lastError = error?.message ?? String(error);
      return createResult(RESULT_STATUS.FAILURE, `${this.displayName}.${method.name} failed: ${this.lastError}`, { status, apiMethod: method.name });
    }
  }
}

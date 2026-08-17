import { DANGER_LEVELS, PROVIDERS, RESULT_STATUS } from "../constants.js";
import { getIntegrationActionType, INTEGRATION_ACTION_TYPES } from "../actions/integration-actions.js";
import { getNativeActionType, NATIVE_ACTION_TYPES } from "../actions/native-actions.js";
import { createResult } from "../state/schema.js";

export class ValidationService {
  constructor(adapters) {
    this.adapters = adapters;
    this.customActionTypes = [];
  }

  getActionMetadata(actionType) {
    return getNativeActionType(actionType) ?? getIntegrationActionType(actionType) ?? this.customActionTypes.find((entry) => entry.id === actionType) ?? null;
  }

  getAllActionTypes() {
    return [...NATIVE_ACTION_TYPES, ...INTEGRATION_ACTION_TYPES, ...this.customActionTypes];
  }

  registerActionType(actionType) {
    if (!actionType?.id || !actionType?.provider || !actionType?.label) throw new Error("Action types require id, provider, and label.");
    if (this.getActionMetadata(actionType.id)) throw new Error(`Action type already exists: ${actionType.id}`);
    this.customActionTypes.push({ ...actionType });
    return actionType;
  }

  async getActionPickerEntries() {
    const statuses = await this.getIntegrationStatuses();
    return this.getAllActionTypes().map((action) => {
      const status = statuses.find((entry) => entry.providerId === action.provider);
      const nativeReady = action.provider === PROVIDERS.FOUNDRY;
      return {
        ...action,
        providerStatus: nativeReady ? "Ready" : status?.status ?? "Missing",
        available: nativeReady || status?.status === "Ready" || (action.id === "combat-timeline.openConfig" && status?.capabilities?.includes("openCountdownConfig"))
      };
    });
  }

  async getIntegrationStatuses() {
    const statuses = [];
    for (const adapter of this.adapters.values()) {
      statuses.push(await adapter.getStatus());
    }
    return statuses;
  }

  async validateAction(action, context = {}) {
    if (!action?.enabled) return createResult(RESULT_STATUS.SKIPPED, "Action is disabled.");
    const metadata = this.getActionMetadata(action.type);
    if (!metadata) return createResult(RESULT_STATUS.UNSUPPORTED, `Action type is not registered: ${action.type}`);
    const adapter = this.adapters.get(metadata.provider) ?? this.adapters.get(action.adapter);
    if (!adapter) return createResult(RESULT_STATUS.UNSUPPORTED, `No adapter is registered for provider: ${metadata.provider}`);
    const result = await adapter.validate(action, context);
    result.details = {
      ...(result.details ?? {}),
      actionType: action.type,
      provider: metadata.provider,
      dangerLevel: metadata.dangerLevel ?? DANGER_LEVELS.SAFE,
      rollbackSupported: Boolean(metadata.rollbackSupported)
    };
    return result;
  }

  async validateBeat(sequence, beat, context = {}) {
    const actions = this.getOrderedActions(beat).filter((action) => action.enabled);
    const results = [];
    for (const action of actions) {
      const result = await this.validateAction(action, { ...context, sequence, beat });
      results.push({ actionId: action.id, actionName: action.name, result });
    }
    const failures = results.filter((entry) => [RESULT_STATUS.FAILURE, RESULT_STATUS.UNSUPPORTED].includes(entry.result.status));
    return {
      status: failures.length ? RESULT_STATUS.WARNING : RESULT_STATUS.SUCCESS,
      message: failures.length ? `${failures.length} Action(s) require attention.` : "Beat validated successfully.",
      results,
      executionOrder: actions.map((action) => ({
        id: action.id,
        name: action.name,
        type: action.type,
        executionMode: action.executionMode,
        parallelGroup: action.parallelGroup
      }))
    };
  }

  getOrderedActions(beat) {
    const ids = Array.isArray(beat?.actionIds) ? beat.actionIds : [];
    const byId = new Map((beat?.actions ?? []).map((action) => [action.id, action]));
    const ordered = ids.map((id) => byId.get(id)).filter(Boolean);
    const missing = (beat?.actions ?? []).filter((action) => !ids.includes(action.id));
    return [...ordered, ...missing];
  }
}

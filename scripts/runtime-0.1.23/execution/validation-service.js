import { DANGER_LEVELS, PROVIDERS, RESULT_STATUS, TRIGGER_ACTIONS, TRIGGER_EVENTS } from "../constants.js";
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
      const automated = nativeReady
        || status?.status === "Ready"
        || (action.id === "combat-timeline.openConfig" && status?.capabilities?.includes("openCountdownConfig"));
      const manualCue = !automated && Boolean(status?.installed && status?.active && status?.status !== "Disabled by setting");
      return {
        ...action,
        providerStatus: nativeReady ? "Ready" : manualCue ? `${status.status} / manual cue` : status?.status ?? "Missing",
        automated,
        manualCue,
        available: automated || manualCue
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

  validateTrigger(trigger) {
    if (!trigger?.enabled) return createResult(RESULT_STATUS.SKIPPED, "Trigger is disabled.");
    if (!Object.values(TRIGGER_EVENTS).includes(trigger.event)) {
      return createResult(RESULT_STATUS.UNSUPPORTED, `Trigger event is not supported: ${trigger.event}`);
    }
    if (!Object.values(TRIGGER_ACTIONS).includes(trigger.action)) {
      return createResult(RESULT_STATUS.UNSUPPORTED, `Trigger action is not supported: ${trigger.action}`);
    }

    const count = Number(trigger.count);
    const round = Number(trigger.round);
    const turn = Number(trigger.turn);
    const initiative = Number(trigger.initiative);
    const threshold = Number(trigger.threshold);

    switch (trigger.event) {
      case TRIGGER_EVENTS.ENEMY_DEFEATED_COUNT:
      case TRIGGER_EVENTS.COMBATANT_DEFEATED_COUNT:
      case TRIGGER_EVENTS.TOKEN_DEFEATED:
      case TRIGGER_EVENTS.ALLY_DEFEATED:
        if (!Number.isInteger(count) || count < 1) return createResult(RESULT_STATUS.FAILURE, "Defeat-count triggers need count 1 or higher.");
        break;
      case TRIGGER_EVENTS.TOKEN_HP_AT_OR_BELOW:
        if (!Number.isFinite(threshold)) return createResult(RESULT_STATUS.FAILURE, "HP threshold triggers need a numeric threshold.");
        if (!["hp", "percent"].includes(trigger.thresholdType)) return createResult(RESULT_STATUS.FAILURE, "HP threshold mode must be hp or percent.");
        break;
      case TRIGGER_EVENTS.COMBAT_ROUND_STARTED:
      case TRIGGER_EVENTS.COMBAT_ROUND_AT_LEAST:
        if (!Number.isInteger(round) || round < 1) return createResult(RESULT_STATUS.FAILURE, "Combat round triggers need round 1 or higher.");
        break;
      case TRIGGER_EVENTS.COMBAT_TURN_STARTED:
        if (!Number.isInteger(turn) || turn < 1) return createResult(RESULT_STATUS.FAILURE, "Combat turn triggers need turn 1 or higher.");
        break;
      case TRIGGER_EVENTS.INITIATIVE_REACHED:
        if (!Number.isFinite(initiative)) return createResult(RESULT_STATUS.FAILURE, "Initiative triggers need a numeric initiative value.");
        if (!["gte", "lte", "gt", "lt", "eq"].includes(trigger.comparison)) return createResult(RESULT_STATUS.FAILURE, "Initiative triggers need a valid comparison.");
        break;
      case TRIGGER_EVENTS.COMBAT_STARTED:
      case TRIGGER_EVENTS.COMBAT_ENDED:
        break;
      default:
        return createResult(RESULT_STATUS.UNSUPPORTED, `Trigger event is not supported: ${trigger.event}`);
    }

    return createResult(RESULT_STATUS.SUCCESS, "Trigger configuration is valid.");
  }

  async validateBeat(sequence, beat, context = {}) {
    const actions = this.getOrderedActions(beat).filter((action) => action.enabled);
    const results = [];
    for (const action of actions) {
      const result = await this.validateAction(action, { ...context, sequence, beat });
      results.push({ actionId: action.id, actionName: action.name, result });
    }
    const triggerResults = (beat?.triggers ?? []).map((trigger) => ({
      triggerId: trigger.id,
      triggerName: trigger.name,
      result: this.validateTrigger(trigger)
    }));
    const failures = results.filter((entry) => [RESULT_STATUS.FAILURE, RESULT_STATUS.UNSUPPORTED].includes(entry.result.status));
    const triggerFailures = triggerResults.filter((entry) => [RESULT_STATUS.FAILURE, RESULT_STATUS.UNSUPPORTED].includes(entry.result.status));
    const attention = failures.length + triggerFailures.length;
    return {
      status: attention ? RESULT_STATUS.WARNING : RESULT_STATUS.SUCCESS,
      message: attention
        ? `${failures.length} Action(s) and ${triggerFailures.length} Trigger(s) require attention.`
        : "Beat validated successfully.",
      results,
      triggerResults,
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

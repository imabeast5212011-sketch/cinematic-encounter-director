import {
  DANGER_LEVELS,
  EXECUTION_MODES,
  FAILURE_POLICIES,
  HOOKS,
  MAX_DELAY_MS,
  RESULT_STATUS,
  SETTINGS
} from "../constants.js";
import { getNativeActionType } from "../actions/native-actions.js";
import { getIntegrationActionType } from "../actions/integration-actions.js";
import { createResult, makeId, nowStamp, safeInteger, safeString } from "../state/schema.js";
import { getSetting } from "../settings.js";

function orderedBeats(sequence) {
  const byId = new Map((sequence?.beats ?? []).map((beat) => [beat.id, beat]));
  const fromIds = (sequence?.beatIds ?? []).map((id) => byId.get(id)).filter(Boolean);
  const missing = (sequence?.beats ?? []).filter((beat) => !(sequence?.beatIds ?? []).includes(beat.id));
  return [...fromIds, ...missing];
}

function confirmDialog({ title, content, yes = "Continue", no = "Cancel" }) {
  if (globalThis.Dialog?.confirm) {
    return Dialog.confirm({
      title,
      content: `<p>${foundry?.utils?.escapeHTML?.(content) ?? content}</p>`,
      yes: () => true,
      no: () => false,
      defaultYes: false
    });
  }
  return Promise.resolve(globalThis.confirm?.(`${title}\n\n${content}`) ?? false);
}

function actionMetadata(action) {
  return getNativeActionType(action.type) ?? getIntegrationActionType(action.type);
}

function isDangerous(metadata) {
  return [DANGER_LEVELS.CHANGES_SCENE, DANGER_LEVELS.CHANGES_COMBAT, DANGER_LEVELS.DISRUPTIVE].includes(metadata?.dangerLevel);
}

export class ExecutionController {
  constructor({ store, validation, authority, log, rollback, adapters }) {
    this.store = store;
    this.validation = validation;
    this.authority = authority;
    this.log = log;
    this.rollback = rollback;
    this.adapters = adapters;
    this.activeRuns = new Map();
    this.timers = new Map();
  }

  async dryRunBeat(sequenceId, beatId, scene = this.store.getActiveScene()) {
    const sequence = await this.store.getSequence(sequenceId, scene);
    const beat = orderedBeats(sequence).find((entry) => entry.id === beatId);
    if (!sequence || !beat) return { status: RESULT_STATUS.FAILURE, message: "Sequence or Beat was not found.", results: [] };
    return this.validation.validateBeat(sequence, beat, { dryRun: true });
  }

  async runAction(sequenceId, beatId, actionId, options = {}) {
    const scene = options.scene ?? this.store.getActiveScene();
    const sequence = await this.store.getSequence(sequenceId, scene);
    const beat = orderedBeats(sequence).find((entry) => entry.id === beatId);
    const action = this.validation.getOrderedActions(beat).find((entry) => entry.id === actionId);
    if (!sequence || !beat || !action) return createResult(RESULT_STATUS.FAILURE, "Sequence, Beat, or Action was not found.");
    const executionId = options.executionId ?? makeId("execution");
    const authority = await this.authority.acquire(scene, { sequenceId, beatId, executionId, revision: sequence.version });
    if (!authority.ok) return authority.result;
    try {
      const result = await this.executeOne(action, { scene, sequence, beat, executionId, singleAction: true, confirmedDangerous: options.confirmedDangerous });
      return result;
    } finally {
      await this.authority.release(scene, executionId);
    }
  }

  async runBeat(sequenceId, beatId, options = {}) {
    const scene = options.scene ?? this.store.getActiveScene();
    const sequence = await this.store.getSequence(sequenceId, scene);
    const beat = orderedBeats(sequence).find((entry) => entry.id === beatId);
    if (!sequence || !beat) return createResult(RESULT_STATUS.FAILURE, "Sequence or Beat was not found.");

    const key = `${scene?.id}:${sequenceId}:${beatId}`;
    if (this.activeRuns.has(key)) return createResult(RESULT_STATUS.WARNING, "This Beat is already running on this client.");
    const executionId = options.executionId ?? makeId("execution");
    const authority = await this.authority.acquire(scene, { sequenceId, beatId, executionId, revision: sequence.version });
    if (!authority.ok) return authority.result;

    const runState = { executionId, cancelled: false, scene, sequenceId, beatId };
    this.activeRuns.set(key, runState);
    Hooks.callAll(HOOKS.BEAT_START, { executionId, sequenceId, beatId });
    await this.log.append({ executionId, sequenceId, beatId, status: RESULT_STATUS.SUCCESS, message: `Beat started: ${beat.name}` }, scene);

    try {
      const validation = await this.validation.validateBeat(sequence, beat, { executionId });
      const blocking = validation.results.filter((entry) => [RESULT_STATUS.FAILURE, RESULT_STATUS.UNSUPPORTED].includes(entry.result.status));
      if (blocking.length && !options.continueAfterValidationWarnings) {
        await this.log.append({ executionId, sequenceId, beatId, status: RESULT_STATUS.WARNING, message: validation.message, details: validation }, scene);
        return createResult(RESULT_STATUS.WARNING, validation.message, { validation });
      }

      const actions = this.validation.getOrderedActions(beat).filter((action) => action.enabled);
      const groups = this.buildExecutionGroups(actions);
      const results = [];
      for (const group of groups) {
        if (runState.cancelled) break;
        await this.authority.refresh(scene, executionId);
        if (group.mode === EXECUTION_MODES.PARALLEL) {
          const settled = await Promise.allSettled(group.actions.map((action) => this.executeOne(action, { scene, sequence, beat, executionId, runState, confirmedDangerous: options.confirmedDangerous })));
          for (const entry of settled) {
            results.push(entry.status === "fulfilled" ? entry.value : createResult(RESULT_STATUS.FAILURE, entry.reason?.message ?? String(entry.reason)));
          }
        } else {
          for (const action of group.actions) {
            if (runState.cancelled) break;
            results.push(await this.executeOne(action, { scene, sequence, beat, executionId, runState, confirmedDangerous: options.confirmedDangerous }));
          }
        }
        if (this.shouldStopAfterGroup(results, beat)) break;
      }

      const finalStatus = runState.cancelled
        ? RESULT_STATUS.CANCELLED
        : results.some((result) => result.status === RESULT_STATUS.FAILURE)
          ? RESULT_STATUS.WARNING
          : RESULT_STATUS.SUCCESS;
      const final = createResult(finalStatus, runState.cancelled ? "Beat execution cancelled." : `Beat finished: ${beat.name}`, { results });
      await this.log.append({ executionId, sequenceId, beatId, status: final.status, message: final.message, details: final.details }, scene);
      Hooks.callAll(HOOKS.BEAT_FINISH, { executionId, sequenceId, beatId, result: final });
      if (final.status === RESULT_STATUS.SUCCESS) await this.store.updateBeat(sequenceId, beatId, { manualState: "completed" }, scene);
      return final;
    } finally {
      this.clearExecutionTimers(executionId);
      this.activeRuns.delete(key);
      await this.authority.release(scene, executionId);
    }
  }

  buildExecutionGroups(actions) {
    const groups = [];
    let current = null;
    for (const action of actions) {
      const canGroup = action.executionMode === EXECUTION_MODES.PARALLEL && action.parallelGroup;
      if (canGroup && current?.mode === EXECUTION_MODES.PARALLEL && current.key === action.parallelGroup) {
        current.actions.push(action);
        continue;
      }
      current = {
        mode: canGroup ? EXECUTION_MODES.PARALLEL : EXECUTION_MODES.SEQUENTIAL,
        key: canGroup ? action.parallelGroup : action.id,
        actions: [action]
      };
      groups.push(current);
    }
    return groups;
  }

  shouldStopAfterGroup(results, beat) {
    const last = results.at(-1);
    if (!last) return false;
    if (last.status === RESULT_STATUS.CANCELLED) return true;
    if (last.status !== RESULT_STATUS.FAILURE && last.status !== RESULT_STATUS.UNSUPPORTED) return false;
    if (beat.continueOnActionFailure) return false;
    if (last.details?.failurePolicy === FAILURE_POLICIES.CONTINUE) return false;
    return true;
  }

  async executeOne(action, context) {
    const metadata = actionMetadata(action);
    const scene = context.scene;
    const executionId = context.executionId;
    const sequenceId = context.sequence.id;
    const beatId = context.beat.id;
    const actionContext = { ...context, action };

    if (!action.enabled) return createResult(RESULT_STATUS.SKIPPED, `Skipped disabled Action: ${action.name}`);
    const validation = await this.validation.validateAction(action, actionContext);
    if (!context.dryRun) await this.store.recordActionValidation(sequenceId, beatId, action.id, validation, scene);
    if ([RESULT_STATUS.FAILURE, RESULT_STATUS.UNSUPPORTED].includes(validation.status)) {
      const result = { ...validation, executionId, actionId: action.id, details: { ...(validation.details ?? {}), failurePolicy: action.failurePolicy } };
      await this.recordResult(result, actionContext);
      return result;
    }

    if (context.runState?.cancelled) return createResult(RESULT_STATUS.CANCELLED, "Execution was cancelled before Action started.");
    if (await this.requiresConfirmation(action, metadata, context) && !(await this.confirmAction(action, metadata))) {
      const result = createResult(RESULT_STATUS.CANCELLED, `GM cancelled Action: ${action.name}`, { failurePolicy: action.failurePolicy });
      await this.recordResult(result, actionContext);
      return result;
    }

    let result;
    if (action.type === "native.delay") result = await this.executeDelay(action, context);
    else if (action.type === "native.waitForConfirmation") result = await this.executeWait(action, context);
    else {
      const adapter = this.adapters.get(metadata?.provider ?? action.adapter);
      result = adapter ? await adapter.execute(action, context) : createResult(RESULT_STATUS.UNSUPPORTED, "Action adapter is unavailable.");
    }

    result.executionId = executionId;
    result.actionId = action.id;
    result.details = {
      ...(result.details ?? {}),
      provider: metadata?.provider ?? action.adapter,
      dangerLevel: metadata?.dangerLevel ?? DANGER_LEVELS.SAFE,
      failurePolicy: action.failurePolicy
    };
    await this.recordResult(result, actionContext);

    const delayAfterMs = safeInteger(action.delayAfterMs, 0, MAX_DELAY_MS, 0);
    if (delayAfterMs > 0 && !context.runState?.cancelled && context.runState) {
      await this.delay(executionId, delayAfterMs, context.runState);
    }
    return result;
  }

  async recordResult(result, context) {
    const { scene, sequence, beat, action, executionId } = context;
    const snapshotId = await this.rollback.storeFromResult(result, { executionId, sequence, beat, action }, scene);
    const storedResult = snapshotId
      ? { ...result, details: { ...(result.details ?? {}), rollbackSnapshotRef: snapshotId } }
      : result;
    await this.store.recordActionResult(sequence.id, beat.id, action.id, storedResult, scene);
    await this.log.append({
      executionId,
      sequenceId: sequence.id,
      beatId: beat.id,
      actionId: action.id,
      status: storedResult.status,
      message: `${action.name}: ${storedResult.message}`,
      details: storedResult.details
    }, scene);
    Hooks.callAll(HOOKS.ACTION_RESULT, { executionId, sequenceId: sequence.id, beatId: beat.id, actionId: action.id, result: storedResult });
  }

  async requiresConfirmation(action, metadata, context) {
    if (metadata?.requiresConfirmation) return true;
    if (action.requiresConfirmation) return true;
    if (context.confirmedDangerous) return false;
    if (!isDangerous(metadata)) return false;
    if (metadata?.dangerLevel === DANGER_LEVELS.CHANGES_SCENE) return Boolean(getSetting(SETTINGS.REQUIRE_SCENE_ACTIVATION_CONFIRMATION) && action.type === "native.activateScene");
    if ([DANGER_LEVELS.CHANGES_COMBAT, DANGER_LEVELS.DISRUPTIVE].includes(metadata?.dangerLevel)) return Boolean(getSetting(SETTINGS.REQUIRE_COMBAT_DANGER_CONFIRMATION));
    return false;
  }

  async confirmAction(action, metadata) {
    return confirmDialog({
      title: "Confirm Director Action",
      content: `${action.name} (${metadata?.label ?? action.type}) is marked as ${metadata?.dangerLevel ?? "dangerous"}.`
    });
  }

  async executeDelay(action, context) {
    const durationMs = safeInteger(action.config?.durationMs, 0, MAX_DELAY_MS, 0);
    if (durationMs <= 0) return createResult(RESULT_STATUS.SKIPPED, "Delay duration was zero.");
    await this.delay(context.executionId, durationMs, context.runState);
    return createResult(RESULT_STATUS.SUCCESS, `Waited ${durationMs}ms.`, { durationMs });
  }

  async executeWait(action, _context) {
    const prompt = safeString(action.config?.prompt, 500, "Continue this Beat?");
    const ok = await confirmDialog({ title: "Manual Wait Point", content: prompt, yes: "Continue", no: "Stop" });
    return ok ? createResult(RESULT_STATUS.SUCCESS, "Manual wait point continued.") : createResult(RESULT_STATUS.CANCELLED, "Manual wait point cancelled by GM.");
  }

  delay(executionId, durationMs, runState) {
    return new Promise((resolve, reject) => {
      if (runState?.cancelled) {
        reject(new Error("Execution was cancelled before delay started."));
        return;
      }
      const timerId = globalThis.setTimeout(() => {
        this.timers.delete(timerId);
        resolve();
      }, durationMs);
      this.timers.set(timerId, { executionId, reject });
    });
  }

  clearExecutionTimers(executionId) {
    for (const [timerId, timer] of this.timers.entries()) {
      if (timer.executionId !== executionId) continue;
      globalThis.clearTimeout(timerId);
      timer.reject?.(new Error("Director timer was cancelled."));
      this.timers.delete(timerId);
    }
  }

  async stopRunningBeat(sequenceId, beatId, scene = this.store.getActiveScene()) {
    for (const [key, runState] of this.activeRuns.entries()) {
      if (runState.sequenceId !== sequenceId || runState.beatId !== beatId) continue;
      runState.cancelled = true;
      this.clearExecutionTimers(runState.executionId);
      await this.log.append({ executionId: runState.executionId, sequenceId, beatId, status: RESULT_STATUS.CANCELLED, message: "Beat stop requested." }, scene);
      this.activeRuns.delete(key);
      return createResult(RESULT_STATUS.CANCELLED, "Beat stop requested.");
    }
    return createResult(RESULT_STATUS.SKIPPED, "No matching Beat is currently running on this client.");
  }

  async emergencyStop(scene = this.store.getActiveScene()) {
    for (const runState of this.activeRuns.values()) {
      runState.cancelled = true;
      this.clearExecutionTimers(runState.executionId);
      await this.authority.release(scene, runState.executionId);
    }
    this.activeRuns.clear();
    const adapterResults = await this.rollback.emergencyStop({ createdAt: nowStamp() });
    await this.log.append({ status: RESULT_STATUS.CANCELLED, message: "Emergency Stop requested.", details: { adapterResults } }, scene);
    Hooks.callAll(HOOKS.EMERGENCY_STOP, { adapterResults });
    return createResult(RESULT_STATUS.CANCELLED, "Emergency Stop cancelled Director timers and notified adapters.", { adapterResults });
  }
}

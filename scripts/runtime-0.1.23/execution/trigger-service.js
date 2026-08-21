import {
  FLAGS,
  HOOKS,
  MODULE_ID,
  RESULT_STATUS,
  SETTINGS,
  TRIGGER_ACTIONS,
  TRIGGER_EVENTS,
  moduleWarn
} from "../constants.js";
import { createResult } from "../state/schema.js";
import { getSetting } from "../settings.js";

const DEFAULT_DEBOUNCE_MS = 150;

function collectionValues(collection) {
  if (!collection) return [];
  if (Array.isArray(collection)) return collection;
  if (Array.isArray(collection.contents)) return collection.contents;
  if (typeof collection.values === "function") return Array.from(collection.values());
  return Object.values(collection);
}

function orderedBeats(sequence) {
  const byId = new Map((sequence?.beats ?? []).map((beat) => [beat.id, beat]));
  const ordered = (sequence?.beatIds ?? []).map((id) => byId.get(id)).filter(Boolean);
  const missing = (sequence?.beats ?? []).filter((beat) => !(sequence?.beatIds ?? []).includes(beat.id));
  return [...ordered, ...missing];
}

function sceneUuid(scene) {
  return scene?.uuid ?? (scene?.id ? `Scene.${scene.id}` : "");
}

function escapeHtml(value) {
  return globalThis.foundry?.utils?.escapeHTML?.(String(value ?? "")) ?? String(value ?? "");
}

function compareNumber(actual, expected, comparison = "gte") {
  if (!Number.isFinite(Number(actual)) || !Number.isFinite(Number(expected))) return false;
  const left = Number(actual);
  const right = Number(expected);
  switch (comparison) {
    case "gt":
      return left > right;
    case "lt":
      return left < right;
    case "lte":
      return left <= right;
    case "eq":
      return left === right;
    case "gte":
    default:
      return left >= right;
  }
}

function keyPart(value, fallback = "any") {
  const text = String(value ?? "").trim() || fallback;
  return text.replace(/[^a-zA-Z0-9_.-]+/g, "_");
}

function getDocumentUuid(document) {
  if (!document) return "";
  return document.uuid ?? (document.documentName && document.id ? `${document.documentName}.${document.id}` : "");
}

function getTokenDocument(source) {
  return source?.documentName === "Token" ? source : source?.token?.document ?? source?.token ?? source?.document ?? null;
}

function getActor(source, tokenDocument = null) {
  return source?.actor ?? tokenDocument?.actor ?? null;
}

function getDisposition(tokenDocument, combatant) {
  const value = tokenDocument?.disposition ?? combatant?.token?.disposition ?? combatant?.token?.document?.disposition;
  return [-1, 0, 1].includes(Number(value)) ? Number(value) : null;
}

function extractHp(actor, tokenDocument) {
  const candidates = [
    actor?.system?.attributes?.hp,
    actor?.system?.hp,
    actor?.system?.health,
    tokenDocument?.actor?.system?.attributes?.hp,
    tokenDocument?.actor?.system?.hp,
    tokenDocument?.actor?.system?.health
  ];

  for (const candidate of candidates) {
    const value = Number(candidate?.value);
    const max = Number(candidate?.max ?? candidate?.maximum);
    if (Number.isFinite(value)) return { value, max: Number.isFinite(max) && max > 0 ? max : null };
  }

  for (const barName of ["bar1", "bar2"]) {
    try {
      const bar = tokenDocument?.getBarAttribute?.(barName);
      const value = Number(bar?.value);
      const max = Number(bar?.max);
      if (Number.isFinite(value)) return { value, max: Number.isFinite(max) && max > 0 ? max : null };
    } catch (_error) {
      // Some systems throw for unconfigured bars. Try the next common bar.
    }
  }
  return null;
}

function subjectKey(subject) {
  return subject.tokenUuid || subject.actorUuid || subject.combatantId || "";
}

function uniqueSubjects(subjects) {
  const byKey = new Map();
  for (const subject of subjects) {
    const key = subjectKey(subject);
    if (!key || byKey.has(key)) continue;
    byKey.set(key, subject);
  }
  return Array.from(byKey.values());
}

function isEnabledSetting() {
  try {
    return Boolean(getSetting(SETTINGS.ENABLE_AUTOMATION_TRIGGERS));
  } catch (_error) {
    return true;
  }
}

export class TriggerService {
  constructor({ store, controller, log }) {
    this.store = store;
    this.controller = controller;
    this.log = log;
    this._hookRefs = [];
    this._timer = null;
    this._evaluating = false;
    this._pendingReason = "";
    this._pendingEvaluations = [];
  }

  start() {
    if (this._hookRefs.length) return;
    const schedule = (reason) => () => this.scheduleEvaluation(reason);
    const hookRefs = [
      ["createCombat", (combat) => this.handleCombatCreated(combat)],
      ["updateCombat", (combat, changed) => this.handleCombatUpdated(combat, changed)],
      ["deleteCombat", (combat) => this.handleCombatEnded(combat)],
      ["createCombatant", schedule("combatant-created")],
      ["updateCombatant", schedule("combatant-updated")],
      ["deleteCombatant", schedule("combatant-deleted")],
      ["updateActor", schedule("actor-updated")],
      ["updateToken", schedule("token-updated")],
      ["canvasReady", schedule("canvas-ready")],
      [HOOKS.SEQUENCES_CHANGED, schedule("sequences-changed")],
      [HOOKS.BEAT_FINISH, schedule("beat-finished")]
    ];
    for (const [hook, fn] of hookRefs) {
      Hooks.on(hook, fn);
      this._hookRefs.push([hook, fn]);
    }
    this.scheduleEvaluation("ready");
  }

  stop() {
    for (const [hook, fn] of this._hookRefs) Hooks.off(hook, fn);
    this._hookRefs = [];
    if (this._timer) globalThis.clearTimeout(this._timer);
    this._timer = null;
    this._pendingEvaluations = [];
  }

  scheduleEvaluation(reason = "unknown") {
    if (!game.user?.isGM || !isEnabledSetting()) return;
    if (this._timer) globalThis.clearTimeout(this._timer);
    this._timer = globalThis.setTimeout(() => {
      this._timer = null;
      void this.evaluate(reason).catch((error) => moduleWarn("Trigger evaluation failed.", error));
    }, DEFAULT_DEBOUNCE_MS);
  }

  handleCombatCreated(combat) {
    const events = [];
    const round = Number(combat?.round ?? 0) || 0;
    if (round === 1) events.push(TRIGGER_EVENTS.COMBAT_STARTED);
    if (round >= 1) events.push(TRIGGER_EVENTS.COMBAT_ROUND_STARTED);
    if (Number.isFinite(Number(combat?.turn)) && Number(combat.turn) >= 0) {
      events.push(TRIGGER_EVENTS.COMBAT_TURN_STARTED, TRIGGER_EVENTS.INITIATIVE_REACHED);
    }
    if (events.length) void this.runCombatEvents(combat, events, "combat-created").catch((error) => moduleWarn("Combat trigger evaluation failed.", error));
    this.scheduleEvaluation("combat-created");
  }

  handleCombatUpdated(combat, changed = {}) {
    const events = [];
    const hasRound = Object.prototype.hasOwnProperty.call(changed ?? {}, "round");
    const hasTurn = Object.prototype.hasOwnProperty.call(changed ?? {}, "turn");
    const round = Number(combat?.round ?? 0) || 0;
    if (hasRound && round === 1) events.push(TRIGGER_EVENTS.COMBAT_STARTED);
    if (hasRound && round >= 1) events.push(TRIGGER_EVENTS.COMBAT_ROUND_STARTED);
    if (hasTurn) events.push(TRIGGER_EVENTS.COMBAT_TURN_STARTED, TRIGGER_EVENTS.INITIATIVE_REACHED);
    if (events.length) {
      void this.runCombatEvents(combat, events, "combat-updated").catch((error) => moduleWarn("Combat trigger evaluation failed.", error));
    }
    this.scheduleEvaluation("combat-updated");
  }

  handleCombatEnded(combat) {
    void this.runCombatEvents(combat, [TRIGGER_EVENTS.COMBAT_ENDED], "combat-ended").catch((error) => moduleWarn("Combat trigger evaluation failed.", error));
  }

  async runCombatEvents(combat, events, reason) {
    if (!game.user?.isGM || !isEnabledSetting() || !this.isControllerClient()) return [];
    const scene = this.sceneForCombat(combat) ?? this.store.getActiveScene();
    const results = [];
    for (const event of events) {
      const context = this.buildCombatContext(combat, event, { reason, scene });
      results.push(...await this.evaluate(reason, scene, context));
    }
    return results;
  }

  sceneForCombat(combat) {
    if (combat?.scene) return combat.scene;
    const sceneId = combat?.sceneId ?? combat?.scene?._id;
    if (sceneId && game.scenes?.get) return game.scenes.get(sceneId);
    const sceneUuidValue = combat?.sceneUuid ?? combat?.scene?.uuid;
    if (sceneUuidValue && game.scenes) {
      return collectionValues(game.scenes).find((scene) => sceneUuid(scene) === sceneUuidValue) ?? null;
    }
    return null;
  }

  activeCombatant(combat) {
    const combatants = collectionValues(combat?.combatants);
    if (combat?.combatant) return combat.combatant;
    const currentId = combat?.current?.combatantId;
    if (currentId) {
      const match = combatants.find((combatant) => combatant?.id === currentId);
      if (match) return match;
    }
    const turn = Number(combat?.turn);
    return Number.isInteger(turn) && turn >= 0 ? combatants[turn] ?? null : null;
  }

  buildCombatContext(combat, event = "", extra = {}) {
    const scene = extra.scene ?? this.sceneForCombat(combat) ?? this.store.getActiveScene();
    const combatant = this.activeCombatant(combat);
    const tokenDocument = getTokenDocument(combatant);
    const actor = getActor(combatant, tokenDocument);
    const rawTurn = extra.turn ?? combat?.turn;
    const turn = Number(rawTurn);
    const turnIndex = Number.isInteger(turn) && turn >= 0 ? turn : null;
    const turnNumber = Number(extra.turnNumber ?? (turnIndex === null ? 0 : turnIndex + 1)) || 0;
    const initiative = Number(extra.initiative ?? combatant?.initiative);
    const round = Number(extra.round ?? combat?.round ?? 0) || 0;
    return {
      event,
      triggerEvent: event,
      reason: extra.reason ?? "",
      combatId: keyPart(extra.combatId ?? combat?.id ?? combat?._id ?? "combat"),
      combatUuid: getDocumentUuid(combat),
      round,
      turn: turnIndex,
      turnNumber,
      activeCombatantId: combatant?.id ?? "",
      activeCombatantUuid: getDocumentUuid(combatant),
      activeCombatantName: combatant?.name ?? tokenDocument?.name ?? actor?.name ?? "",
      tokenUuid: getDocumentUuid(tokenDocument),
      actorUuid: getDocumentUuid(actor),
      initiative: Number.isFinite(initiative) ? initiative : null,
      sceneId: scene?.id ?? "",
      sceneUuid: sceneUuid(scene),
      dryRun: Boolean(extra.dryRun),
      simulated: Boolean(extra.simulated)
    };
  }

  buildSimulatedCombatContext(event, options = {}, scene = this.store.getActiveScene()) {
    const combat = game.combat && this.combatMatchesScene(game.combat, scene) ? game.combat : null;
    const round = Number(options.round ?? (event === TRIGGER_EVENTS.COMBAT_STARTED || event === TRIGGER_EVENTS.COMBAT_ENDED ? 1 : combat?.round ?? 1)) || 1;
    const turnNumber = Number(options.turnNumber ?? options.turn ?? (Number.isInteger(Number(combat?.turn)) ? Number(combat.turn) + 1 : 1)) || 1;
    return {
      ...this.buildCombatContext(combat, event, {
        scene,
        round,
        turn: turnNumber - 1,
        turnNumber,
        initiative: options.initiative ?? this.activeCombatant(combat)?.initiative ?? 10,
        combatId: options.combatId ?? `simulation-${scene?.id ?? "scene"}`,
        reason: "combat-simulation",
        dryRun: true,
        simulated: true
      }),
      event,
      dryRun: true,
      simulated: true
    };
  }

  async simulateCombatEvent(event = TRIGGER_EVENTS.COMBAT_STARTED, options = {}, scene = this.store.getActiveScene()) {
    const selectedEvent = Object.values(TRIGGER_EVENTS).includes(event) ? event : TRIGGER_EVENTS.COMBAT_STARTED;
    const context = this.buildSimulatedCombatContext(selectedEvent, options, scene);
    return this.evaluate("combat-simulation", scene, context);
  }

  async evaluate(reason = "manual", scene = this.store.getActiveScene(), context = {}) {
    if (!game.user?.isGM || !isEnabledSetting() || !scene || !this.isControllerClient()) return [];
    if (this._evaluating) {
      this._pendingReason = reason;
      this._pendingEvaluations.push({ reason, scene, context });
      return [];
    }

    this._evaluating = true;
    try {
      const sequences = (await this.store.listSequences(scene, { includeArchived: false }))
        .filter((sequence) => sequence.enabled !== false)
        .filter((sequence) => !sequence.sceneUuid || sequence.sceneUuid === sceneUuid(scene));
      if (!sequences.length) return [];

      const tableState = this.buildTableState(scene, context);
      const triggerState = await this.getTriggerState(scene);
      const fired = [];

      for (const sequence of sequences) {
        for (const beat of orderedBeats(sequence)) {
          for (const trigger of beat.triggers ?? []) {
            if (!this.isArmed(trigger, sequence, beat, triggerState, tableState.context)) continue;
            if (!this.triggerMatches(trigger, tableState)) continue;
            const result = await this.fireTrigger({ scene, sequence, beat, trigger, reason, context: tableState.context });
            fired.push(result);
          }
        }
      }

      return fired;
    } finally {
      this._evaluating = false;
      const pending = this._pendingEvaluations.shift();
      if (pending) {
        this._pendingReason = "";
        void this.evaluate(pending.reason, pending.scene, pending.context).catch((error) => moduleWarn("Trigger evaluation failed.", error));
      } else if (this._pendingReason) {
        const pendingReason = this._pendingReason;
        this._pendingReason = "";
        this.scheduleEvaluation(pendingReason);
      }
    }
  }

  isControllerClient() {
    const activeGms = collectionValues(game.users)
      .filter((user) => user?.isGM && (user.active || user.id === game.user?.id))
      .sort((a, b) => String(a.id).localeCompare(String(b.id)));
    return !activeGms.length || activeGms[0]?.id === game.user?.id;
  }

  async getTriggerState(scene = this.store.getActiveScene()) {
    const raw = scene?.getFlag?.(MODULE_ID, FLAGS.TRIGGER_STATE);
    return {
      version: 1,
      fired: raw?.fired && typeof raw.fired === "object" ? { ...raw.fired } : {}
    };
  }

  async saveTriggerState(scene, state) {
    if (!scene?.setFlag || !game.user?.isGM) return;
    await scene.setFlag(MODULE_ID, FLAGS.TRIGGER_STATE, {
      version: 1,
      fired: state.fired ?? {}
    });
  }

  async resetStateForSequence(sequenceId, scene = this.store.getActiveScene()) {
    if (!sequenceId || !scene) return;
    const state = await this.getTriggerState(scene);
    for (const [key, entry] of Object.entries(state.fired)) {
      if (key.startsWith(`${sequenceId}:`) || entry?.sourceSequenceId === sequenceId || entry?.targetSequenceId === sequenceId) {
        delete state.fired[key];
      }
    }
    await this.saveTriggerState(scene, state);
  }

  triggerContextKey(trigger, context = {}) {
    if (!context?.combatId && !context?.combatUuid) return "";
    const combatId = keyPart(context.combatId || context.combatUuid, "combat");
    switch (trigger.event) {
      case TRIGGER_EVENTS.COMBAT_STARTED:
      case TRIGGER_EVENTS.COMBAT_ENDED:
        return `combat:${combatId}`;
      case TRIGGER_EVENTS.COMBAT_ROUND_STARTED:
        return `combat:${combatId}:round:${keyPart(context.round ?? trigger.round, trigger.round)}`;
      case TRIGGER_EVENTS.COMBAT_ROUND_AT_LEAST:
        return `combat:${combatId}:round-at-least:${keyPart(trigger.round, "round")}`;
      case TRIGGER_EVENTS.COMBAT_TURN_STARTED:
        return `combat:${combatId}:turn:${keyPart(trigger.turn, "turn")}`;
      case TRIGGER_EVENTS.INITIATIVE_REACHED:
        return `combat:${combatId}:initiative:${keyPart(trigger.initiative, "initiative")}`;
      default:
        return "";
    }
  }

  triggerKey(sequence, beat, trigger, context = {}) {
    const contextKey = this.triggerContextKey(trigger, context);
    return `${sequence.id}:${beat.id}:${trigger.id}${contextKey ? `:${contextKey}` : ""}`;
  }

  isArmed(trigger, sequence, beat, triggerState, context = {}) {
    if (trigger?.enabled === false) return false;
    const key = this.triggerKey(sequence, beat, trigger, context);
    const previous = triggerState.fired?.[key];
    if (trigger.once && previous) return false;
    if (!previous || trigger.once) return true;
    const firedAt = Date.parse(previous.firedAt ?? "");
    if (!Number.isFinite(firedAt)) return true;
    return Date.now() - firedAt >= Number(trigger.cooldownMs ?? 0);
  }

  buildTableState(scene, context = {}) {
    const combatants = this.combatantsForScene(scene).map((combatant) => this.subjectFromCombatant(combatant)).filter(Boolean);
    const tokens = this.tokenDocumentsForScene(scene).map((token) => this.subjectFromToken(token)).filter(Boolean);
    const activeCombat = game.combat && this.combatMatchesScene(game.combat, scene) ? game.combat : null;
    const activeContext = activeCombat ? this.buildCombatContext(activeCombat, context?.event ?? "", { scene }) : {};
    return {
      scene,
      round: Number(activeCombat?.round ?? 0) || 0,
      combatants,
      tokens,
      defeated: uniqueSubjects([...combatants, ...tokens].filter((subject) => subject.defeated)),
      context: {
        ...activeContext,
        ...(context ?? {})
      }
    };
  }

  combatantsForScene(scene) {
    const combats = uniqueSubjects([
      game.combat,
      ...collectionValues(game.combats)
    ].filter(Boolean).map((combat) => ({ tokenUuid: combat.id, combat }))).map((entry) => entry.combat);
    return combats
      .filter((combat) => this.combatMatchesScene(combat, scene))
      .flatMap((combat) => collectionValues(combat.combatants));
  }

  combatMatchesScene(combat, scene) {
    if (!combat || !scene) return false;
    const candidateIds = [combat.scene?.id, combat.sceneId, combat.scene?._id].filter(Boolean);
    const candidateUuids = [combat.scene?.uuid, combat.sceneUuid].filter(Boolean);
    if (candidateIds.includes(scene.id)) return true;
    if (candidateUuids.includes(sceneUuid(scene))) return true;
    return !candidateIds.length && !candidateUuids.length && combat === game.combat;
  }

  tokenDocumentsForScene(scene) {
    const docs = new Map();
    for (const token of collectionValues(scene?.tokens)) {
      const document = getTokenDocument(token);
      if (document) docs.set(getDocumentUuid(document) || document.id, document);
    }
    for (const token of canvas?.tokens?.placeables ?? []) {
      const document = getTokenDocument(token);
      if (document) docs.set(getDocumentUuid(document) || document.id, document);
    }
    return Array.from(docs.values());
  }

  subjectFromCombatant(combatant) {
    const tokenDocument = getTokenDocument(combatant);
    const actor = getActor(combatant, tokenDocument);
    const hp = extractHp(actor, tokenDocument);
    const defeated = Boolean(combatant?.defeated || combatant?.isDefeated || (hp && hp.value <= 0));
    return {
      combatantId: combatant?.id ?? "",
      tokenUuid: getDocumentUuid(tokenDocument),
      actorUuid: getDocumentUuid(actor),
      tokenDocument,
      actor,
      disposition: getDisposition(tokenDocument, combatant),
      hp,
      defeated
    };
  }

  subjectFromToken(tokenDocument) {
    const actor = getActor(tokenDocument, tokenDocument);
    const hp = extractHp(actor, tokenDocument);
    return {
      combatantId: "",
      tokenUuid: getDocumentUuid(tokenDocument),
      actorUuid: getDocumentUuid(actor),
      tokenDocument,
      actor,
      disposition: getDisposition(tokenDocument, null),
      hp,
      defeated: Boolean(hp && hp.value <= 0)
    };
  }

  triggerMatches(trigger, tableState) {
    const context = tableState.context ?? {};
    switch (trigger.event) {
      case TRIGGER_EVENTS.COMBAT_STARTED:
        return context.event === TRIGGER_EVENTS.COMBAT_STARTED;
      case TRIGGER_EVENTS.COMBAT_ROUND_STARTED:
        return context.event === TRIGGER_EVENTS.COMBAT_ROUND_STARTED && compareNumber(context.round, trigger.round, "eq");
      case TRIGGER_EVENTS.COMBAT_TURN_STARTED:
        return context.event === TRIGGER_EVENTS.COMBAT_TURN_STARTED && compareNumber(context.turnNumber, trigger.turn, "eq");
      case TRIGGER_EVENTS.INITIATIVE_REACHED:
        return context.event === TRIGGER_EVENTS.INITIATIVE_REACHED && compareNumber(context.initiative, trigger.initiative, trigger.comparison);
      case TRIGGER_EVENTS.COMBAT_ENDED:
        return context.event === TRIGGER_EVENTS.COMBAT_ENDED;
      case TRIGGER_EVENTS.ENEMY_DEFEATED_COUNT:
        return this.defeatedCountMatches(trigger, tableState, [-1]);
      case TRIGGER_EVENTS.COMBATANT_DEFEATED_COUNT:
        return this.defeatedCountMatches(trigger, tableState, []);
      case TRIGGER_EVENTS.ALLY_DEFEATED:
        return this.defeatedCountMatches(trigger, tableState, [1]);
      case TRIGGER_EVENTS.TOKEN_DEFEATED:
        return this.defeatedCountMatches(trigger, tableState, []);
      case TRIGGER_EVENTS.TOKEN_HP_AT_OR_BELOW:
        return this.hpThresholdMatches(trigger, tableState);
      case TRIGGER_EVENTS.COMBAT_ROUND_AT_LEAST:
        return compareNumber(tableState.round, trigger.round, trigger.comparison);
      default:
        return false;
    }
  }

  defeatedCountMatches(trigger, tableState, defaultDispositions) {
    const dispositions = trigger.dispositions?.length ? trigger.dispositions : defaultDispositions;
    const count = tableState.defeated.filter((subject) => this.subjectMatches(trigger, subject, dispositions)).length;
    return compareNumber(count, trigger.count, trigger.comparison);
  }

  hpThresholdMatches(trigger, tableState) {
    const subjects = uniqueSubjects([...tableState.combatants, ...tableState.tokens]);
    return subjects.some((subject) => {
      if (!subject.hp || !this.subjectMatches(trigger, subject, trigger.dispositions ?? [])) return false;
      const actual = trigger.thresholdType === "percent" && subject.hp.max
        ? (subject.hp.value / subject.hp.max) * 100
        : subject.hp.value;
      return compareNumber(actual, trigger.threshold, trigger.comparison);
    });
  }

  subjectMatches(trigger, subject, dispositions) {
    const tokenUuids = trigger.tokenUuids ?? [];
    const actorUuids = trigger.actorUuids ?? [];
    const wantsUuid = tokenUuids.length || actorUuids.length;
    const tokenMatches = tokenUuids.includes(subject.tokenUuid);
    const actorMatches = actorUuids.includes(subject.actorUuid);
    if (wantsUuid && !tokenMatches && !actorMatches) return false;
    if (dispositions?.length && !dispositions.includes(subject.disposition)) return false;
    return true;
  }

  async fireTrigger({ scene, sequence, beat, trigger, reason, context = {} }) {
    const target = await this.resolveTarget(scene, sequence, beat, trigger);
    if (!target) return createResult(RESULT_STATUS.WARNING, `Trigger target was not found: ${trigger.name}`);

    const payload = {
      sceneId: scene.id,
      sceneUuid: sceneUuid(scene),
      sequenceId: target.sequence.id,
      beatId: target.beat.id,
      sourceSequenceId: sequence.id,
      sourceBeatId: beat.id,
      trigger,
      reason,
      triggerContext: context,
      dryRun: Boolean(context?.dryRun)
    };
    Hooks.callAll(HOOKS.TRIGGER_FIRED, payload);

    if (context?.dryRun) {
      const preview = await this.controller.dryRunBeat(target.sequence.id, target.beat.id, scene, { triggerContext: context });
      const message = `Dry run trigger match: ${trigger.name} -> ${target.beat.name}`;
      const result = createResult(RESULT_STATUS.DRY_RUN, message, { ...payload, validation: preview });
      await this.log.append({
        sequenceId: target.sequence.id,
        beatId: target.beat.id,
        status: RESULT_STATUS.DRY_RUN,
        message,
        details: result.details
      }, scene);
      return result;
    }

    const state = await this.getTriggerState(scene);
    const key = this.triggerKey(sequence, beat, trigger, context);
    state.fired[key] = {
      firedAt: new Date().toISOString(),
      reason,
      triggerName: trigger.name,
      event: trigger.event,
      contextKey: this.triggerContextKey(trigger, context),
      sourceSequenceId: sequence.id,
      sourceBeatId: beat.id,
      targetSequenceId: target.sequence.id,
      targetBeatId: target.beat.id,
      combatId: context?.combatId ?? "",
      round: context?.round ?? null,
      turnNumber: context?.turnNumber ?? null,
      initiative: context?.initiative ?? null
    };
    await this.saveTriggerState(scene, state);

    const eventSuffix = context?.event ? ` (${context.event})` : "";
    const message = `Trigger fired: ${trigger.name}${eventSuffix} -> ${target.beat.name}`;
    await this.log.append({
      sequenceId: target.sequence.id,
      beatId: target.beat.id,
      status: RESULT_STATUS.SUCCESS,
      message,
      details: payload
    }, scene);

    if (trigger.action === TRIGGER_ACTIONS.SELECT_BEAT) {
      ui.notifications?.info(message);
      return createResult(RESULT_STATUS.SUCCESS, message, payload);
    }

    if (trigger.requiresConfirmation && !(await this.confirmTriggerRun(trigger, target))) {
      const cancelled = createResult(RESULT_STATUS.CANCELLED, `Trigger cancelled: ${trigger.name}`, payload);
      await this.log.append({ sequenceId: target.sequence.id, beatId: target.beat.id, status: cancelled.status, message: cancelled.message, details: payload }, scene);
      return cancelled;
    }

    const preview = await this.controller.dryRunBeat(target.sequence.id, target.beat.id, scene, { triggerContext: context });
    if (preview.status !== RESULT_STATUS.SUCCESS && !trigger.continueAfterValidationWarnings) {
      const warning = createResult(RESULT_STATUS.WARNING, `Trigger blocked by validation: ${preview.message}`, { trigger: payload, validation: preview });
      await this.log.append({ sequenceId: target.sequence.id, beatId: target.beat.id, status: warning.status, message: warning.message, details: warning.details }, scene);
      ui.notifications?.warn(warning.message);
      return warning;
    }

    return this.controller.runBeat(target.sequence.id, target.beat.id, {
      scene,
      continueAfterValidationWarnings: trigger.continueAfterValidationWarnings,
      triggerContext: context
    });
  }

  async resolveTarget(scene, sourceSequence, sourceBeat, trigger) {
    const sequences = await this.store.listSequences(scene, { includeArchived: false });
    const targetSequence = trigger.targetSequenceId
      ? sequences.find((sequence) => sequence.id === trigger.targetSequenceId)
      : sourceSequence;
    if (!targetSequence || targetSequence.enabled === false) return null;

    const beats = orderedBeats(targetSequence);
    const targetBeatId = trigger.action === TRIGGER_ACTIONS.START_SEQUENCE
      ? (targetSequence.startingBeatId || beats[0]?.id)
      : (trigger.targetBeatId || (targetSequence.id === sourceSequence.id ? sourceBeat.id : targetSequence.startingBeatId || beats[0]?.id));
    const targetBeat = beats.find((candidate) => candidate.id === targetBeatId);
    return targetBeat ? { sequence: targetSequence, beat: targetBeat } : null;
  }

  async confirmTriggerRun(trigger, target) {
    const content = `Trigger "${trigger.name}" wants to run "${target.beat.name}".`;
    if (globalThis.Dialog?.confirm) {
      return Dialog.confirm({
        title: "Run Triggered Beat",
        content: `<p>${escapeHtml(content)}</p>`,
        defaultYes: false
      });
    }
    return globalThis.confirm?.(`Run Triggered Beat\n\n${content}`) ?? false;
  }
}

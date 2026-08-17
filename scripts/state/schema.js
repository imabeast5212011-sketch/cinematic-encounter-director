import {
  DANGER_LEVELS,
  EXECUTION_MODES,
  FAILURE_POLICIES,
  MAX_DELAY_MS,
  MAX_NAME_LENGTH,
  MAX_TEXT_LENGTH,
  MODULE_ID,
  PROVIDERS,
  RESULT_STATUS,
  SCHEMA_VERSION
} from "../constants.js";

const BLOCKED_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export function nowStamp() {
  return new Date().toISOString();
}

export function makeId(prefix = "ced") {
  const random = globalThis.foundry?.utils?.randomID?.() ?? globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return `${prefix}-${String(random).replace(/[^A-Za-z0-9_-]/g, "")}`;
}

export function cloneData(value) {
  if (globalThis.foundry?.utils?.deepClone) return foundry.utils.deepClone(value);
  return JSON.parse(JSON.stringify(value ?? null));
}

export function safeString(value, maxLength = MAX_TEXT_LENGTH, fallback = "") {
  const text = typeof value === "string" ? value : String(value ?? "");
  return text.trim().slice(0, maxLength) || fallback;
}

export function safeNullableString(value, maxLength = MAX_TEXT_LENGTH) {
  if (value === null || value === undefined || value === "") return "";
  return safeString(value, maxLength);
}

export function safeBoolean(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

export function safeNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

export function safeInteger(value, min, max, fallback) {
  return Math.round(safeNumber(value, min, max, fallback));
}

export function enumValue(value, allowed, fallback) {
  return Object.values(allowed).includes(value) ? value : fallback;
}

export function cleanseObject(value, depth = 0) {
  if (depth > 20) return {};
  if (Array.isArray(value)) return value.map((entry) => cleanseObject(entry, depth + 1));
  if (!value || typeof value !== "object") return value;
  const output = {};
  for (const [key, entry] of Object.entries(value)) {
    if (BLOCKED_KEYS.has(key)) continue;
    output[safeString(key, 120)] = cleanseObject(entry, depth + 1);
  }
  return output;
}

export function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

export function normalizeMetadata(raw = {}, userId = game.user?.id ?? "") {
  const createdAt = safeString(raw.createdAt, 64, nowStamp());
  return {
    createdAt,
    createdBy: safeString(raw.createdBy, 80, userId),
    modifiedAt: safeString(raw.modifiedAt, 64, createdAt),
    modifiedBy: safeString(raw.modifiedBy, 80, userId)
  };
}

export function touchMetadata(entity, userId = game.user?.id ?? "") {
  entity.modifiedAt = nowStamp();
  entity.modifiedBy = safeString(userId, 80);
  return entity;
}

export function normalizeAction(raw = {}, index = 0) {
  const metadata = normalizeMetadata(raw);
  const adapter = safeString(raw.adapter, 80, PROVIDERS.FOUNDRY);
  const type = safeString(raw.type, 120, "native.note");
  const failurePolicy = enumValue(raw.failurePolicy, FAILURE_POLICIES, FAILURE_POLICIES.STOP);
  const delayAfterMs = safeInteger(raw.delayAfterMs ?? raw.delayMs, 0, MAX_DELAY_MS, 0);
  const executionMode = enumValue(raw.executionMode, EXECUTION_MODES, EXECUTION_MODES.SEQUENTIAL);
  const lastValidation = normalizeResult(raw.lastValidation);
  const lastResult = normalizeResult(raw.lastResult);

  return {
    id: safeString(raw.id, 80, makeId("action")),
    type,
    name: safeString(raw.name, MAX_NAME_LENGTH, type),
    enabled: raw.enabled !== false,
    adapter,
    config: cleanseObject(raw.config ?? {}),
    order: safeInteger(raw.order, 0, 10000, index),
    executionMode,
    parallelGroup: safeNullableString(raw.parallelGroup, 80),
    failurePolicy,
    precondition: cleanseObject(raw.precondition ?? {}),
    delayAfterMs,
    requiresConfirmation: safeBoolean(raw.requiresConfirmation, false),
    lastValidation,
    lastResult,
    rollbackSupported: safeBoolean(raw.rollbackSupported, false),
    rollbackSnapshotRef: safeNullableString(raw.rollbackSnapshotRef, 120),
    ...metadata
  };
}

export function normalizeBeat(raw = {}, index = 0) {
  const actions = safeArray(raw.actions).map((action, actionIndex) => normalizeAction(action, actionIndex));
  const actionIds = safeArray(raw.actionIds).map((id) => safeString(id, 80)).filter(Boolean);
  const orderedActionIds = actionIds.length ? actionIds : actions.map((action) => action.id);
  const metadata = normalizeMetadata(raw);

  return {
    id: safeString(raw.id, 80, makeId("beat")),
    name: safeString(raw.name, MAX_NAME_LENGTH, `Beat ${index + 1}`),
    description: safeNullableString(raw.description),
    actionIds: orderedActionIds.filter((id, position, ids) => ids.indexOf(id) === position),
    actions,
    manualState: safeString(raw.manualState, 80, "notRun"),
    color: safeNullableString(raw.color, 40),
    icon: safeNullableString(raw.icon, 120),
    gmNotes: safeNullableString(raw.gmNotes),
    requiresConfirmation: safeBoolean(raw.requiresConfirmation, false),
    stopPointAfter: safeBoolean(raw.stopPointAfter, false),
    continueOnActionFailure: safeBoolean(raw.continueOnActionFailure, false),
    dangerLevel: enumValue(raw.dangerLevel, DANGER_LEVELS, DANGER_LEVELS.SAFE),
    ...metadata
  };
}

export function normalizeSequence(raw = {}, index = 0, sceneUuid = "") {
  const beats = safeArray(raw.beats).map((beat, beatIndex) => normalizeBeat(beat, beatIndex));
  const beatIds = safeArray(raw.beatIds).map((id) => safeString(id, 80)).filter(Boolean);
  const orderedBeatIds = beatIds.length ? beatIds : beats.map((beat) => beat.id);
  const metadata = normalizeMetadata(raw);

  return {
    id: safeString(raw.id, 80, makeId("sequence")),
    schemaVersion: SCHEMA_VERSION,
    name: safeString(raw.name, MAX_NAME_LENGTH, `Sequence ${index + 1}`),
    description: safeNullableString(raw.description),
    sceneUuid: safeString(raw.sceneUuid, 160, sceneUuid),
    startingBeatId: safeNullableString(raw.startingBeatId, 80),
    beatIds: orderedBeatIds.filter((id, position, ids) => ids.indexOf(id) === position),
    beats,
    version: safeInteger(raw.version, 1, 999999, 1),
    tags: safeArray(raw.tags).map((tag) => safeString(tag, 40)).filter(Boolean).slice(0, 25),
    gmNotes: safeNullableString(raw.gmNotes),
    enabled: raw.enabled !== false,
    archived: safeBoolean(raw.archived, false),
    ...metadata
  };
}

export function normalizeSceneData(raw = {}, sceneUuid = "") {
  if (raw?.schemaVersion && Number(raw.schemaVersion) > SCHEMA_VERSION) {
    return {
      schemaVersion: Number(raw.schemaVersion),
      unsupportedFutureVersion: true,
      sequences: []
    };
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    sequences: safeArray(raw?.sequences).map((sequence, index) => normalizeSequence(sequence, index, sceneUuid))
  };
}

export function normalizeResult(raw = null) {
  if (!raw || typeof raw !== "object") return null;
  return {
    status: enumValue(raw.status, RESULT_STATUS, RESULT_STATUS.WARNING),
    message: safeString(raw.message, 1000),
    details: cleanseObject(raw.details ?? {}),
    executionId: safeNullableString(raw.executionId, 120),
    actionId: safeNullableString(raw.actionId, 120),
    createdAt: safeString(raw.createdAt, 64, nowStamp())
  };
}

export function createResult(status, message, details = {}) {
  return {
    status,
    message: safeString(message, 1000),
    details: cleanseObject(details),
    createdAt: nowStamp()
  };
}

export function createSequence(sceneUuid = "") {
  const stamp = nowStamp();
  return normalizeSequence({
    id: makeId("sequence"),
    name: "New Sequence",
    description: "",
    sceneUuid,
    beatIds: [],
    beats: [],
    version: 1,
    enabled: true,
    archived: false,
    createdAt: stamp,
    modifiedAt: stamp,
    createdBy: game.user?.id ?? "",
    modifiedBy: game.user?.id ?? ""
  }, 0, sceneUuid);
}

export function createBeat(index = 0) {
  const stamp = nowStamp();
  return normalizeBeat({
    id: makeId("beat"),
    name: `Beat ${index + 1}`,
    actionIds: [],
    actions: [],
    dangerLevel: DANGER_LEVELS.SAFE,
    createdAt: stamp,
    modifiedAt: stamp,
    createdBy: game.user?.id ?? "",
    modifiedBy: game.user?.id ?? ""
  }, index);
}

export function createAction(actionType = "native.note", adapter = PROVIDERS.FOUNDRY, index = 0) {
  const stamp = nowStamp();
  return normalizeAction({
    id: makeId("action"),
    type: actionType,
    name: actionType,
    adapter,
    order: index,
    config: {},
    createdAt: stamp,
    modifiedAt: stamp,
    createdBy: game.user?.id ?? "",
    modifiedBy: game.user?.id ?? ""
  }, index);
}

export function assertGm() {
  if (!game.user?.isGM) throw new Error("Only a GM may use Cinematic Encounter Director controls.");
}

export function assertModuleEnabled() {
  if (game.settings && !game.settings.get(MODULE_ID, "enabled")) {
    throw new Error("Cinematic Encounter Director is disabled in world settings.");
  }
}

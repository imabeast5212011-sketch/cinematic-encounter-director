import {
  DANGER_LEVELS,
  EXECUTION_MODES,
  FAILURE_POLICIES,
  MAX_DELAY_MS,
  MAX_IMPORT_BYTES,
  MAX_NAME_LENGTH,
  MAX_TEXT_LENGTH,
  MODULE_ID,
  PROVIDERS,
  SCHEMA_VERSION,
  TRIGGER_ACTIONS,
  TRIGGER_EVENTS
} from "../constants.js";
import { INTEGRATION_ACTION_TYPES } from "../actions/integration-actions.js";
import { NATIVE_ACTION_TYPES } from "../actions/native-actions.js";

const BUILTIN_ACTION_TYPES = [...NATIVE_ACTION_TYPES, ...INTEGRATION_ACTION_TYPES];
const ACTION_TYPE_IDS = BUILTIN_ACTION_TYPES.map((entry) => entry.id);

function clone(value) {
  if (globalThis.structuredClone) return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function actionCatalogEntry(entry) {
  return {
    id: entry.id,
    provider: entry.provider,
    label: entry.label,
    description: entry.description ?? "",
    dangerLevel: entry.dangerLevel ?? DANGER_LEVELS.SAFE,
    rollbackSupported: Boolean(entry.rollbackSupported),
    defaultConfig: clone(entry.defaultConfig ?? {}),
    available: entry.available !== false,
    automated: Boolean(entry.automated),
    manualCue: Boolean(entry.manualCue),
    providerStatus: entry.providerStatus ?? ""
  };
}

const metadataProperties = {
  createdAt: { type: "string" },
  createdBy: { type: "string" },
  modifiedAt: { type: "string" },
  modifiedBy: { type: "string" }
};

const resultSchema = {
  type: ["object", "null"],
  additionalProperties: true,
  properties: {
    status: { type: "string" },
    message: { type: "string" },
    details: { type: "object", additionalProperties: true },
    executionId: { type: "string" },
    actionId: { type: "string" },
    createdAt: { type: "string" }
  }
};

const actionSchema = {
  type: "object",
  additionalProperties: true,
  required: ["id", "type", "adapter", "name", "config"],
  properties: {
    id: { type: "string", minLength: 1, maxLength: 80 },
    type: { type: "string", minLength: 1, examples: ACTION_TYPE_IDS },
    name: { type: "string", minLength: 1, maxLength: MAX_NAME_LENGTH },
    enabled: { type: "boolean", default: true },
    adapter: { type: "string", minLength: 1, examples: Object.values(PROVIDERS) },
    config: { type: "object", additionalProperties: true, default: {} },
    order: { type: "integer", minimum: 0, maximum: 10000 },
    executionMode: { type: "string", enum: Object.values(EXECUTION_MODES), default: EXECUTION_MODES.SEQUENTIAL },
    parallelGroup: { type: "string", maxLength: 80 },
    failurePolicy: { type: "string", enum: Object.values(FAILURE_POLICIES), default: FAILURE_POLICIES.STOP },
    precondition: { type: "object", additionalProperties: true },
    delayAfterMs: { type: "integer", minimum: 0, maximum: MAX_DELAY_MS },
    requiresConfirmation: { type: "boolean", default: false },
    rollbackSupported: { type: "boolean", default: false },
    rollbackSnapshotRef: { type: "string", maxLength: 120 },
    lastValidation: resultSchema,
    lastResult: resultSchema,
    ...metadataProperties
  }
};

const triggerSchema = {
  type: "object",
  additionalProperties: true,
  required: ["id", "event", "action"],
  properties: {
    id: { type: "string", minLength: 1, maxLength: 80 },
    name: { type: "string", minLength: 1, maxLength: MAX_NAME_LENGTH },
    enabled: { type: "boolean", default: true },
    event: { type: "string", enum: Object.values(TRIGGER_EVENTS) },
    action: { type: "string", enum: Object.values(TRIGGER_ACTIONS) },
    targetSequenceId: { type: "string", maxLength: 80 },
    targetBeatId: { type: "string", maxLength: 80 },
    count: { type: "integer", minimum: 1, maximum: 999 },
    round: { type: "integer", minimum: 1, maximum: 999 },
    turn: { type: "integer", minimum: 1, maximum: 999 },
    initiative: { type: "number", minimum: -999999, maximum: 999999 },
    threshold: { type: "number", minimum: -999999, maximum: 999999 },
    thresholdType: { type: "string", enum: ["hp", "percent"] },
    comparison: { type: "string", enum: ["gte", "lte", "gt", "lt", "eq"] },
    tokenUuids: { type: "array", items: { type: "string" } },
    actorUuids: { type: "array", items: { type: "string" } },
    dispositions: { type: "array", items: { type: "integer", enum: [-1, 0, 1] } },
    once: { type: "boolean", default: true },
    cooldownMs: { type: "integer", minimum: 0, maximum: 3600000 },
    requiresConfirmation: { type: "boolean" },
    continueAfterValidationWarnings: { type: "boolean", default: false }
  }
};

const beatSchema = {
  type: "object",
  additionalProperties: true,
  required: ["id", "name", "actionIds", "actions"],
  properties: {
    id: { type: "string", minLength: 1, maxLength: 80 },
    name: { type: "string", minLength: 1, maxLength: MAX_NAME_LENGTH },
    description: { type: "string", maxLength: MAX_TEXT_LENGTH },
    actionIds: { type: "array", items: { type: "string", maxLength: 80 } },
    actions: { type: "array", items: actionSchema },
    triggers: { type: "array", items: triggerSchema },
    manualState: { type: "string", default: "notRun" },
    color: { type: "string", maxLength: 40 },
    icon: { type: "string", maxLength: 120 },
    gmNotes: { type: "string", maxLength: MAX_TEXT_LENGTH },
    requiresConfirmation: { type: "boolean", default: false },
    stopPointAfter: { type: "boolean", default: false },
    continueOnActionFailure: { type: "boolean", default: false },
    dangerLevel: { type: "string", enum: Object.values(DANGER_LEVELS), default: DANGER_LEVELS.SAFE },
    ...metadataProperties
  }
};

const sequenceSchema = {
  type: "object",
  additionalProperties: true,
  required: ["id", "name", "beatIds", "beats"],
  properties: {
    id: { type: "string", minLength: 1, maxLength: 80 },
    schemaVersion: { type: "integer", const: SCHEMA_VERSION },
    name: { type: "string", minLength: 1, maxLength: MAX_NAME_LENGTH },
    description: { type: "string", maxLength: MAX_TEXT_LENGTH },
    sceneUuid: { type: "string", maxLength: 160 },
    startingBeatId: { type: "string", maxLength: 80 },
    beatIds: { type: "array", items: { type: "string", maxLength: 80 } },
    beats: { type: "array", items: beatSchema },
    version: { type: "integer", minimum: 1, maximum: 999999 },
    tags: { type: "array", maxItems: 25, items: { type: "string", maxLength: 40 } },
    gmNotes: { type: "string", maxLength: MAX_TEXT_LENGTH },
    enabled: { type: "boolean", default: true },
    archived: { type: "boolean", default: false },
    ...metadataProperties
  }
};

const examplePackage = {
  moduleId: MODULE_ID,
  schemaVersion: SCHEMA_VERSION,
  scope: "single-sequence",
  sequences: [
    {
      id: "sequence-example-ambush",
      name: "Example Ambush",
      description: "A simple imported encounter plan.",
      sceneUuid: "",
      startingBeatId: "beat-reveal",
      beatIds: ["beat-reveal", "beat-reinforcements"],
      beats: [
        {
          id: "beat-reveal",
          name: "Reveal the Ambush",
          description: "Announce the ambush and create combat.",
          actionIds: ["action-ambush-note", "action-create-combat"],
          actions: [
            {
              id: "action-ambush-note",
              type: "native.chatMessage",
              adapter: PROVIDERS.FOUNDRY,
              name: "Ambush cue",
              enabled: true,
              config: { message: "The ambushers spring from cover.", whisperGmOnly: true },
              order: 0,
              executionMode: EXECUTION_MODES.SEQUENTIAL,
              failurePolicy: FAILURE_POLICIES.STOP
            },
            {
              id: "action-create-combat",
              type: "native.createCombat",
              adapter: PROVIDERS.FOUNDRY,
              name: "Create Combat",
              enabled: true,
              config: { sceneUuid: "" },
              order: 1,
              executionMode: EXECUTION_MODES.SEQUENTIAL,
              failurePolicy: FAILURE_POLICIES.STOP
            }
          ],
          triggers: [
            {
              id: "trigger-two-enemies-down",
              name: "Two enemies defeated",
              enabled: true,
              event: TRIGGER_EVENTS.ENEMY_DEFEATED_COUNT,
              action: TRIGGER_ACTIONS.RUN_BEAT,
              targetBeatId: "beat-reinforcements",
              count: 2,
              once: true,
              cooldownMs: 10000,
              requiresConfirmation: true
            },
            {
              id: "trigger-round-two",
              name: "Round two escalation",
              enabled: true,
              event: TRIGGER_EVENTS.COMBAT_ROUND_STARTED,
              action: TRIGGER_ACTIONS.SELECT_BEAT,
              targetBeatId: "beat-reinforcements",
              round: 2,
              once: true,
              cooldownMs: 0,
              requiresConfirmation: false
            }
          ],
          dangerLevel: DANGER_LEVELS.CHANGES_COMBAT
        },
        {
          id: "beat-reinforcements",
          name: "Reinforcements Arrive",
          actionIds: ["action-reinforcement-note"],
          actions: [
            {
              id: "action-reinforcement-note",
              type: "native.chatMessage",
              adapter: PROVIDERS.FOUNDRY,
              name: "Reinforcement cue",
              enabled: true,
              config: { message: "More enemies arrive.", whisperGmOnly: true },
              order: 0,
              executionMode: EXECUTION_MODES.SEQUENTIAL,
              failurePolicy: FAILURE_POLICIES.STOP
            }
          ],
          triggers: [],
          dangerLevel: DANGER_LEVELS.SAFE
        }
      ],
      tags: ["ai-authored", "combat"],
      enabled: true,
      archived: false
    }
  ],
  referenceMetadata: []
};

export const ENCOUNTER_PACKAGE_SCHEMA = Object.freeze({
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: `https://github.com/imabeast5212011-sketch/${MODULE_ID}/schemas/encounter-package.schema.json`,
  title: "Cinematic Encounter Director Encounter Package",
  type: "object",
  additionalProperties: true,
  required: ["moduleId", "schemaVersion", "sequences"],
  properties: {
    moduleId: { type: "string", const: MODULE_ID },
    schemaVersion: { type: "integer", const: SCHEMA_VERSION },
    exportedAt: { type: "string" },
    scope: { type: "string", enum: ["single-sequence", "scene-sequences", "ai-generated"] },
    sequences: { type: "array", minItems: 1, items: sequenceSchema },
    referenceMetadata: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: true,
        properties: {
          sequenceId: { type: "string" },
          path: { type: "string" },
          value: { type: "string" }
        }
      }
    }
  },
  $defs: {
    sequence: sequenceSchema,
    beat: beatSchema,
    action: actionSchema,
    trigger: triggerSchema,
    result: resultSchema
  }
});

export function getEncounterPackageSchema() {
  return clone(ENCOUNTER_PACKAGE_SCHEMA);
}

export function getAiAuthoringGuide(actionTypes = BUILTIN_ACTION_TYPES) {
  const catalog = (actionTypes.length ? actionTypes : BUILTIN_ACTION_TYPES).map(actionCatalogEntry);
  return {
    moduleId: MODULE_ID,
    schemaVersion: SCHEMA_VERSION,
    maxImportBytes: MAX_IMPORT_BYTES,
    forbiddenFieldNames: ["script", "macro", "command", "code", "function", "handler", "callback"],
    forbiddenStringPatterns: ["Windows absolute paths such as C:\\\\path\\\\file"],
    authoringRules: [
      "Return JSON only when asked to produce an import package.",
      "Use stable ids and make beatIds/actionIds match the objects they order.",
      "Do not invent Scene, Token, Actor, Playlist, or external ids unless the GM supplied them.",
      "Use GM notes or chat notes when a reference must be remapped in Foundry.",
      "Use combatStarted, combatRoundStarted, combatTurnStarted, initiativeReached, and combatEnded triggers for initiative-flow automation.",
      "Round triggers should set round to 1 or higher and once true unless the GM explicitly wants repeats.",
      "Imported data never executes immediately; the GM must import, review, validate, and run it."
    ],
    publicApi: {
      getJsonSchema: "Returns the encounter package JSON schema.",
      getEncounterAuthoringContext: "Returns this guide plus the runtime action catalog.",
      exportEncounterJson: "Returns a Sequence or Scene encounter package object.",
      validateEncounterJson: "Parses and normalizes an encounter package without saving it.",
      importEncounterJson: "Imports a package into the current Scene, duplicate mode by default.",
      upsertSequence: "Creates or replaces one Sequence object by id.",
      evaluateTriggers: "Evaluates trigger conditions against the current Scene.",
      simulateCombatTrigger: "Dry-runs combat trigger matching with event, round, turnNumber, and initiative context."
    },
    triggerEvents: Object.values(TRIGGER_EVENTS),
    triggerActions: Object.values(TRIGGER_ACTIONS),
    providers: Object.values(PROVIDERS),
    actionTypes: catalog,
    schema: getEncounterPackageSchema(),
    examplePackage: clone(examplePackage)
  };
}

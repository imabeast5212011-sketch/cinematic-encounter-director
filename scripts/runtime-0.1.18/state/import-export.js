import { MAX_IMPORT_BYTES, MODULE_ID, SCHEMA_VERSION } from "../constants.js";
import { cloneData, makeId, normalizeSceneData, normalizeSequence, normalizeTrigger, safeString, touchMetadata } from "./schema.js";

const WINDOWS_ABSOLUTE_PATH = /[A-Za-z]:\\/;
const EXECUTABLE_FIELD_NAMES = new Set(["script", "macro", "command", "code", "function", "handler", "callback"]);

function walk(value, visitor, path = []) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => walk(entry, visitor, [...path, String(index)]));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, entry] of Object.entries(value)) {
    visitor(key, entry, path);
    walk(entry, visitor, [...path, key]);
  }
}

function collectReferenceMetadata(sequence) {
  const references = [];
  walk(sequence, (key, value, path) => {
    if (key.toLocaleLowerCase().endsWith("uuid") || key.toLocaleLowerCase().endsWith("uuids")) {
      if (typeof value === "string") references.push({ path: [...path, key].join("."), value });
      if (Array.isArray(value)) {
        for (const entry of value) references.push({ path: [...path, key].join("."), value: entry });
      }
    }
  });
  return references.filter((entry) => typeof entry.value === "string" && entry.value.includes("."));
}

function assertNoExecutableFields(value) {
  const violations = [];
  walk(value, (key, entry, path) => {
    if (EXECUTABLE_FIELD_NAMES.has(key.toLocaleLowerCase())) violations.push([...path, key].join("."));
    if (typeof entry === "string" && WINDOWS_ABSOLUTE_PATH.test(entry)) violations.push([...path, key].join("."));
  });
  if (violations.length) throw new Error(`Import/export contains forbidden fields or absolute paths: ${violations.slice(0, 10).join(", ")}`);
}

function makePackage(sequences, scope) {
  const normalized = sequences.map((sequence, index) => normalizeSequence(sequence, index, sequence.sceneUuid));
  const payload = {
    moduleId: MODULE_ID,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    scope,
    sequences: normalized,
    referenceMetadata: normalized.flatMap((sequence) => collectReferenceMetadata(sequence).map((reference) => ({
      sequenceId: sequence.id,
      ...reference
    })))
  };
  assertNoExecutableFields(payload);
  return payload;
}

export class ImportExportService {
  constructor(store) {
    this.store = store;
  }

  async buildSequencePackage(sequenceId, scene = this.store.getActiveScene()) {
    const sequence = await this.store.getSequence(sequenceId, scene);
    if (!sequence) throw new Error("Sequence was not found.");
    return makePackage([sequence], "single-sequence");
  }

  async buildScenePackage(scene = this.store.getActiveScene()) {
    const sequences = await this.store.listSequences(scene, { includeArchived: true });
    return makePackage(sequences, "scene-sequences");
  }

  async downloadPackage(payload, filename = "cinematic-encounter-director-export.json") {
    assertNoExecutableFields(payload);
    const data = JSON.stringify(payload, null, 2);
    if (globalThis.saveDataToFile) {
      saveDataToFile(data, "application/json", filename);
      return;
    }
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  parseJson(text) {
    const source = safeString(text, MAX_IMPORT_BYTES + 1);
    if (source.length > MAX_IMPORT_BYTES) throw new Error("Import JSON is too large.");
    const parsed = JSON.parse(source);
    assertNoExecutableFields(parsed);
    if (parsed.moduleId !== MODULE_ID) throw new Error("Import JSON was not created by Cinematic Encounter Director.");
    if (Number(parsed.schemaVersion) > SCHEMA_VERSION) throw new Error("Import JSON uses a future schema version and cannot be safely executed.");
    if (!Array.isArray(parsed.sequences)) throw new Error("Import JSON does not contain a sequences array.");
    return {
      ...parsed,
      sequences: parsed.sequences.map((sequence, index) => normalizeSequence(sequence, index, sequence.sceneUuid ?? ""))
    };
  }

  async readFile(file) {
    if (!file) throw new Error("No import file was selected.");
    if (file.size > MAX_IMPORT_BYTES) throw new Error("Import file is too large.");
    if (globalThis.readTextFromFile) return readTextFromFile(file);
    return file.text();
  }

  async importText(text, { scene = this.store.getActiveScene(), mode = "duplicate" } = {}) {
    const payload = this.parseJson(text);
    const data = await this.store.getSceneData(scene);
    const imported = [];
    for (const sequence of payload.sequences) {
      const copy = cloneData(sequence);
      if (mode === "replace") {
        const existingIndex = data.sequences.findIndex((entry) => entry.id === copy.id);
        if (existingIndex >= 0) {
          data.sequences[existingIndex] = normalizeSequence(touchMetadata(copy), existingIndex, scene.uuid);
          imported.push(data.sequences[existingIndex]);
          continue;
        }
      }
      copy.id = makeId("sequence");
      copy.name = `${copy.name} Imported`;
      copy.sceneUuid = scene.uuid;
      copy.beats = copy.beats.map((beat) => {
        const beatCopy = cloneData(beat);
        beatCopy.id = makeId("beat");
        beatCopy.triggers = (Array.isArray(beatCopy.triggers) ? beatCopy.triggers : []).map((trigger, triggerIndex) => normalizeTrigger({
          ...trigger,
          id: makeId("trigger")
        }, triggerIndex));
        beatCopy.actions = beatCopy.actions.map((action) => ({ ...action, id: makeId("action"), lastResult: null, lastValidation: null, rollbackSnapshotRef: "" }));
        beatCopy.actionIds = beatCopy.actions.map((action) => action.id);
        return beatCopy;
      });
      copy.beatIds = copy.beats.map((beat) => beat.id);
      const normalized = normalizeSequence(touchMetadata(copy), data.sequences.length, scene.uuid);
      data.sequences.push(normalized);
      imported.push(normalized);
    }
    await this.store.saveSceneData(scene, normalizeSceneData(data, scene.uuid));
    return { imported, referenceMetadata: payload.referenceMetadata ?? [] };
  }
}

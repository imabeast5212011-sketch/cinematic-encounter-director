import { FLAGS, HOOKS, MODULE_ID } from "../constants.js";
import {
  assertGm,
  cloneData,
  createAction,
  createBeat,
  createSequence,
  makeId,
  normalizeBeat,
  normalizeSceneData,
  normalizeSequence,
  touchMetadata
} from "./schema.js";

function activeScene() {
  return canvas?.scene ?? game.scenes?.viewed ?? game.scenes?.active ?? game.scenes?.current ?? null;
}

async function sceneUuid(scene) {
  if (!scene) return "";
  return scene.uuid ?? `Scene.${scene.id}`;
}

function sortedBeats(sequence) {
  const byId = new Map(sequence.beats.map((beat) => [beat.id, beat]));
  const ordered = sequence.beatIds.map((id) => byId.get(id)).filter(Boolean);
  const missing = sequence.beats.filter((beat) => !sequence.beatIds.includes(beat.id));
  return [...ordered, ...missing];
}

function sortedActions(beat) {
  const byId = new Map(beat.actions.map((action) => [action.id, action]));
  const ordered = beat.actionIds.map((id) => byId.get(id)).filter(Boolean);
  const missing = beat.actions.filter((action) => !beat.actionIds.includes(action.id));
  return [...ordered, ...missing];
}

function findSequence(data, sequenceId) {
  return data.sequences.find((sequence) => sequence.id === sequenceId);
}

function findBeat(sequence, beatId) {
  return sequence?.beats.find((beat) => beat.id === beatId);
}

function findAction(beat, actionId) {
  return beat?.actions.find((action) => action.id === actionId);
}

function reindexBeatActions(beat) {
  beat.actions = sortedActions(beat).map((action, index) => ({ ...action, order: index }));
  beat.actionIds = beat.actions.map((action) => action.id);
}

function reindexSequenceBeats(sequence) {
  sequence.beats = sortedBeats(sequence);
  sequence.beatIds = sequence.beats.map((beat) => beat.id);
}

function duplicateActionWithNewId(action, index) {
  const duplicated = cloneData(action);
  duplicated.id = makeId("action");
  duplicated.name = `${action.name} Copy`;
  duplicated.order = index;
  duplicated.lastValidation = null;
  duplicated.lastResult = null;
  duplicated.rollbackSnapshotRef = "";
  return duplicated;
}

function duplicateBeatWithNewIds(beat, index) {
  const duplicated = cloneData(beat);
  duplicated.id = makeId("beat");
  duplicated.name = `${beat.name} Copy`;
  duplicated.actions = sortedActions(beat).map((action, actionIndex) => duplicateActionWithNewId(action, actionIndex));
  duplicated.actionIds = duplicated.actions.map((action) => action.id);
  return normalizeBeat(duplicated, index);
}

function duplicateSequenceWithNewIds(sequence, sceneUuidValue) {
  const duplicated = cloneData(sequence);
  duplicated.id = makeId("sequence");
  duplicated.name = `${sequence.name} Copy`;
  duplicated.beats = sortedBeats(sequence).map((beat, beatIndex) => duplicateBeatWithNewIds(beat, beatIndex));
  duplicated.beatIds = duplicated.beats.map((beat) => beat.id);
  duplicated.sceneUuid = sceneUuidValue;
  return normalizeSequence(duplicated, 0, sceneUuidValue);
}

export class SequenceStore {
  constructor() {
    this._cache = new WeakMap();
  }

  getActiveScene() {
    return activeScene();
  }

  async getSceneData(scene = this.getActiveScene()) {
    if (!scene) return normalizeSceneData({}, "");
    const uuid = await sceneUuid(scene);
    const raw = scene.getFlag?.(MODULE_ID, FLAGS.SCENE_SEQUENCES) ?? {};
    const normalized = normalizeSceneData(raw, uuid);
    this._cache.set(scene, cloneData(normalized));
    return normalized;
  }

  async saveSceneData(scene, data) {
    assertGm();
    if (!scene) throw new Error("No Scene is available for Sequence storage.");
    const uuid = await sceneUuid(scene);
    const normalized = normalizeSceneData(data, uuid);
    await scene.setFlag(MODULE_ID, FLAGS.SCENE_SEQUENCES, normalized);
    Hooks.callAll(HOOKS.SEQUENCES_CHANGED, { sceneId: scene.id, sceneUuid: uuid });
    return normalized;
  }

  async listSequences(scene = this.getActiveScene(), { includeArchived = true } = {}) {
    const data = await this.getSceneData(scene);
    const sequences = data.sequences.filter((sequence) => includeArchived || !sequence.archived);
    return sequences.map((sequence) => ({ ...sequence, beats: sortedBeats(sequence) }));
  }

  async getSequence(sequenceId, scene = this.getActiveScene()) {
    const data = await this.getSceneData(scene);
    const sequence = findSequence(data, sequenceId);
    return sequence ? { ...sequence, beats: sortedBeats(sequence) } : null;
  }

  async mutate(scene, mutator) {
    assertGm();
    const data = await this.getSceneData(scene);
    const result = await mutator(data);
    await this.saveSceneData(scene, data);
    return result;
  }

  async createSequence(scene = this.getActiveScene()) {
    assertGm();
    const uuid = await sceneUuid(scene);
    return this.mutate(scene, (data) => {
      const sequence = createSequence(uuid);
      data.sequences.push(sequence);
      return sequence;
    });
  }

  async updateSequence(sequenceId, patch, scene = this.getActiveScene()) {
    return this.mutate(scene, (data) => {
      const sequence = findSequence(data, sequenceId);
      if (!sequence) throw new Error("Sequence was not found.");
      const allowed = ["name", "description", "sceneUuid", "startingBeatId", "tags", "gmNotes", "enabled", "archived"];
      for (const field of allowed) {
        if (Object.hasOwn(patch, field)) sequence[field] = cloneData(patch[field]);
      }
      sequence.version += 1;
      touchMetadata(sequence);
      return normalizeSequence(sequence, 0, sequence.sceneUuid);
    });
  }

  async duplicateSequence(sequenceId, scene = this.getActiveScene()) {
    const uuid = await sceneUuid(scene);
    return this.mutate(scene, (data) => {
      const sequence = findSequence(data, sequenceId);
      if (!sequence) throw new Error("Sequence was not found.");
      const duplicated = duplicateSequenceWithNewIds(sequence, uuid);
      data.sequences.push(duplicated);
      return duplicated;
    });
  }

  async archiveSequence(sequenceId, scene = this.getActiveScene()) {
    return this.updateSequence(sequenceId, { archived: true }, scene);
  }

  async deleteSequence(sequenceId, scene = this.getActiveScene()) {
    return this.mutate(scene, (data) => {
      const index = data.sequences.findIndex((sequence) => sequence.id === sequenceId);
      if (index < 0) throw new Error("Sequence was not found.");
      const [deleted] = data.sequences.splice(index, 1);
      return deleted;
    });
  }

  async createBeat(sequenceId, scene = this.getActiveScene()) {
    return this.mutate(scene, (data) => {
      const sequence = findSequence(data, sequenceId);
      if (!sequence) throw new Error("Sequence was not found.");
      const beat = createBeat(sequence.beats.length);
      sequence.beats.push(beat);
      sequence.beatIds.push(beat.id);
      if (!sequence.startingBeatId) sequence.startingBeatId = beat.id;
      sequence.version += 1;
      touchMetadata(sequence);
      return beat;
    });
  }

  async updateBeat(sequenceId, beatId, patch, scene = this.getActiveScene()) {
    return this.mutate(scene, (data) => {
      const sequence = findSequence(data, sequenceId);
      const beat = findBeat(sequence, beatId);
      if (!beat) throw new Error("Beat was not found.");
      const allowed = [
        "name",
        "description",
        "color",
        "icon",
        "gmNotes",
        "requiresConfirmation",
        "stopPointAfter",
        "continueOnActionFailure",
        "dangerLevel",
        "manualState"
      ];
      for (const field of allowed) {
        if (Object.hasOwn(patch, field)) beat[field] = cloneData(patch[field]);
      }
      sequence.version += 1;
      touchMetadata(beat);
      touchMetadata(sequence);
      return normalizeBeat(beat, sequence.beats.indexOf(beat));
    });
  }

  async duplicateBeat(sequenceId, beatId, scene = this.getActiveScene()) {
    return this.mutate(scene, (data) => {
      const sequence = findSequence(data, sequenceId);
      const beat = findBeat(sequence, beatId);
      if (!beat) throw new Error("Beat was not found.");
      const insertAt = sequence.beatIds.indexOf(beatId) + 1;
      const duplicated = duplicateBeatWithNewIds(beat, insertAt);
      sequence.beats.splice(insertAt, 0, duplicated);
      sequence.beatIds.splice(insertAt, 0, duplicated.id);
      reindexSequenceBeats(sequence);
      sequence.version += 1;
      touchMetadata(sequence);
      return duplicated;
    });
  }

  async deleteBeat(sequenceId, beatId, scene = this.getActiveScene()) {
    return this.mutate(scene, (data) => {
      const sequence = findSequence(data, sequenceId);
      if (!sequence) throw new Error("Sequence was not found.");
      const index = sequence.beats.findIndex((beat) => beat.id === beatId);
      if (index < 0) throw new Error("Beat was not found.");
      const [deleted] = sequence.beats.splice(index, 1);
      sequence.beatIds = sequence.beatIds.filter((id) => id !== beatId);
      if (sequence.startingBeatId === beatId) sequence.startingBeatId = sequence.beatIds[0] ?? "";
      reindexSequenceBeats(sequence);
      sequence.version += 1;
      touchMetadata(sequence);
      return deleted;
    });
  }

  async moveBeat(sequenceId, beatId, direction, scene = this.getActiveScene()) {
    return this.mutate(scene, (data) => {
      const sequence = findSequence(data, sequenceId);
      if (!sequence) throw new Error("Sequence was not found.");
      reindexSequenceBeats(sequence);
      const index = sequence.beatIds.indexOf(beatId);
      const next = direction === "up" ? index - 1 : index + 1;
      if (index < 0 || next < 0 || next >= sequence.beatIds.length) return null;
      [sequence.beatIds[index], sequence.beatIds[next]] = [sequence.beatIds[next], sequence.beatIds[index]];
      sequence.beats = sequence.beatIds.map((id) => sequence.beats.find((beat) => beat.id === id)).filter(Boolean);
      sequence.version += 1;
      touchMetadata(sequence);
      return findBeat(sequence, beatId);
    });
  }

  async createAction(sequenceId, beatId, actionType, adapter, scene = this.getActiveScene()) {
    return this.mutate(scene, (data) => {
      const sequence = findSequence(data, sequenceId);
      const beat = findBeat(sequence, beatId);
      if (!beat) throw new Error("Beat was not found.");
      const action = createAction(actionType, adapter, beat.actions.length);
      beat.actions.push(action);
      beat.actionIds.push(action.id);
      reindexBeatActions(beat);
      sequence.version += 1;
      touchMetadata(beat);
      touchMetadata(sequence);
      return action;
    });
  }

  async updateAction(sequenceId, beatId, actionId, patch, scene = this.getActiveScene()) {
    return this.mutate(scene, (data) => {
      const sequence = findSequence(data, sequenceId);
      const beat = findBeat(sequence, beatId);
      const action = findAction(beat, actionId);
      if (!action) throw new Error("Action was not found.");
      const allowed = [
        "type",
        "name",
        "enabled",
        "adapter",
        "config",
        "executionMode",
        "parallelGroup",
        "failurePolicy",
        "precondition",
        "delayAfterMs",
        "requiresConfirmation",
        "lastValidation",
        "lastResult",
        "rollbackSupported",
        "rollbackSnapshotRef"
      ];
      for (const field of allowed) {
        if (Object.hasOwn(patch, field)) action[field] = cloneData(patch[field]);
      }
      reindexBeatActions(beat);
      sequence.version += 1;
      touchMetadata(action);
      touchMetadata(beat);
      touchMetadata(sequence);
      return normalizeBeat(beat, sequence.beats.indexOf(beat)).actions.find((candidate) => candidate.id === actionId);
    });
  }

  async recordActionResult(sequenceId, beatId, actionId, result, scene = this.getActiveScene()) {
    return this.updateAction(sequenceId, beatId, actionId, { lastResult: result }, scene);
  }

  async recordActionValidation(sequenceId, beatId, actionId, result, scene = this.getActiveScene()) {
    return this.updateAction(sequenceId, beatId, actionId, { lastValidation: result }, scene);
  }

  async duplicateAction(sequenceId, beatId, actionId, scene = this.getActiveScene()) {
    return this.mutate(scene, (data) => {
      const sequence = findSequence(data, sequenceId);
      const beat = findBeat(sequence, beatId);
      const action = findAction(beat, actionId);
      if (!action) throw new Error("Action was not found.");
      const insertAt = beat.actionIds.indexOf(actionId) + 1;
      const duplicated = duplicateActionWithNewId(action, insertAt);
      beat.actions.splice(insertAt, 0, duplicated);
      beat.actionIds.splice(insertAt, 0, duplicated.id);
      reindexBeatActions(beat);
      sequence.version += 1;
      touchMetadata(beat);
      touchMetadata(sequence);
      return duplicated;
    });
  }

  async deleteAction(sequenceId, beatId, actionId, scene = this.getActiveScene()) {
    return this.mutate(scene, (data) => {
      const sequence = findSequence(data, sequenceId);
      const beat = findBeat(sequence, beatId);
      if (!beat) throw new Error("Beat was not found.");
      const index = beat.actions.findIndex((action) => action.id === actionId);
      if (index < 0) throw new Error("Action was not found.");
      const [deleted] = beat.actions.splice(index, 1);
      beat.actionIds = beat.actionIds.filter((id) => id !== actionId);
      reindexBeatActions(beat);
      sequence.version += 1;
      touchMetadata(beat);
      touchMetadata(sequence);
      return deleted;
    });
  }

  async moveAction(sequenceId, beatId, actionId, direction, scene = this.getActiveScene()) {
    return this.mutate(scene, (data) => {
      const sequence = findSequence(data, sequenceId);
      const beat = findBeat(sequence, beatId);
      if (!beat) throw new Error("Beat was not found.");
      reindexBeatActions(beat);
      const index = beat.actionIds.indexOf(actionId);
      const next = direction === "up" ? index - 1 : index + 1;
      if (index < 0 || next < 0 || next >= beat.actionIds.length) return null;
      [beat.actionIds[index], beat.actionIds[next]] = [beat.actionIds[next], beat.actionIds[index]];
      beat.actions = beat.actionIds.map((id) => beat.actions.find((action) => action.id === id)).filter(Boolean);
      reindexBeatActions(beat);
      sequence.version += 1;
      touchMetadata(beat);
      touchMetadata(sequence);
      return findAction(beat, actionId);
    });
  }
}

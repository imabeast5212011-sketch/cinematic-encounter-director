import { FLAGS, MODULE_ID, SETTINGS } from "../constants.js";
import { cloneData, makeId, nowStamp, safeString } from "../state/schema.js";
import { getSetting } from "../settings.js";

function activeScene() {
  return canvas?.scene ?? game.scenes?.viewed ?? game.scenes?.active ?? game.scenes?.current ?? null;
}

export class ExecutionLog {
  constructor() {
    this.memoryEntries = [];
  }

  async list(scene = activeScene()) {
    const raw = scene?.getFlag?.(MODULE_ID, FLAGS.EXECUTION_LOG);
    return Array.isArray(raw) ? raw : this.memoryEntries;
  }

  async append(entry, scene = activeScene()) {
    const normalized = {
      id: makeId("log"),
      createdAt: nowStamp(),
      executionId: safeString(entry.executionId, 120),
      sequenceId: safeString(entry.sequenceId, 120),
      beatId: safeString(entry.beatId, 120),
      actionId: safeString(entry.actionId, 120),
      status: safeString(entry.status, 40, "warning"),
      message: safeString(entry.message, 1000),
      details: cloneData(entry.details ?? {})
    };
    const retention = Number(getSetting(SETTINGS.EXECUTION_LOG_RETENTION)) || 200;
    const next = [...(await this.list(scene)), normalized].slice(-retention);
    if (scene?.setFlag && game.user?.isGM) await scene.setFlag(MODULE_ID, FLAGS.EXECUTION_LOG, next);
    else this.memoryEntries = next;
    return normalized;
  }

  async clear(scene = activeScene()) {
    if (scene?.unsetFlag && game.user?.isGM) await scene.unsetFlag(MODULE_ID, FLAGS.EXECUTION_LOG);
    this.memoryEntries = [];
  }
}

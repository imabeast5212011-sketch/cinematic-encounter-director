import { FLAGS, MODULE_ID, RESULT_STATUS } from "../constants.js";
import { cloneData, createResult, makeId, nowStamp } from "../state/schema.js";

function activeScene() {
  return canvas?.scene ?? game.scenes?.viewed ?? game.scenes?.active ?? game.scenes?.current ?? null;
}

export class RollbackService {
  constructor(adapters) {
    this.adapters = adapters;
  }

  async list(scene = activeScene()) {
    const raw = scene?.getFlag?.(MODULE_ID, FLAGS.ROLLBACK_SNAPSHOTS);
    return Array.isArray(raw) ? raw : [];
  }

  async storeFromResult(result, context, scene = activeScene()) {
    const snapshot = result?.details?.rollbackSnapshot;
    if (!snapshot || !scene?.setFlag || !game.user?.isGM) return "";
    const stored = {
      ...cloneData(snapshot),
      id: snapshot.id || makeId("rollback"),
      executionId: context.executionId,
      sequenceId: context.sequence?.id ?? "",
      beatId: context.beat?.id ?? "",
      actionId: context.action?.id ?? "",
      actionType: context.action?.type ?? snapshot.actionType ?? "",
      createdAt: snapshot.createdAt ?? nowStamp(),
      used: false
    };
    const snapshots = [...(await this.list(scene)), stored].slice(-100);
    await scene.setFlag(MODULE_ID, FLAGS.ROLLBACK_SNAPSHOTS, snapshots);
    return stored.id;
  }

  async rollbackLast(scene = activeScene()) {
    const snapshots = await this.list(scene);
    const snapshot = [...snapshots].reverse().find((entry) => !entry.used);
    if (!snapshot) return createResult(RESULT_STATUS.SKIPPED, "No unused rollback snapshot is available.");
    const adapter = this.adapters.get(snapshot.adapter);
    if (!adapter?.rollback) return createResult(RESULT_STATUS.UNSUPPORTED, "Rollback adapter is unavailable.");
    const result = await adapter.rollback(null, { snapshot });
    if ([RESULT_STATUS.ROLLED_BACK, RESULT_STATUS.SUCCESS, RESULT_STATUS.SKIPPED].includes(result.status)) {
      const updated = snapshots.map((entry) => entry.id === snapshot.id ? { ...entry, used: true, usedAt: nowStamp(), usedBy: game.user?.id ?? "" } : entry);
      await scene.setFlag(MODULE_ID, FLAGS.ROLLBACK_SNAPSHOTS, updated);
    }
    return result;
  }

  async emergencyStop(context = {}) {
    const results = [];
    for (const adapter of this.adapters.values()) {
      if (typeof adapter.emergencyStop !== "function") continue;
      results.push(await adapter.emergencyStop(context));
    }
    return results;
  }
}

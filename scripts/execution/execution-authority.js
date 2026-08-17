import { EXECUTION_LOCK_TIMEOUT_MS, FLAGS, MODULE_ID, RESULT_STATUS } from "../constants.js";
import { createResult, makeId, nowStamp, safeString } from "../state/schema.js";

function isExpired(lock) {
  const timestamp = Date.parse(lock?.updatedAt ?? lock?.createdAt ?? 0);
  return !Number.isFinite(timestamp) || Date.now() - timestamp > EXECUTION_LOCK_TIMEOUT_MS;
}

export class ExecutionAuthority {
  async acquire(scene, { sequenceId, beatId, executionId = makeId("execution"), revision = 0 }) {
    if (!game.user?.isGM) return { ok: false, executionId, result: createResult(RESULT_STATUS.FAILURE, "Only a GM may acquire execution authority.") };
    if (!scene) return { ok: false, executionId, result: createResult(RESULT_STATUS.FAILURE, "No Scene is available for execution authority.") };

    const current = scene.getFlag(MODULE_ID, FLAGS.EXECUTION_LOCK);
    if (current && !isExpired(current) && current.executionId !== executionId) {
      return {
        ok: false,
        executionId,
        result: createResult(RESULT_STATUS.WARNING, "Another GM currently owns this Scene's Director execution lock.", { lock: current })
      };
    }

    const lock = {
      id: makeId("lock"),
      executionId,
      sequenceId: safeString(sequenceId, 120),
      beatId: safeString(beatId, 120),
      revision: Number(revision) || 0,
      ownerUserId: game.user.id,
      ownerName: game.user.name ?? "",
      createdAt: nowStamp(),
      updatedAt: nowStamp()
    };
    await scene.setFlag(MODULE_ID, FLAGS.EXECUTION_LOCK, lock);
    const confirmed = scene.getFlag(MODULE_ID, FLAGS.EXECUTION_LOCK);
    if (confirmed?.executionId !== executionId || confirmed?.ownerUserId !== game.user.id) {
      return {
        ok: false,
        executionId,
        result: createResult(RESULT_STATUS.WARNING, "Execution authority was superseded before execution began.", { confirmed })
      };
    }
    return { ok: true, executionId, lock };
  }

  async refresh(scene, executionId) {
    const lock = scene?.getFlag?.(MODULE_ID, FLAGS.EXECUTION_LOCK);
    if (!lock || lock.executionId !== executionId || lock.ownerUserId !== game.user?.id) return false;
    await scene.setFlag(MODULE_ID, FLAGS.EXECUTION_LOCK, { ...lock, updatedAt: nowStamp() });
    return true;
  }

  async release(scene, executionId) {
    if (!scene?.getFlag || !scene?.unsetFlag) return;
    const lock = scene.getFlag(MODULE_ID, FLAGS.EXECUTION_LOCK);
    if (!lock || lock.executionId !== executionId) return;
    if (lock.ownerUserId !== game.user?.id && !isExpired(lock)) return;
    await scene.unsetFlag(MODULE_ID, FLAGS.EXECUTION_LOCK);
  }

  async getLock(scene) {
    return scene?.getFlag?.(MODULE_ID, FLAGS.EXECUTION_LOCK) ?? null;
  }
}

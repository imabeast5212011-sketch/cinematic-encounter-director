import { INTEGRATION_TARGETS, PROVIDERS, RESULT_STATUS } from "../constants.js";
import { createResult } from "../state/schema.js";
import { BaseAdapter } from "./base-adapter.js";

export class FXMasterAdapter extends BaseAdapter {
  constructor() {
    super(INTEGRATION_TARGETS.fxmaster);
  }

  getUnsupportedCapabilities(api, bridge) {
    const unsupported = super.getUnsupportedCapabilities(api, bridge);
    if (!bridge) {
      unsupported.push(
        "FXMaster preset/particle/filter API was not confirmed from local source.",
        "Clear-all effects remains unavailable until a confirmed public API and GM confirmation are present."
      );
    }
    return unsupported;
  }

  async execute(action, context) {
    if (action.type === "fxmaster.clearAll" && !action.confirmedDangerous) {
      return createResult(RESULT_STATUS.FAILURE, "Dangerous FXMaster clear-all requires explicit GM confirmation.");
    }
    return super.execute(action, context);
  }

  minimizeExecutionContext(context) {
    return {
      ...super.minimizeExecutionContext(context),
      providerHint: PROVIDERS.FXMASTER
    };
  }
}

import { INTEGRATION_TARGETS, PROVIDERS } from "../constants.js";
import { BaseAdapter } from "./base-adapter.js";

export class ExaltedScenesAdapter extends BaseAdapter {
  constructor() {
    super(INTEGRATION_TARGETS.exaltedScenes);
  }

  getUnsupportedCapabilities(api, bridge) {
    const unsupported = super.getUnsupportedCapabilities(api, bridge);
    if (!bridge) {
      unsupported.push(
        "Exalted Scenes broadcast/presentation API was not confirmed from local source.",
        "The Director will not manipulate Exalted Scenes DOM or private flags."
      );
    }
    return unsupported;
  }

  minimizeExecutionContext(context) {
    return {
      ...super.minimizeExecutionContext(context),
      providerHint: PROVIDERS.EXALTED_SCENES
    };
  }
}

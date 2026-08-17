import { INTEGRATION_TARGETS, PROVIDERS } from "../constants.js";
import { BaseAdapter } from "./base-adapter.js";

export class CharacterHudAdapter extends BaseAdapter {
  constructor() {
    super(INTEGRATION_TARGETS.characterHud);
  }

  getUnsupportedCapabilities(api, bridge) {
    const unsupported = super.getUnsupportedCapabilities(api, bridge);
    if (!bridge) {
      unsupported.push(
        "COTS Character HUD presentation API was not confirmed from local source.",
        "The Director will not manipulate HUD DOM, speaker overlays, or private flags."
      );
    }
    return unsupported;
  }

  minimizeExecutionContext(context) {
    return {
      ...super.minimizeExecutionContext(context),
      providerHint: PROVIDERS.CHARACTER_HUD
    };
  }
}

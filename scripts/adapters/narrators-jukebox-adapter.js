import { INTEGRATION_TARGETS, PROVIDERS } from "../constants.js";
import { PublicApiActionAdapter } from "./public-api-action-adapter.js";

const METHOD_CANDIDATES = {
  "narrators-jukebox.playMusic": {
    playMusic: ["playMusic", "music.play", "playTrack", "tracks.play", "playPlaylist", "playMood", "broadcastMusic", "play"],
    default: ["playMusic", "playTrack", "play"]
  },
  "narrators-jukebox.stopMusic": {
    stopMusic: ["stopMusic", "music.stop", "stopTrack", "tracks.stop", "fadeOut", "stopAll", "stop"],
    default: ["stopMusic", "stopTrack", "stop"]
  },
  "narrators-jukebox.ambience": {
    startAmbience: ["startAmbience", "playAmbience", "ambience.play", "loadAmbiencePreset", "playPreset", "play"],
    stopAmbience: ["stopAmbience", "ambience.stop", "stopAmbiencePreset", "stopPreset", "stop"],
    default: ["startAmbience", "playAmbience", "loadAmbiencePreset", "playPreset"]
  },
  "narrators-jukebox.soundCue": {
    playSoundCue: ["playSoundCue", "soundboard.play", "playSound", "playSfx", "playEffect", "playCue", "play"],
    default: ["playSoundCue", "playSound", "playCue"]
  }
};

export class NarratorsJukeboxAdapter extends PublicApiActionAdapter {
  constructor() {
    super(INTEGRATION_TARGETS.narratorsJukebox, METHOD_CANDIDATES);
  }

  minimizeExecutionContext(context) {
    return {
      ...super.minimizeExecutionContext(context),
      providerHint: PROVIDERS.NARRATORS_JUKEBOX
    };
  }
}

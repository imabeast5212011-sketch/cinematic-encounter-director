# Cinematic Encounter Director

Version 0.1.15 for Foundry VTT v14.

Cinematic Encounter Director is a GM-only tactical orchestration module for preparing and running encounters as manually triggered Sequences, Beats, and Actions. It coordinates Foundry-native Scene, Token, light, wall, door, Combat, camera, chat, pause, and optional Playlist actions while leaving cinematic, audio, environmental, HUD, timeline, and session-planning systems in their own modules.

This module deliberately does not replace SessionFlow, Exalted Scenes, Narrator's Jukebox, FXMaster, COTS Character HUD, Cinematic Combat Timeline, Foundry Scenes, Foundry Combat, Playlists, or D&D 5e mechanics.

## Installation

Upload the folder named:

```text
cinematic-encounter-director
```

to the remote Foundry server's:

```text
Data/modules/
```

Then restart Foundry if needed, enable **Cinematic Encounter Director** in the world's Manage Modules dialog, and open it from the Scene controls button or the module API:

```js
game.modules.get("cinematic-encounter-director").api.openDirector()
```

Live Foundry testing was not available in this development environment. This package has static verification only and must be tested on the remote server before use in a live session.

## Model

A **Sequence** is the encounter plan. It has a stable id, name, description, owning Scene UUID, ordered Beat ids, schema version, metadata, tags, GM notes, enabled state, and archived state.

A **Beat** is one manual moment in the encounter. It has a stable id, name, description, ordered Action ids, manual execution state, optional color or icon, GM notes, confirmation controls, failure behavior, and an informational danger level.

An **Action** is a declarative instruction. It has a stable id, action type, name, enabled state, target adapter, config payload, execution mode, optional parallel group, failure policy, precondition payload, bounded delay, confirmation flag, validation result, execution result, and rollback metadata when supported.

No arbitrary JavaScript execution is allowed. Imported JSON is treated as untrusted data and cannot define scripts, callbacks, commands, functions, handlers, or code.

## Storage

Version 0.1.15 stores Scene-bound Sequence data in module-owned Scene flags:

```text
cinematic-encounter-director.sceneSequences
```

Execution locks, execution logs, and rollback snapshots are also module-owned flags. Browser local storage is not used for authoritative encounter data.

Schema versioning is enforced. Future schema versions are not silently executed. Import rejects unsupported future versions and forbidden executable-looking fields.

## Creating Encounters

Open the Director as a GM, create a Sequence, then open the editor.

Use the editor to:

- Rename and describe the Sequence.
- Bind the Sequence to the currently viewed Scene.
- Add, duplicate, move, archive, or delete Beats.
- Add, duplicate, move, enable, disable, edit, or delete Actions.
- Build a basic combat setup from currently selected canvas Tokens.
- Add a reinforcement wave from currently selected canvas Tokens.
- Configure failure policy, execution mode, parallel group, delay, confirmation, and declarative config JSON.
- Validate a Beat before running it.

Token groups are configured by adding multiple Token UUIDs to native Token actions such as reveal/hide, move, elevation, disposition, or add to Combat. Store stable UUIDs rather than display names.

### Quick Combat Setup

To build a basic combat Beat:

1. Open the Scene in Foundry.
2. Place the enemy Tokens where they should start.
3. Select those Tokens on the canvas.
4. Open the Sequence editor.
5. Click **Bind Current Scene**.
6. Click **Add Combat Setup From Selected Tokens**.
7. Save the Beat, close the editor, validate the Beat, then run it.

That shortcut adds Actions to activate the Scene, reveal the selected Tokens, create Combat, add those Tokens to Combat, and start Combat. Use **Add Reinforcement Wave** for later Beats after selecting the next wave's prepared Tokens.

## Running Encounters

The Director defaults to manual execution.

GM controls include:

- Previous Beat.
- Validate Beat.
- Run Selected Beat.
- Next Beat.
- Run Individual Action.
- Retry Action.
- Skip Action.
- Stop Running Beat.
- Emergency Stop.
- Roll Back Last Supported Action.
- Reset Execution State.

Next Beat only changes selection. It does not run the next Beat automatically unless the GM enables the client setting to select the next Beat after successful completion; even then, execution remains manual.

## Delays And Wait Points

`native.delay` uses a bounded, cancellable timer with a maximum duration of 60000 ms.

`native.waitForConfirmation` displays a GM confirmation prompt and pauses Beat execution until the GM continues or cancels. Preview mode never starts real timers.

Emergency Stop cancels pending Director timers and tells adapters to stop only Director-owned work where a confirmed public API supports that behavior.

## Sequential And Parallel Actions

Actions are sequential by default.

To run Actions in parallel:

- Set each Action's execution mode to `parallel`.
- Give adjacent parallel Actions the same parallel group value.

Parallel groups collect every result. A rejected Action does not erase the results from other Actions in the group.

## Native Actions

Implemented Foundry-native Actions:

- GM note or group divider.
- Safe ChatMessage or GM-only log note.
- Timed delay.
- Manual wait point.
- Preload Scene.
- View Scene locally as GM.
- Activate Scene for players.
- Set Scene darkness.
- Update allowlisted Scene environment fields.
- Update existing AmbientLight documents.
- Update existing Wall or Door fields.
- Reveal or hide existing Tokens.
- Move existing Tokens to configured coordinates.
- Update Token elevation.
- Update Token disposition.
- Create Combat for a Scene.
- Add existing Tokens to Combat.
- Remove configured Combatants from Combat.
- Start Combat.
- End Combat.
- Set Combat round or turn as a dangerous Action.
- Pan GM, selected users, or active players through a module socket request.
- Pause or unpause the game.
- Optional native Playlist cue when the world setting enables Playlist fallback.

Native document mutation resolves UUIDs, checks document type, uses allowlisted fields, and updates only intended fields.

Narrator's Jukebox remains the preferred audio integration. Native Playlist actions are separate and never translate Jukebox references.

## Rollback

Rollback is conservative. Supported native rollback snapshots include:

- Scene darkness and allowlisted Scene fields.
- AmbientLight field changes.
- Wall and door field changes.
- Token hidden state.
- Token position.
- Token elevation.
- Token disposition.
- Director-created Combatants from add-to-Combat actions.
- Director-started native Playlist cues where the native stop API is available.

Rollback is not offered for Scene activation, Combat start/end, Combat round/turn changes, ChatMessages, Pause state, external integrations without confirmed rollback APIs, or any target whose rollback snapshot is no longer safe to apply.

Emergency Stop cancels Director work; it does not claim to undo completed mutations.

## Multi-GM Authority

Before a Beat or individual Action runs, the Director acquires a Scene-level execution lock in module-owned Scene flags:

```text
cinematic-encounter-director.executionLock
```

The lock contains an execution id, sequence id, beat id, sequence revision, owner GM id, timestamps, and owner name. Other GMs can observe the state through rerenders and logs. Stale locks expire after 120000 ms so a disconnected GM does not permanently block the Sequence.

The module does not execute GM Actions from player socket packets. The only socket payload accepted by players is a camera-pan request from a detected GM user id; it does not mutate documents.

## Import And Export

Export supports one Sequence or all Sequences attached to the current Scene. Exported JSON includes module id, schema version, Sequence data, Beat data, Action data, and reference metadata.

Import validates JSON structure, schema version, forbidden executable fields, and absolute filesystem paths. Imported data never executes immediately and is duplicated into the current Scene by default.

Missing references remain editable for remapping in the Action editor.

## Public API

The module exposes:

```js
const api = game.modules.get("cinematic-encounter-director").api;
```

Available methods:

- `openDirector(options)`.
- `registerActionProvider(provider)`.
- `registerActionType(actionType)`.
- `validateActionConfig(action, context)`.
- `requestExecution({ sequenceId, beatId, actionId, dryRun, scene })`.
- `readSequenceMetadata(scene)`.
- `subscribe(eventName, callback)`.

Providers must declare a unique id, display name, validation function, execution function, optional rollback function, optional emergency-stop function, and capability metadata. A provider cannot override an existing provider id.

The API does not expose unrestricted document mutation.

## Troubleshooting

- If the Director does not appear, confirm the world setting is enabled and the current user is a GM.
- If an external Action is unsupported, check the Integration Health panel for detected module id, active state, version, public API status, capabilities, and last error.
- If a Beat will not run, use Validate Beat and inspect the execution log.
- If a lock remains after a disconnect, wait for the stale-lock timeout or reload with a GM client.
- If imported references are unresolved, open each Action and remap UUIDs or external ids.
- If native Playlist actions are unavailable, enable the native Playlist fallback world setting.
- If Foundry appears to keep using an old Director version after update, force a full browser reload. Version 0.1.15 avoids query-string cache busters because some Foundry static routes reject module asset URLs containing `?v=...`.

## Current Limitations

- Static verification only; no local or remote Foundry runtime testing was performed.
- SessionFlow uses confirmed panel hooks and presentation socket actions. Exalted Scenes uses confirmed public API namespaces such as `broadcast`, `slideshows`, `sequences`, `castOnly`, and `audio`. Narrator's Jukebox uses confirmed public API methods for music, playlists, ambience layers/presets, soundboard cues, and its GM window.
- FXMaster uses the documented `FXMASTER.api` presets, effects, and scene-effect stop helpers when present.
- COTS Character HUD uses the confirmed `game.cotsCharacterHud.socket` presentation API when present.
- The locally inspected Cinematic Combat Timeline version exposes status/open-config API only, not countdown mutation API.
- The Action editor uses declarative JSON configuration for v0.1.0 rather than a specialized form for every Action type.
- Remapping imported references is manual in v0.1.0.
- Player camera pan uses the module socket and should be tested carefully on the remote server.

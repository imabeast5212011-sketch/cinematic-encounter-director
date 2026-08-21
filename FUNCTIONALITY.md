# Cinematic Encounter Director Functionality

This file is a feature inventory for Cinematic Encounter Director v0.1.23.

## Purpose

Cinematic Encounter Director is a GM-only Foundry VTT v14 module for preparing and running tactical encounters as ordered Sequences, Beats, Actions, and optional automation Triggers.

It is meant to sit above Foundry combat and related cinematic modules. It does not replace Foundry Scenes, Combat, D&D 5e mechanics, SessionFlow, Exalted Scenes, Narrator's Jukebox, FXMaster, COTS Character HUD, or Cinematic Combat Timeline.

## Core Data Model

- Sequence: the full encounter plan for a Scene.
- Beat: one moment or phase inside a Sequence.
- Action: one thing the Director can validate and execute.
- Trigger: an optional condition that can move to, run, or start a Beat/Sequence.

## GM-Only Controls

- Open the Director from the Scene controls button.
- Open the Director through the module API.
- Switch between Run mode and Plan mode.
- Create, duplicate, archive, delete, export, and import Sequences.
- Edit Sequences in a separate Sequence editor.
- Select Beats from an ordered Beat list.
- Validate a Beat before running it.
- Run a full Beat.
- Run an individual Action.
- Retry an Action.
- Skip an Action.
- Stop a running Beat.
- Request Emergency Stop.
- Roll back the last supported Action.
- Reset execution state for a Sequence.
- Clear the execution log.

## User Interface

- Three-zone Director layout: navigation, selected Beat/actions, and context/log.
- Remembered client-side Run and Plan modes.
- Compact Beat cue list with order, name, danger, state, Action count, and Trigger count.
- Selected Beat summary with danger, execution state, Trigger summary, and Action count.
- Plain-language Action cue rows with provider, type, execution mode, confirmation, delay, rollback, and result state.
- Collapsible Integration Health panel.
- Filterable Execution Log.
- Scroll-contained Director, Sequence editor, and Action editor windows for smaller viewports.
- Keyboard-visible focus states and reduced-motion CSS support.

## Sequence Editor

- Rename a Sequence.
- Add a Sequence description.
- Bind the Sequence to the current Scene.
- Add tags.
- Add GM notes.
- Enable or disable the Sequence.
- Archive or unarchive the Sequence.
- Add Beats.
- Select Beats.
- Duplicate Beats.
- Delete Beats.
- Move Beats up or down.
- Edit Beat name, description, color, icon, danger level, GM notes, and run behavior.
- Add Actions to Beats.
- Edit Actions in the Action editor.
- Duplicate Actions.
- Delete Actions.
- Move Actions up or down.
- Enable or disable Actions.
- Add quick combat setup Actions from selected canvas Tokens.
- Add reinforcement wave Actions from selected canvas Tokens.
- Add quick combat-flow Triggers for combat start, round 2, and combat end.
- Add common automation Triggers from selected canvas Tokens.
- Edit common Trigger settings with form controls.
- Dry-run simulated Combat Start, Round 1-4, Turn 1, Initiative 10, and Combat End trigger events.
- Use Advanced Trigger JSON when unusual Trigger payloads are needed.

## Beat Settings

- Beat name.
- Beat description.
- Beat color.
- Beat icon.
- Beat danger level.
- Beat GM notes.
- Require confirmation.
- Stop point after execution.
- Continue after Action failure.
- Structured Trigger controls.
- Advanced Trigger JSON fallback.
- Manual execution state.

## Action System

Actions are declarative. They store configuration data, not arbitrary JavaScript.

Each Action can have:

- Stable id.
- Action type.
- Name.
- Enabled state.
- Adapter/provider.
- Config JSON.
- Structured config form for common native and integration fields.
- Advanced Config JSON fallback for unusual provider payloads.
- Execution mode.
- Parallel group.
- Failure policy.
- Precondition JSON.
- Delay after execution.
- Confirmation flag.
- Last validation result.
- Last execution result.
- Rollback metadata when supported.

## Execution Modes

- Sequential execution.
- Parallel execution for adjacent Actions that share the same parallel group.
- Continue, stop, or skip remaining Actions based on failure policy.
- Bounded delay Actions.
- Manual wait points.
- Confirmation prompts for dangerous or explicitly confirmed Actions.

## Validation And Dry Runs

- Validate a full Beat before executing it.
- Validate each Action before execution.
- Show validation warnings for unavailable integrations, unsupported Actions, missing references, or dangerous behavior.
- Block Beat execution unless the GM confirms validation warnings.
- Store validation results on Actions.

## Execution Log

- Logs Beat start.
- Logs Action results.
- Logs Beat finish.
- Logs Trigger fire events.
- Logs warnings, failures, cancellations, skipped Actions, dry runs, and rollback results.
- Keeps log entries in module-owned Scene flags.
- Has configurable retention.
- Can be cleared by the GM.
- Can be filtered by all, success, warning, failure, Trigger, and rollback entries.

## Rollback

Rollback is conservative and only applies to supported work.

Supported rollback snapshots include:

- Scene darkness changes.
- Allowlisted Scene environment changes.
- AmbientLight field changes.
- Wall and door field changes.
- Token hidden state.
- Token position.
- Token elevation.
- Token disposition.
- Director-created Combatants from add-to-Combat Actions.
- Director-started native Playlist cues where Foundry exposes a stop API.
- Actor Item grants, removals, and quantity changes.
- Director-created Journal handouts.

Rollback is not claimed for:

- Scene activation.
- Combat start/end.
- Combat round/turn changes.
- Chat messages.
- Roll-request chat messages.
- Showing existing Journal handouts.
- Pause state.
- External integrations without confirmed rollback APIs.
- Targets that no longer exist or are no longer safe to modify.

## Emergency Stop

Emergency Stop:

- Cancels active Director timers on the current GM client.
- Cancels active Director execution state on the current GM client.
- Releases execution locks where possible.
- Notifies adapters that support a safe stop operation.
- Does not undo completed document mutations.

## Multi-GM Safety

- Beat execution uses a Scene-level lock.
- The lock stores execution id, sequence id, beat id, sequence revision, owner GM id, owner name, and timestamps.
- Other GMs are blocked from running the same locked Beat.
- Stale locks expire after a timeout.
- Trigger evaluation is handled by one active GM client to reduce duplicate firing.
- Triggered Beat execution still goes through the execution lock.

## Automation Triggers

Triggers live on Beats. When a Trigger condition becomes true, the Director can:

- Select a Beat.
- Run a Beat.
- Start a Sequence.

Supported Trigger events:

- Combat started.
- Combat round started.
- Combat turn started.
- Initiative reached.
- Combat ended.
- Enemy defeated count.
- Combatant defeated count.
- Watched Token or Actor HP at or below a threshold.
- Watched Token or Actor defeated.
- Ally defeated.
- Combat round at or above a number for backward-compatible polling.

Trigger options include:

- Enabled or disabled.
- Once-only behavior.
- Cooldown for repeatable Triggers.
- Count threshold.
- Round number.
- Turn number.
- Initiative threshold.
- Numeric comparison.
- HP threshold.
- HP threshold type: hit points or percent.
- Token UUID filters.
- Actor UUID filters.
- Token disposition filters.
- Target Sequence id.
- Target Beat id.
- Confirmation requirement.
- Continue after validation warnings.

Default Trigger behavior:

- Quick-added Triggers use `once: true`.
- `selectBeat` Triggers do not require confirmation.
- `runBeat` and `startSequence` Triggers require GM confirmation by default.
- A once-only Trigger records fire-state before it runs, so repeated Foundry updates should not loop it.
- Combat trigger fire-state includes combat/round/turn/initiative context where relevant, so round 2 in one Combat does not block round 2 in another Combat.
- Reset Execution State clears Trigger fire-state for the selected Sequence.
- Combat-triggered Action contexts include combat id/uuid, round, turn index, one-based turn number, active combatant data, initiative, Scene id/uuid, and dry-run/simulated flags.

## Foundry Native Actions

Implemented native Action families include:

- GM note or group divider.
- ChatMessage or GM-only log note.
- Delay.
- Wait for GM confirmation.
- Preload Scene.
- View Scene locally as GM.
- Activate Scene for players.
- Set Scene darkness.
- Update allowlisted Scene environment fields.
- Update existing AmbientLight documents.
- Update existing Wall or Door fields.
- Reveal or hide existing Tokens.
- Move existing Tokens.
- Update Token elevation.
- Update Token disposition.
- Create Combat for a Scene.
- Add existing Tokens to Combat.
- Remove configured Combatants from Combat.
- Start Combat.
- End Combat.
- Set Combat round.
- Set Combat turn.
- Pan GM, selected users, or active players by module socket.
- Pause or unpause the game.
- Optional native Playlist cue when enabled in world settings.
- Give Items to Actors or Token actors with GM confirmation.
- Remove or reduce Actor Items with GM confirmation.
- Create Journal handouts with GM confirmation.
- Show existing Journal handouts with GM confirmation.
- Request player rolls in chat.

Item and Journal mutations remain confirmation-required even when authored by imported JSON or an MCP bridge.

## Quick Combat Builders

From selected canvas Tokens, the editor can create:

- Combat setup Beats.
- Reinforcement wave Beats.

Combat setup can add Actions to:

- Bind or activate the Scene.
- Reveal selected Tokens.
- Create Combat.
- Add selected Tokens to Combat.
- Start Combat.

Reinforcement setup can add Actions to:

- Reveal selected Tokens.
- Add selected Tokens to the existing Combat.

## Integration Health

The Director reports integration health for:

- Foundry Native.
- SessionFlow.
- Exalted Scenes.
- Narrator's Jukebox.
- Gambit's FXMaster.
- COTS Character HUD.
- Cinematic Combat Timeline.

Health cards can show:

- Module id.
- Version.
- API detected/not detected.
- API source.
- Capabilities.
- Public API methods.
- Unsupported notes.
- Last error.

## Integration Actions

The module supports integration Actions when a safe public API is detected.

SessionFlow:

- Detects known module ids and public/hook-style APIs.
- Can trigger/open configured SessionFlow content where public methods exist.

Exalted Scenes:

- Detects known module ids and public API namespaces.
- Can broadcast or present supported Scene/cast/audio/slideshow/sequence content when confirmed public APIs exist.

Narrator's Jukebox:

- Detects known public API methods.
- Can play, stop, fade, or trigger supported music, playlist, ambience, preset, and soundboard actions where exposed.

Gambit's FXMaster:

- Detects `FXMASTER.api`.
- Can use supported preset/effect methods such as play, stop, toggle, switch, list, and scene-effect operations where present.

COTS Character HUD:

- Detects the confirmed COTS Character HUD API/socket.
- Can present actors, stop actors, stop all presentations, and use GM speaker pick behavior where supported.

Cinematic Combat Timeline:

- Detects local status/config APIs.
- Current inspected version exposes status/open-config behavior, not confirmed countdown mutation APIs.

## Import And Export

- Export one Sequence.
- Export all Sequences on the current Scene.
- Import Director JSON.
- Expose an AI/MCP authoring context with schema, action catalog, trigger enums, limits, and example JSON.
- Validate encounter JSON through the public API without saving.
- Import encounter JSON through the public API.
- Create or replace a single Sequence through the public API.
- Duplicate imported Sequences by default.
- Preserve reference metadata.
- Reject unsupported future schema versions.
- Reject executable-looking fields.
- Reject absolute filesystem paths.
- Never execute imported data immediately.

## Public API

The module exposes:

```js
const api = game.modules.get("cinematic-encounter-director").api;
```

Available API methods:

- `openDirector(options)`.
- `getJsonSchema()`.
- `getEncounterAuthoringContext()`.
- `readActionTypeCatalog()`.
- `exportEncounterJson(options)`.
- `validateEncounterJson(input)`.
- `importEncounterJson(input, options)`.
- `upsertSequence(sequence, options)`.
- `registerActionProvider(provider)`.
- `registerActionType(actionType)`.
- `validateActionConfig(action, context)`.
- `requestExecution({ sequenceId, beatId, actionId, dryRun, scene })`.
- `evaluateTriggers(scene, context)`.
- `simulateCombatTrigger(eventOrContext, options)`.
- `resetTriggerState(sequenceId, scene)`.
- `readSequenceMetadata(scene)`.
- `subscribe(eventName, callback)`.

Supported hook names include:

- Beat start.
- Action result.
- Beat finish.
- Emergency stop.
- Sequences changed.
- Trigger fired.

## Settings

World settings include:

- Enable Director.
- Permit SessionFlow integration.
- Permit Exalted Scenes integration.
- Permit Narrator's Jukebox integration.
- Permit FXMaster integration.
- Permit COTS Character HUD integration.
- Permit Cinematic Combat Timeline integration.
- Confirm Scene activation.
- Confirm combat-ending and turn-changing Actions.
- Default Beat failure policy.
- Execution-log retention.
- Enable native Playlist fallback.
- Enable automation Triggers.

Client settings include:

- Director window position.
- Director window size.
- Compact mode.
- Director mode.
- Show integration health.
- Show advanced Action details.
- Reduced animation.
- Confirm before running an entire Beat.
- Automatically select next Beat after successful completion.

## Security And Safety

- GM-only module controls.
- No arbitrary JavaScript execution.
- Imported JSON is treated as untrusted data.
- Document mutation uses UUIDs and allowlisted fields.
- External integrations are used only through detected public APIs.
- Dangerous Actions can require confirmation.
- Beat execution uses a lock.
- Trigger execution uses once-state and the same Beat lock.

## Current Limits

- Live Foundry runtime testing is still required after installation.
- Integration support depends on the public APIs exposed by the installed versions of other modules.
- Cinematic Combat Timeline currently appears config/status-only from the inspected API.
- The Action editor covers common fields with forms, but unusual or future provider-specific payloads may still need Advanced JSON.
- Imported references may need manual remapping.
- Player camera pan should be tested carefully on the remote server.

# Remote Server Manual Test Checklist

Run these tests on the remote Foundry VTT v14 server with the D&D 5e system. Record browser console errors, server errors, and each failed expectation.

## Module Lifecycle

- Enable with all integrations active.
- Enable with each integration disabled individually.
- Enable with all optional integrations disabled.
- Reload browser.
- Change Scene.
- Change user.
- Reopen Director.
- Check for duplicate hooks, duplicate windows, or duplicate Scene controls.
- Check browser console.

## Director UI

- Confirm the module reports version 0.1.18.
- Confirm the Director shows Run and Plan mode tabs.
- Switch to Plan mode, close the Director, reopen it, and confirm the client remembers Plan mode.
- Switch back to Run mode and confirm the selected Beat controls are visible.
- Resize the Director narrow and wide.
- Confirm navigation, selected Beat/actions, Integration Health, and Execution Log remain reachable by scrolling.
- Confirm the Beat cue list shows order, name, danger, state, Action count, and Trigger count.
- Confirm selected Beat header shows danger, state, Trigger summary, and Action count.
- Confirm Action rows show plain-language summaries and provider/type/status badges.
- Confirm Integration Health collapses and expands.
- Confirm Execution Log filters work for all, success, warning, failure, Trigger, and rollback.
- Confirm Emergency Stop confirmation explains that it does not undo completed changes.

## Sequence Editing

- Create Sequence.
- Rename Sequence.
- Duplicate Sequence.
- Archive Sequence.
- Delete Sequence with confirmation.
- Add Beats.
- Reorder Beats with move-up and move-down controls.
- Duplicate Beat.
- Delete Beat with confirmation.
- Add Actions.
- Reorder Actions with move-up and move-down controls.
- Disable and re-enable Actions.
- Add quick combat setup Actions from selected canvas Tokens.
- Add reinforcement wave Actions from selected canvas Tokens.
- Edit Beat Triggers with the structured Trigger form.
- Save a Trigger as Select Beat and confirm it remains non-executing.
- Save a Trigger as Run Beat and confirm GM confirmation stays on by default.
- Use Advanced Trigger JSON for an unusual Trigger payload and confirm it persists.
- Export one Sequence.
- Export all Scene Sequences.
- Import exported Sequence.
- Import malformed data.
- Import unsupported schema version.
- Remap missing references after import.

## Native Foundry Actions

- Preload Scene.
- View Scene as GM.
- Activate Scene for players.
- Change darkness.
- Update allowlisted Scene environment fields.
- Enable and disable lights.
- Reveal and hide Tokens.
- Move Tokens.
- Restore Token positions through rollback.
- Open and close doors.
- Add Token groups to Combat.
- Create Combat.
- Start Combat.
- End Combat with confirmation.
- Set round or turn with confirmation.
- Pan GM only.
- Pan selected player.
- Pan all active players.
- Pause and unpause game.
- Use native Playlist fallback only after enabling its setting.
- Configure common native Actions through the structured Action form.
- Use Advanced Config JSON for an unusual native payload and confirm it persists.
- Test missing and deleted targets.
- Test actions targeting the wrong Scene.

## SessionFlow

- Detect module and version.
- Detect public API.
- Enumerate supported content if available.
- Trigger each implemented Action.
- Handle deleted SessionFlow content.
- Handle inactive SessionFlow.
- Confirm no duplicated SessionFlow functionality.
- Configure a SessionFlow Action through the structured integration form.

## Exalted Scenes

- Detect module and version.
- Detect public API.
- Broadcast existing presentation.
- Trigger existing sequence or slideshow if supported.
- Present cast or character content if supported.
- Stop Director-triggered presentation if supported.
- Handle deleted presentation.
- Handle inactive module.
- Confirm no private flags or UI clicking are used.
- Configure an Exalted Scenes Action through the structured integration form.

## Narrator's Jukebox

- Detect module and version.
- Detect public API.
- Play music.
- Fade or transition if supported.
- Stop Director-started music.
- Start and stop ambience.
- Play soundboard cue.
- Stop a Director-started loop.
- Ensure Emergency Stop does not kill unrelated audio.
- Handle deleted track.
- Handle inactive module.
- Configure a Narrator's Jukebox Action through the structured integration form.

## FXMaster

- Detect module and version.
- Detect public API.
- Start and stop particle effect.
- Start and stop filter.
- Trigger preset.
- Handle multiple effect layers.
- Stop only Director-owned effects.
- Test dangerous clear-all confirmation.
- Handle deleted preset.
- Handle inactive module.
- Configure an FXMaster Action through the structured integration form.

## COTS Character HUD

- Detect `game.cotsCharacterHud`.
- Trigger supported presentation.
- Stop supported presentation.
- Fall back to configured GM speaker or selected Token actor when an Action has no Actor UUID.
- Fail safely if no public API exists.
- Confirm no DOM manipulation.
- Configure a Character HUD Action through the structured integration form.

## Cinematic Combat Timeline

- Detect public API if exposed.
- Open countdown configuration through the confirmed API.
- Create countdown only if a future confirmed public API exists.
- Update countdown only if a future confirmed public API exists.
- Reset countdown only if a future confirmed public API exists.
- Disable countdown only if a future confirmed public API exists.
- Remove countdown only if a future confirmed public API exists.
- Fail safely if no countdown mutation API exists.
- Confirm no fake Combatants or initiative changes.
- Configure a Combat Timeline Action through the structured integration form.

## Execution

- Run one Action.
- Run complete Beat.
- Run sequential Actions.
- Run parallel group.
- Use timed delay.
- Cancel delay.
- Use manual wait point.
- Retry failed Action.
- Skip Action.
- Continue after noncritical failure.
- Stop after critical failure.
- Emergency Stop.
- Re-run completed Action deliberately.
- Double-click Run Beat.
- Two GMs click Run simultaneously.
- Authoritative GM disconnects.
- Another GM takes authority after stale timeout.
- Player attempts forged execution request.
- Refresh during execution.
- Change Scene during execution.

## Rollback

- Roll back hidden state.
- Roll back Token position.
- Roll back darkness.
- Roll back light state.
- Roll back door state.
- Stop Director-started native Playlist cue if used.
- Stop Director-started audio through integration API if available.
- Stop Director-started FX through integration API if available.
- Attempt rollback after manual GM change.
- Attempt rollback after target deletion.
- Confirm unsupported rollback is clearly labeled.
- Confirm Emergency Stop does not falsely claim rollback.

## Dry Run

- Validate complete Beat.
- Detect missing target.
- Detect missing integration.
- Detect unsupported API.
- Detect Scene mismatch where applicable.
- Confirm no documents change.
- Confirm no audio plays.
- Confirm no presentation broadcasts.
- Confirm no FX starts.
- Confirm no countdown changes.

## Permissions And Privacy

- GM interface visibility.
- Assistant GM behavior if applicable.
- Trusted player behavior.
- Ordinary player behavior.
- Unauthorized socket requests.
- Hidden Token and Scene information.
- Execution logs do not expose private data.
- Imported JSON cannot execute code.

## Accessibility

- Tab through all controls.
- Activate icon buttons with keyboard.
- Verify visible focus states.
- Verify destructive controls are labeled.
- Verify state is readable without color alone.
- Verify reduced-motion preference is respected.
- Verify text does not overlap at narrow and wide viewport sizes.

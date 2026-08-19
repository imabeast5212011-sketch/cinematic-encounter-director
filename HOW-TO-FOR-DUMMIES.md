# Cinematic Encounter Director: Simple GM Guide

This guide is for running the module at the table without needing to understand the code.

Use it like a cue board:

- **Plan mode** is where you build and edit the encounter.
- **Run mode** is where you validate, run, stop, roll back, and watch the log.
- Build manually first.
- Add Triggers after the manual version works.
- Let Triggers select Beats before you trust them to run Beats.

## First-Time Setup

1. Install or update the module in Foundry.
2. Enable **Cinematic Encounter Director** in Manage Modules.
3. Reload the browser after updating.
4. Open your world as a GM.
5. Open the Scene you want to run.

For v0.1.20, the module should load this runtime:

```text
scripts/runtime-0.1.20/main.js
```

If Foundry still shows an older version, do a full browser reload and restart Foundry if needed.

## What The Words Mean

**Sequence**

The whole encounter plan.

Example: `Bridge Ambush`

**Beat**

One phase, reveal, wave, dramatic moment, or setup step.

Example: `Start combat`, `Wave 2`, `Boss bloodied`

**Action**

One thing the module does when a Beat runs.

Example: reveal Tokens, start Combat, pan the camera, play music, show a HUD card, wait for GM confirmation.

**Trigger**

A condition that watches the fight and selects, runs, or starts a Beat when something happens.

Example: when two enemies are defeated, select the reinforcement Beat.

## The Main Screen

The Director screen has three main areas:

- Left: Sequence and Beat list.
- Middle: selected Beat, controls, and Action cue rows.
- Right: session status, Integration Health, and Execution Log.

Switch to **Plan** when building. Switch to **Run** when players are waiting on you.

## The Safest Workflow

1. Prepare the Scene.
2. Create a Sequence.
3. Add Beats.
4. Add Actions to each Beat.
5. Validate each Beat.
6. Run the encounter manually once in a test Scene.
7. Add Triggers only where they make your life easier.

Do not start with automation. Get the button version working first.

## Build A Basic Combat

This is the best first test.

1. Open the battle Scene.
2. Place the enemy Tokens.
3. Hide enemies that should begin hidden.
4. Select the enemy Tokens on the canvas.
5. Open the Director.
6. Click **Plan**.
7. Click the plus button to create a Sequence.
8. Click **Open Sequence Editor** or the edit button.
9. Click **Bind Current Scene**.
10. Rename the Sequence.
11. Select Beat 1.
12. Click **Combat Setup**.
13. Click **Save Beat**.
14. Close the editor.
15. Switch to **Run**.
16. Click **Validate**.
17. If validation looks good, click **Run Beat**.

The Combat Setup shortcut can add Actions to activate the Scene, reveal selected Tokens, create Combat, add Tokens to Combat, and start Combat.

## Add A Reinforcement Beat

1. Put the reinforcement Tokens on the Scene.
2. Hide them.
3. Select those Tokens.
4. Open the Sequence editor.
5. Click **Add Beat**.
6. Name it something clear, like `Wave 2 Reinforcements`.
7. Click **Reinforcement Wave**.
8. Click **Save Beat**.
9. Return to Run mode and validate the Beat.

When you run that Beat, it can reveal those Tokens and add them to the current Combat.

## Add A Normal Action

1. Open the Sequence editor.
2. Select the Beat.
3. In **Actions**, pick an Action type.
4. Click **Add Action**.
5. Fill out the regular form fields.
6. Use the helper buttons for current Scene, selected Tokens, selected users, current camera view, or Playlist where available.
7. Click **Save Action**.
8. Click **Validate**.

The Action editor now shows normal fields first. Use **Advanced JSON** only for unusual payloads or special provider-specific options.

Good Action names:

- `Reveal rooftop archers`
- `Start phase two music`
- `Wait for villain speech`
- `Set darkness to 80 percent`

Avoid names like `Action 4` or `stuff happens`.

## Good Beat Structure

A clean encounter might look like this:

1. `Setup and start combat`
2. `First enemy drop`
3. `Reinforcements arrive`
4. `Boss bloodied`
5. `Escape or surrender`
6. `Cleanup`

Each Beat should be something you can understand while players are talking.

## Running The Encounter

Use **Run** mode during play.

Common controls:

- Previous Beat: move selection backward.
- Next Beat: move selection forward.
- Validate: check the selected Beat.
- Run Beat: execute the selected Beat.
- Stop: stop the currently running Beat on your GM client.
- Emergency Stop: cancel active Director timers and supported Director-owned output.
- Roll Back: undo the last supported Action if a rollback snapshot exists.
- Reset: clear stored Action results and once-only Trigger fire-state for this Sequence.

Next and Previous only change the selected Beat. They do not run it.

## Validate Before Running

Click **Validate** before running a Beat.

Validation helps catch:

- Missing Tokens.
- Missing Scenes.
- Unsupported integrations.
- Disabled integrations.
- Risky combat changes.
- Bad references.

If validation warns you, read the warning before running.

## What Rollback Does

Rollback can help with:

- Token hidden state.
- Token position.
- Token elevation.
- Token disposition.
- Scene darkness.
- Some Scene environment fields.
- Some light, wall, and door changes.
- Combatants added by the Director.

Rollback does not promise to undo:

- Scene activation.
- Chat messages.
- Combat start or end.
- Combat round or turn changes.
- Pause state.
- External module effects without a confirmed rollback API.

Treat rollback as a safety net, not a time machine.

## What Emergency Stop Does

Emergency Stop:

- Stops active Director timers.
- Cancels current Director execution on your GM client.
- Releases locks where possible.
- Asks supported adapters to stop Director-owned work.

Emergency Stop does not undo completed changes. Use rollback separately when rollback is available.

## Add Triggers Safely

Put a Trigger on the Beat you want to happen.

Example: if Beat 2 should become selected after two enemies die, put the Trigger on Beat 2.

The safest Trigger setup is:

- Result: **Select Beat**.
- Once only: on.
- Confirm run: on for anything that runs automatically.

Only switch a Trigger to **Run Beat** after you have tested it.

## Add An Enemy Count Trigger

Use this for waves, phase changes, or morale breaks.

1. Open the Sequence editor.
2. Select the Beat that should happen next.
3. Click **Enemy Count**.
4. Set **Count** to the number of defeated enemies needed.
5. Set **Result** to **Select Beat** while testing.
6. Click **Save Beat**.

The Trigger will watch hostile combatants in the current Combat.

## Add A Boss HP Trigger

Use this for phase changes.

1. Select the boss Token on the canvas.
2. Open the Sequence editor.
3. Select the phase-change Beat.
4. Click **HP 50%**.
5. Change the threshold if needed.
6. Use **Percent** or **Hit points** for HP Mode.
7. Click **Save Beat**.

## Add An Ally Down Trigger

Use this for rescues, panic moments, villain reactions, or fail-forward scenes.

1. Select the ally Token if you want a specific ally watched.
2. Select the Beat you want.
3. Click **Ally Down**.
4. Click **Save Beat**.

If no Token is selected, the Trigger watches for a friendly combatant being defeated.

## Prevent Trigger Accidents

Use these defaults:

- Keep **Once only** checked.
- Keep **Result** on **Select Beat** while testing.
- Keep **Confirm run** checked for Run Beat or Start Sequence.
- Validate the Beat before the session.
- Do not add a new Trigger while its condition is already true unless you want it to fire soon.
- Do not press **Reset** unless you want once-only Triggers to be able to fire again.

Once a once-only Trigger fires, the module records that in the Scene. More HP or combat updates should not fire the same Trigger again unless its state is reset or the Trigger is replaced.

## Use Integrations

Look at **Integration Health**.

**Ready** means the Director found enough public API to use that module.

**Detected only** means the Director sees the module, but did not confirm a safe usable API for that Action.

**Config only** means the module exposes status or configuration behavior, but not enough to drive encounter cues.

To add an integration Action:

1. Open the Sequence editor.
2. Select a Beat.
3. Choose the integration Action from the Action dropdown.
4. Click **Add Action**.
5. Fill the integration fields that apply.
6. Use Advanced JSON only when a provider needs a field not shown in the form.
7. Save and validate.

## Good First Trigger Test

1. Make a test Scene.
2. Add two hostile enemy Tokens.
3. Create a Sequence.
4. Beat 1: add Combat Setup.
5. Beat 2: add a GM note Action named `Trigger worked`.
6. Put an Enemy Count Trigger on Beat 2 with Count `1` and Result `Select Beat`.
7. Run Beat 1.
8. Defeat one enemy.
9. Confirm the Director selects Beat 2.
10. Manually run Beat 2.

After that works, test **Run Beat** with confirmation on.

## AI-Written Encounters

Another AI can write encounters as Director JSON.

The simple rule: have the AI use `AI-ENCOUNTER-JSON-GUIDE.md`, then import the JSON from the Director. If the AI is connected through Shadowbridge or another Foundry bridge, it can ask the live module for the exact contract:

```js
const api = game.modules.get("cinematic-encounter-director").api;
const context = await api.getEncounterAuthoringContext();
```

The AI should not guess real Token, Scene, Actor, sound, or external module ids. If it does not know them, it should leave them blank and write a GM note telling you what to map.

Never import AI JSON and run it blindly:

1. Import the JSON.
2. Open the Sequence.
3. Check every Beat.
4. Remap missing Scene, Token, Actor, audio, or integration references.
5. Validate the Beat.
6. Dry-run if possible.
7. Run it only after it makes sense.

## Common Problems

The Director does not open:

- Make sure you are GM.
- Make sure the module is enabled.
- Reload the browser.

My Beat will not run:

- Click **Validate**.
- Check the Execution Log.
- Check missing Token, Scene, or integration references.

My Trigger does not fire:

- Make sure automation Triggers are enabled in module settings.
- Make sure the Beat was saved after editing the Trigger.
- Make sure the Sequence is bound to the current Scene.
- Make sure the enemy Token is hostile if using Enemy Count.
- Make sure the Token is in Combat.
- Make sure the combatant is marked defeated or at 0 HP.
- Make sure the Trigger has not already fired once.

An integration Action is missing or unavailable:

- Check Integration Health.
- Make sure the other module is active.
- If it says **Detected only**, the Director may not have a confirmed public API for that module feature.

The UI still shows an old version:

- Do a full browser reload.
- Restart Foundry if needed.
- Confirm the module manifest points at `scripts/runtime-0.1.20/main.js`.

## Best Habits

- Name every Beat clearly.
- Name every Action like a cue.
- Keep Beats short.
- Validate before the session.
- Use Triggers to select Beats before using them to run Beats.
- Put dangerous effects behind confirmation.
- Test integrations before game night.
- Keep the Execution Log visible when debugging.
- Make one small dummy encounter to test big automation ideas.

## Tiny Example Encounter

Sequence: `Bridge Ambush`

Beat 1: `Start the ambush`

- Reveal hidden bandits.
- Create Combat.
- Add bandits to Combat.
- Start Combat.

Beat 2: `Archers join`

- Reveal rooftop archers.
- Add archers to Combat.
- Pan the GM camera to the rooftops.

Trigger on Beat 2:

- Type: Enemy defeated count.
- Count: 2.
- Result: Select Beat.
- Once only: checked.

Beat 3: `Boss flees`

- Show GM note.
- Move or reveal the escape route.
- Play escape music or ambience if configured.

Trigger on Beat 3:

- Type: HP threshold.
- Watched Token: boss Token.
- HP Mode: Percent.
- Threshold: 25.
- Result: Select Beat.
- Once only: checked.

That is enough to run a staged tactical encounter without letting automation take the wheel away from the GM.

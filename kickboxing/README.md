# Kickboxing Physics Prototype (Godot 4.3)

First-person kickboxing sim. Phase 1: a flat arena, a heavy bag, and a procedural player rig
to tune the feel/physics of the controls. Open this folder in Godot 4.3+ and press F5.

## Controls
| Input | Action |
|---|---|
| Mouse, no buttons | Sway / slip / lean (springs back to centre) |
| Ctrl | Duck. Ctrl + mouse X = roll under |
| RMB / LMB | Punch with right / left hand. Push mouse forward = extend, mouse X = hook arc |
| Ctrl + RMB/LMB | Body shot (default is head height) |
| RMB + LMB | Block head. Add Ctrl = block body |
| Shift + RMB/LMB | Kick with right/left leg (mid). + Ctrl = low kick, + Q = high kick |
| Shift alone | Raise leg to check; mouse X left/right picks the leg |
| WASD | Move. C = third-person debug camera (see body mechanics). R = reset bag. Esc = free mouse |

## How it works
- `scripts/player.gd` - kinematic rig: Pelvis (sway/duck/lean) -> HipYaw (kick rotation) -> Torso (punch twist).
  Camera hangs off the pelvis so it inherits lean/duck but not twist. Two-bone IK (`limb.gd`) draws arms and legs.
- Punch/kick extension is driven by mouse-forward pixels; hit speed = how fast you flick.
- Body locks: punches add torso twist + lunge; kicks add hip rotation, back-lean/roll away for high kicks,
  and the support foot stays planted in world space (it only re-steps when the body moves/turns).
- Hits: fist/foot `Area3D` -> `apply_impulse(velocity * effective_mass)` on the bag; HUD prints limb, zone, speed.

## Next
Blender low-poly fighter (same skeleton proportions), opponent with hurtboxes tied to the sway/duck head
position, blocks/checks that absorb or deflect impacts, stamina/damage.

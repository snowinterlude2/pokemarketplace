class_name Player
extends CharacterBody3D
## First-person kickboxer. Fully procedural kinematic rig (no animation clips):
## mouse input drives limb extension / arc / body lean, 2-bone IK draws the limbs,
## and fists/feet hit physics bodies with impulse = effective_mass * limb_velocity.
##
## Limb index: 0 = left (LMB), 1 = right (RMB).
##
## Controls
##   Mouse (no buttons)  sway / slip / lean.   Ctrl alone = duck, Ctrl + mouse X = roll under
##   RMB or LMB          punch with that hand. Push mouse forward = extend, mouse X = hook/arc
##   Ctrl + punch        body shot (otherwise head height)
##   RMB + LMB           block head.  + Ctrl = block body
##   Shift + RMB / LMB   kick with that leg. Mid height; + Ctrl = low kick; + Q = high kick
##   Shift (no buttons)  raise leg to check. Mouse X left/right picks the leg
##   WASD move, C toggle third-person debug camera, Esc release mouse, R reset bag

signal strike_landed(info: Dictionary)

const SHOULDER_X := 0.22
const SHOULDER_Y := 0.52
const HEAD_LOCAL := Vector3(0.0, 0.70, -0.06)
const HIP_X := 0.10
const ARM_U := 0.30
const ARM_L := 0.27 # elbow -> wrist; the fist adds ~0.05 m of reach
const LEG_U := 0.45
const LEG_L := 0.45
const PELVIS_STAND_Y := 0.88
const ANKLE_Y := 0.07
const STANCE_X := 0.17
const STANCE_Z := [-0.28, 0.12] # left foot forward (orthodox)

const PUNCH_GAIN := 0.0045 # extension per mouse pixel
const KICK_GAIN := 0.0035
const ARC_GAIN := 0.0040 # radians per mouse pixel
const RETRACT := 2.6 # extension lost per second when not pushing
const KICK_PITCH_LOW := -0.22 # shin lands on the thigh (~0.6 m)
const KICK_PITCH_MID := 0.55 # ribs / liver (~1.3 m)
const KICK_PITCH_HIGH := 1.25 # head (~1.7 m)
const FIST_LEN := 0.05 # wrist -> knuckles
const HAND_MASS := 4.0 # effective kg behind a punch
const FOOT_MASS := 9.0 # effective kg behind a kick

@export var target: Node3D
@export var mouse_sens := 1.0
@export var move_speed := 2.2

var status := ""

var _mouse := Vector2.ZERO
var _third_person := false

var pelvis: Node3D
var hip_yaw: Node3D
var torso: Node3D
var head: Node3D
var cam: Camera3D
var chase_cam: Camera3D
var _body_only: Array[Node3D] = [] # meshes hidden in first person (head, torso, shoulders)

var _arm_up: Array[Node3D] = []
var _arm_lo: Array[Node3D] = []
var _fists: Array[Node3D] = []
var _delts: Array[Node3D] = []
var _elbows: Array[Node3D] = []
var _knees: Array[Node3D] = []
var _leg_up: Array[Node3D] = []
var _leg_lo: Array[Node3D] = []
var _feet: Array[Node3D] = []
var _hand_area: Array[Area3D] = []
var _foot_area: Array[Area3D] = []

# hands
var hand_ext: Array[float] = [0.0, 0.0]
var hand_arc: Array[float] = [0.0, 0.0]
var hand_pitch: Array[float] = [0.0, 0.0]
var hand_active: Array[bool] = [false, false]
var hand_pos: Array[Vector3] = [Vector3.ZERO, Vector3.ZERO] # torso space
var hand_world: Array[Vector3] = [Vector3.ZERO, Vector3.ZERO]
var hand_vel: Array[Vector3] = [Vector3.ZERO, Vector3.ZERO]
var _hand_prev: Array[Vector3] = [Vector3.ZERO, Vector3.ZERO]

# legs
var leg_ext: Array[float] = [0.0, 0.0]
var leg_arc: Array[float] = [0.0, 0.0]
var leg_pitch: Array[float] = [KICK_PITCH_MID, KICK_PITCH_MID]
var check_t: Array[float] = [0.0, 0.0]
var foot_anchor: Array[Vector3] = [Vector3.ZERO, Vector3.ZERO] # planted position (world)
var foot_pos: Array[Vector3] = [Vector3.ZERO, Vector3.ZERO] # actual foot (world)
var foot_world: Array[Vector3] = [Vector3.ZERO, Vector3.ZERO]
var foot_vel: Array[Vector3] = [Vector3.ZERO, Vector3.ZERO]
var _foot_prev: Array[Vector3] = [Vector3.ZERO, Vector3.ZERO]
var _foot_stepping: Array[bool] = [false, false]
var _check_side := 0

# body state
var sway := Vector2.ZERO # x lateral (m), y fore/aft (m, + = back)
var sway_s := Vector2.ZERO # smoothed
var duck := 0.0
var _hit_cd := {}


func _ready() -> void:
	_build_rig()
	for i in 2:
		var side := -1.0 if i == 0 else 1.0
		var z: float = STANCE_Z[i]
		foot_anchor[i] = global_transform * Vector3(side * STANCE_X, ANKLE_Y, z)
		foot_pos[i] = foot_anchor[i]
		_foot_prev[i] = foot_pos[i]
		hand_pos[i] = Vector3(side * 0.17, 0.60, -0.32)


func _input(event: InputEvent) -> void:
	var captured := Input.mouse_mode == Input.MOUSE_MODE_CAPTURED
	if event is InputEventMouseMotion and captured:
		_mouse += (event as InputEventMouseMotion).relative
	elif event is InputEventMouseButton and (event as InputEventMouseButton).pressed and not captured:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	elif event is InputEventKey and (event as InputEventKey).pressed and not (event as InputEventKey).echo:
		var key := (event as InputEventKey).keycode
		if key == KEY_ESCAPE:
			Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
		elif key == KEY_C:
			_set_third_person(not _third_person)


func _set_third_person(on: bool) -> void:
	_third_person = on
	for m in _body_only:
		m.visible = on
	if on:
		chase_cam.make_current()
	else:
		cam.make_current()


# ----------------------------------------------------------------- movement
func _physics_process(delta: float) -> void:
	if target:
		var to := target.global_position - global_position
		to.y = 0.0
		if to.length() > 0.1:
			var want := atan2(-to.x, -to.z)
			rotation.y = lerp_angle(rotation.y, want, 1.0 - exp(-8.0 * delta))

	var captured := Input.mouse_mode == Input.MOUSE_MODE_CAPTURED
	var inp := Vector2.ZERO
	if captured:
		inp.x = float(Input.is_key_pressed(KEY_D)) - float(Input.is_key_pressed(KEY_A))
		inp.y = float(Input.is_key_pressed(KEY_S)) - float(Input.is_key_pressed(KEY_W))
	var committed := maxf(maxf(hand_ext[0], hand_ext[1]), maxf(leg_ext[0], leg_ext[1]))
	var speed := move_speed * (1.0 - 0.7 * clampf(committed * 2.0, 0.0, 1.0)) * (1.0 - 0.6 * duck)
	var dir := global_basis * Vector3(inp.x, 0.0, inp.y)
	dir.y = 0.0
	if dir.length() > 0.01:
		dir = dir.normalized()
	velocity.x = move_toward(velocity.x, dir.x * speed, 12.0 * delta)
	velocity.z = move_toward(velocity.z, dir.z * speed, 12.0 * delta)
	velocity.y = 0.0 if is_on_floor() else velocity.y - 9.8 * delta
	move_and_slide()


# ------------------------------------------------------------------- rig
func _drive(ext: float, fwd_px: float, gain: float, delta: float) -> float:
	ext += fwd_px * gain
	if fwd_px < 1.0:
		ext -= RETRACT * delta
	return clampf(ext, 0.0, 1.0)


func _process(delta: float) -> void:
	delta = maxf(delta, 0.0001)
	var mouse := _mouse * mouse_sens
	_mouse = Vector2.ZERO
	var captured := Input.mouse_mode == Input.MOUSE_MODE_CAPTURED
	var shift := captured and Input.is_key_pressed(KEY_SHIFT)
	var ctrl := captured and Input.is_key_pressed(KEY_CTRL)
	var high := captured and Input.is_key_pressed(KEY_Q)
	var btn: Array[bool] = [
		captured and Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT),
		captured and Input.is_mouse_button_pressed(MOUSE_BUTTON_RIGHT),
	]
	var any_btn := btn[0] or btn[1]
	var both := btn[0] and btn[1]
	var punch_mode := (not shift) and any_btn and (not both)
	var block_mode := (not shift) and both
	var kick_mode := shift and any_btn
	var check_mode := shift and (not any_btn)
	var sway_mode := not (punch_mode or kick_mode or check_mode)

	for _k in hit_cd_keys():
		_hit_cd[_k] = float(_hit_cd[_k]) - delta

	# ---- limb drive from mouse
	for i in 2:
		var punching := punch_mode and btn[i]
		hand_active[i] = punching
		if punching:
			hand_ext[i] = _drive(hand_ext[i], -mouse.y, PUNCH_GAIN, delta)
			hand_arc[i] = clampf(hand_arc[i] + mouse.x * ARC_GAIN, -0.9, 0.9)
			if hand_ext[i] < 0.3:
				hand_pitch[i] = lerpf(hand_pitch[i], -0.45 if ctrl else 0.26, 1.0 - exp(-14.0 * delta))
			if hand_ext[i] < 0.05:
				hand_arc[i] = move_toward(hand_arc[i], 0.0, 1.5 * delta)
		else:
			hand_ext[i] = move_toward(hand_ext[i], 0.0, 6.0 * delta)
			hand_arc[i] = move_toward(hand_arc[i], 0.0, 3.0 * delta)

		var kicking := kick_mode and btn[i]
		if kicking:
			leg_ext[i] = _drive(leg_ext[i], -mouse.y, KICK_GAIN, delta)
			leg_arc[i] = clampf(leg_arc[i] + mouse.x * ARC_GAIN, -0.9, 0.9)
			if leg_ext[i] < 0.3:
				var want := KICK_PITCH_HIGH if high else (KICK_PITCH_LOW if ctrl else KICK_PITCH_MID)
				leg_pitch[i] = lerpf(leg_pitch[i], want, 1.0 - exp(-12.0 * delta))
			if leg_ext[i] < 0.05:
				leg_arc[i] = move_toward(leg_arc[i], 0.0, 1.5 * delta)
		else:
			leg_ext[i] = move_toward(leg_ext[i], 0.0, 5.0 * delta)
			leg_arc[i] = move_toward(leg_arc[i], 0.0, 3.0 * delta)

	# ---- leg check selection
	if check_mode:
		if mouse.x < -3.0:
			_check_side = 0
		elif mouse.x > 3.0:
			_check_side = 1
	for i in 2:
		var want_c := 1.0 if (check_mode and _check_side == i) else 0.0
		check_t[i] = move_toward(check_t[i], want_c, 7.0 * delta)

	# ---- duck + sway (dodging)
	var duck_target := 0.0
	if ctrl:
		if not any_btn and not shift:
			duck_target = 1.0
		elif block_mode:
			duck_target = 0.35
		elif punch_mode:
			duck_target = 0.25
	duck = lerpf(duck, duck_target, 1.0 - exp(-9.0 * delta))
	var lim_x := 0.30 + duck * 0.25
	if sway_mode:
		sway.x = clampf(sway.x + mouse.x * 0.0020, -lim_x, lim_x)
		sway.y = clampf(sway.y + mouse.y * 0.0016, -0.20, 0.28)
	var ret := 5.0
	if sway_mode:
		ret = 1.6 if mouse.length() < 0.5 else 0.0
	sway = sway.lerp(Vector2.ZERO, 1.0 - exp(-ret * delta))
	sway_s = sway_s.lerp(sway, 1.0 - exp(-14.0 * delta))

	# ---- whole-body coupling: lunge, torso twist, hip rotation, lean
	var lunge := 0.0
	var twist := 0.0
	var hip_turn := 0.0
	var lean_back := 0.0
	var lean_roll := 0.0
	var drop := 0.0
	var rise := 0.0
	for i in 2:
		var side := -1.0 if i == 0 else 1.0
		var hook := minf(absf(hand_arc[i]) / 0.5, 1.0)
		lunge = maxf(lunge, hand_ext[i] * 0.18)
		twist += side * hand_ext[i] * (0.20 + 0.35 * hook)
		var round_k := 0.25 + 0.75 * minf(absf(leg_arc[i]) / 0.5, 1.0)
		hip_turn += side * leg_ext[i] * 0.75 * round_k
		var hf := maxf(0.0, leg_pitch[i]) / KICK_PITCH_HIGH
		lean_back += leg_ext[i] * (0.05 + 0.30 * hf)
		lean_roll += side * leg_ext[i] * hf * 0.30
		rise += leg_ext[i] * hf * 0.05 # come up on the ball of the support foot
		lunge = maxf(lunge, leg_ext[i] * 0.06)
		if leg_pitch[i] < 0.0:
			drop += leg_ext[i] * 0.06

	var pelvis_y := PELVIS_STAND_Y - duck * 0.42 - absf(sway_s.x) * 0.20 - drop + rise
	pelvis.position = Vector3(sway_s.x, pelvis_y, sway_s.y - lunge)
	pelvis.rotation = Vector3(sway_s.y + lean_back - duck * 0.35, 0.0, -sway_s.x * 1.1 + lean_roll)
	hip_yaw.rotation.y = lerp_angle(hip_yaw.rotation.y, hip_turn, 1.0 - exp(-18.0 * delta))
	torso.rotation.y = lerp_angle(torso.rotation.y, twist, 1.0 - exp(-22.0 * delta))
	head.position = HEAD_LOCAL
	head.rotation = Vector3(-pelvis.rotation.x * 0.4, 0.0, -pelvis.rotation.z * 0.4)
	if _third_person:
		chase_cam.look_at(global_position + Vector3(0.0, 1.0, -0.2), Vector3.UP)

	_update_arms(delta, block_mode, ctrl)
	_update_legs(delta)
	_update_hitboxes(delta)

	var mode := "SWAY"
	if punch_mode:
		mode = "PUNCH " + ("BODY" if ctrl else "HEAD")
	elif block_mode:
		mode = "BLOCK " + ("BODY" if ctrl else "HEAD")
	elif kick_mode:
		mode = "KICK " + ("HIGH" if high else ("LOW" if ctrl else "MID"))
	elif check_mode:
		mode = "CHECK " + ("L" if _check_side == 0 else "R") + " leg"
	elif ctrl:
		mode = "DUCK / ROLL"
	status = "%s   sway %+.2f m  duck %.2f" % [mode, sway_s.x, duck]


func hit_cd_keys() -> Array:
	return _hit_cd.keys()


func _update_arms(delta: float, block_mode: bool, ctrl: bool) -> void:
	for i in 2:
		var side := -1.0 if i == 0 else 1.0
		var sh := Vector3(side * SHOULDER_X, SHOULDER_Y, 0.0)
		var guard := Vector3(side * 0.17, 0.60, -0.32)
		var tgt := guard
		var pole := Vector3(side * 0.6, -1.0, 0.2)
		var k := 16.0
		if block_mode:
			if ctrl:
				tgt = Vector3(side * 0.14, 0.30, -0.24)
				pole = Vector3(side * 0.1, -1.0, 0.6)
			else:
				tgt = Vector3(side * 0.07, 0.76, -0.30)
				pole = Vector3(side * 0.4, -1.0, 0.3)
		if hand_ext[i] > 0.001:
			var hook := minf(absf(hand_arc[i]) / 0.5, 1.0)
			var yaw := side * 0.10 - hand_arc[i]
			var dir_local := (Basis(Vector3.UP, yaw) * Basis(Vector3.RIGHT, hand_pitch[i])) * Vector3(0.0, 0.0, -1.0)
			var ext_w := torso.to_global(sh) + global_basis * dir_local * ((ARM_U + ARM_L) * 0.97)
			tgt = guard.lerp(torso.to_local(ext_w), smoothstep(0.0, 1.0, hand_ext[i]))
			pole = Vector3(side * (0.5 + hook), -1.0 + hook, 0.1)
			k = 40.0
		hand_pos[i] = hand_pos[i].lerp(tgt, 1.0 - exp(-k * delta))
		var res: Array = Limb.solve(sh, hand_pos[i], ARM_U, ARM_L, pole)
		var mid: Vector3 = res[0]
		var tip: Vector3 = res[1]
		Limb.place(_arm_up[i], sh, mid)
		Limb.place(_arm_lo[i], mid, tip)
		_delts[i].position = sh
		_elbows[i].position = mid
		# fist follows the forearm, knuckles forward, palm down
		var fdir := (tip - mid).normalized()
		var fup := Vector3.UP if absf(fdir.dot(Vector3.UP)) < 0.95 else Vector3.BACK
		_fists[i].transform = Transform3D(Basis.looking_at(fdir, fup), tip)
		hand_world[i] = torso.to_global(tip + fdir * FIST_LEN)


func _update_legs(delta: float) -> void:
	for i in 2:
		var side := -1.0 if i == 0 else 1.0
		var hip_l := Vector3(side * HIP_X, 0.0, 0.0)
		var hip_w := hip_yaw.to_global(hip_l)
		var z: float = STANCE_Z[i]
		var home := global_transform * Vector3(side * STANCE_X, ANKLE_Y, z)
		var busy := leg_ext[i] > 0.01 or check_t[i] > 0.01
		var other_busy := leg_ext[1 - i] > 0.01 or check_t[1 - i] > 0.01
		# planted foot: only re-step when the body has moved/turned away and nobody is kicking
		if not busy and not other_busy:
			var d := foot_anchor[i].distance_to(home)
			if d > 0.30:
				_foot_stepping[i] = true
			elif d < 0.02:
				_foot_stepping[i] = false
			if _foot_stepping[i]:
				foot_anchor[i] = foot_anchor[i].lerp(home, 1.0 - exp(-10.0 * delta))

		var tgt_w := foot_anchor[i]
		var dir_hy := Vector3(0.0, 0.0, -1.0)
		var wk := smoothstep(0.0, 0.25, leg_ext[i])
		if wk > 0.0:
			var yaw := side * 0.05 - leg_arc[i]
			var dir_local := (Basis(Vector3.UP, yaw) * Basis(Vector3.RIGHT, leg_pitch[i])) * Vector3(0.0, 0.0, -1.0)
			var dist := 0.35 + (0.87 - 0.35) * leg_ext[i]
			var kick_w := hip_w + global_basis * dir_local * dist
			kick_w.y = maxf(kick_w.y, ANKLE_Y)
			tgt_w = tgt_w.lerp(kick_w, wk)
			dir_hy = dir_hy.lerp(hip_yaw.global_basis.inverse() * (global_basis * dir_local), wk).normalized()
		if check_t[i] > 0.01:
			var chk_w := global_transform * Vector3(side * 0.14, 0.45, -0.36)
			tgt_w = tgt_w.lerp(chk_w, smoothstep(0.0, 1.0, check_t[i]))
		var k := 34.0 if leg_ext[i] > 0.01 else 14.0
		foot_pos[i] = foot_pos[i].lerp(tgt_w, 1.0 - exp(-k * delta))

		var pole := Vector3(side * 0.3, 0.1, -1.0)
		if wk > 0.0:
			pole = Vector3(side * (0.3 + 0.5 * wk), 0.3 * wk, -0.7)
		var res: Array = Limb.solve(hip_l, hip_yaw.to_local(foot_pos[i]), LEG_U, LEG_L, pole)
		var knee: Vector3 = res[0]
		var tip: Vector3 = res[1]
		Limb.place(_leg_up[i], hip_l, knee)
		Limb.place(_leg_lo[i], knee, tip)
		_knees[i].position = knee
		_feet[i].position = tip
		_feet[i].basis = Basis.looking_at(dir_hy, Vector3.UP)
		foot_world[i] = hip_yaw.to_global(tip)


func _update_hitboxes(delta: float) -> void:
	var a := 1.0 - exp(-30.0 * delta)
	for i in 2:
		_hand_area[i].global_position = hand_world[i]
		_foot_area[i].global_position = foot_world[i]
		hand_vel[i] = hand_vel[i].lerp((hand_world[i] - _hand_prev[i]) / delta, a)
		foot_vel[i] = foot_vel[i].lerp((foot_world[i] - _foot_prev[i]) / delta, a)
		_hand_prev[i] = hand_world[i]
		_foot_prev[i] = foot_world[i]


func _on_hit(body: Node3D, kind: String, i: int) -> void:
	if not (body is RigidBody3D):
		return
	var key := kind + str(i)
	if float(_hit_cd.get(key, 0.0)) > 0.0:
		return
	var is_hand := kind == "hand"
	var vel: Vector3 = hand_vel[i] if is_hand else foot_vel[i]
	var pos: Vector3 = hand_world[i] if is_hand else foot_world[i]
	var spd := vel.length()
	if spd < 1.0:
		return
	var imp := vel * (HAND_MASS if is_hand else FOOT_MASS)
	var rb := body as RigidBody3D
	rb.apply_impulse(imp, pos - rb.global_position)
	_hit_cd[key] = 0.3
	var zone := "BODY"
	if rb.has_meta("part"):
		zone = Dummy.zone_for(rb, pos)
	elif pos.y > 1.45:
		zone = "HEAD"
	elif pos.y < 0.70:
		zone = "LEG"
	var limb_name := ("L " if i == 0 else "R ") + ("hand" if is_hand else "leg")
	strike_landed.emit({"limb": limb_name, "speed": spd, "impulse": imp.length(), "zone": zone})


# ------------------------------------------------------------- construction
func _mat(c: Color) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.roughness = 0.8
	return m


func _capsule(radius: float, length: float, c: Color, parent: Node3D) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var cm := CapsuleMesh.new()
	cm.radius = radius
	cm.height = length + radius * 2.0
	mi.mesh = cm
	mi.material_override = _mat(c)
	parent.add_child(mi)
	return mi


## Tapered limb segment for Limb.place(): r_a at the start joint, r_b at the end joint.
func _taper(r_a: float, r_b: float, length: float, c: Color, parent: Node3D) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.bottom_radius = r_a
	cm.top_radius = r_b
	cm.height = length
	cm.radial_segments = 12
	cm.rings = 1
	mi.mesh = cm
	mi.material_override = _mat(c)
	parent.add_child(mi)
	return mi


func _sphere(radius: float, c: Color, parent: Node3D) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = radius
	sm.height = radius * 2.0
	sm.radial_segments = 16
	sm.rings = 8
	mi.mesh = sm
	mi.material_override = _mat(c)
	parent.add_child(mi)
	return mi


func _box(size: Vector3, c: Color, parent: Node3D, pos := Vector3.ZERO) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	mi.mesh = bm
	mi.material_override = _mat(c)
	mi.position = pos
	parent.add_child(mi)
	return mi


## MMA glove: open-finger fist with padding over the knuckles and back of the hand, wrist wrap.
## -Z = punching direction, +Y = back of the hand. `inward` is +1/-1: which local X the thumb sits on.
func _make_fist(skin: Color, glove: Color, parent: Node3D, inward: float) -> Node3D:
	var f := Node3D.new()
	parent.add_child(f)
	var parts := [
		[Vector3(0.080, 0.062, 0.085), skin, Vector3(0.0, -0.004, -0.040)], # fist
		[Vector3(0.090, 0.046, 0.050), glove, Vector3(0.0, 0.010, -0.066)], # knuckle pad
		[Vector3(0.084, 0.030, 0.070), glove, Vector3(0.0, 0.026, -0.036)], # back-of-hand pad
		[Vector3(0.026, 0.026, 0.050), skin, Vector3(inward * 0.040, -0.018, -0.052)], # thumb
	]
	for pt in parts:
		var mi := _sphere(0.5, pt[1], f)
		mi.scale = pt[0]
		mi.position = pt[2]
	var wrap := _taper(0.034, 0.036, 0.045, glove.lightened(0.15), f)
	wrap.rotation = Vector3(-PI * 0.5, 0.0, 0.0)
	return f


func _make_foot(skin: Color, parent: Node3D) -> Node3D:
	var f := Node3D.new()
	parent.add_child(f)
	_box(Vector3(0.090, 0.070, 0.17), skin, f, Vector3(0.0, -0.025, -0.02)) # heel + arch
	_box(Vector3(0.088, 0.040, 0.08), skin, f, Vector3(0.0, -0.040, -0.14)) # toes
	return f


func _make_area(radius: float, kind: String, i: int) -> Area3D:
	var ar := Area3D.new()
	ar.top_level = true
	ar.collision_layer = 0
	ar.collision_mask = 1
	var cs := CollisionShape3D.new()
	var sp := SphereShape3D.new()
	sp.radius = radius
	cs.shape = sp
	ar.add_child(cs)
	add_child(ar)
	ar.body_entered.connect(_on_hit.bind(kind, i))
	return ar


func _build_rig() -> void:
	var skin := Color(0.85, 0.65, 0.5)
	var glove := Color(0.08, 0.08, 0.09)
	var shorts := Color(0.1, 0.1, 0.4)

	var col := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.3
	cap.height = 1.8
	col.shape = cap
	col.position = Vector3(0.0, 0.9, 0.0)
	add_child(col)

	pelvis = Node3D.new()
	add_child(pelvis)
	hip_yaw = Node3D.new()
	pelvis.add_child(hip_yaw)
	torso = Node3D.new()
	hip_yaw.add_child(torso)
	head = Node3D.new()
	pelvis.add_child(head)

	# hips / shorts
	var hips := _sphere(0.17, shorts, hip_yaw)
	hips.scale = Vector3(1.0, 0.75, 0.68)
	hips.position = Vector3(0.0, -0.02, 0.0)

	# torso: abdomen, chest, neck, head (third-person only)
	var abdomen := _capsule(0.13, 0.12, skin, torso)
	abdomen.scale = Vector3(1.05, 1.0, 0.78)
	abdomen.position = Vector3(0.0, 0.14, 0.0)
	var chest := _capsule(0.16, 0.16, skin, torso)
	chest.scale = Vector3(1.18, 1.0, 0.72)
	chest.position = Vector3(0.0, 0.38, 0.0)
	var neck := _taper(0.055, 0.05, 0.14, skin, torso)
	neck.position = Vector3(0.0, 0.60, -0.02)
	var hm := _sphere(0.105, skin, head)
	hm.scale = Vector3(0.92, 1.1, 1.0)
	hm.position = Vector3(0.0, 0.0, 0.06)
	_body_only.append_array([abdomen, chest, neck, hm])

	cam = Camera3D.new()
	cam.fov = 80.0
	cam.near = 0.02
	head.add_child(cam)
	cam.make_current()

	chase_cam = Camera3D.new()
	chase_cam.fov = 60.0
	add_child(chase_cam)
	chase_cam.position = Vector3(2.4, 1.3, -0.3)

	for i in 2:
		_arm_up.append(_taper(0.050, 0.040, ARM_U, skin, torso))
		_arm_lo.append(_taper(0.040, 0.030, ARM_L, skin, torso))
		var delt := _sphere(0.058, skin, torso)
		_delts.append(delt)
		_body_only.append(delt)
		_elbows.append(_sphere(0.041, skin, torso))
		_fists.append(_make_fist(skin, glove, torso, 1.0 if i == 0 else -1.0))

		_leg_up.append(_taper(0.085, 0.058, LEG_U, skin, hip_yaw))
		var calf := _taper(0.056, 0.038, LEG_L, skin, hip_yaw)
		var bulge := _capsule(0.058, 0.10, skin, calf) # calf muscle, upper half of the shin
		bulge.position = Vector3(0.0, -0.08, 0.0)
		bulge.scale = Vector3(1.0, 1.0, 1.0)
		_leg_lo.append(calf)
		_knees.append(_sphere(0.056, skin, hip_yaw))
		_feet.append(_make_foot(skin, hip_yaw))

		_hand_area.append(_make_area(0.065, "hand", i))
		_foot_area.append(_make_area(0.13, "foot", i))

	for m in _body_only:
		m.visible = false

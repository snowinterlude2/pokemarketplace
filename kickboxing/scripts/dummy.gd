class_name Dummy
extends Node3D
## Humanoid training dummy: jointed rigid-body parts (head, chest, abdomen, pelvis, arms, legs)
## held in an orthodox guard by spring "muscles". Hits knock parts around and they spring back.
## The pelvis is sprung to an invisible base so the dummy rocks and recovers instead of falling.
##
## Built facing +Z (towards the player when the dummy stands at -Z). Its right side is -X.

const SKIN := Color(0.72, 0.60, 0.50)
const SHORTS := Color(0.55, 0.08, 0.08)
const MARK := Color(1.0, 0.55, 0.1)

## Spring stiffness (1/s^2) and damping (1/s) per part, pulling it back to its pose
## relative to its parent part. Higher = stiffer, harder to move.
const SPRING := {
	"pelvis": [400.0, 34.0],
	"abdomen": [320.0, 30.0],
	"chest": [300.0, 28.0],
	"head": [180.0, 18.0],
	"upper_arm": [70.0, 11.0],
	"forearm": [60.0, 10.0],
	"thigh": [200.0, 22.0],
	"calf": [180.0, 20.0],
}
const BASE_LINEAR := [450.0, 36.0] # pelvis position spring to the base

var parts: Array[RigidBody3D] = []
var _parent: Dictionary = {} # part -> parent part (or null for pelvis)
var _rest_rel: Dictionary = {} # part -> Basis relative to parent
var _start: Dictionary = {} # part -> Transform3D (global) for reset
var _home: Transform3D
var chest: RigidBody3D


func _ready() -> void:
	_build()
	_home = parts[0].global_transform
	for p in parts:
		_start[p] = p.global_transform
		var q: RigidBody3D = _parent[p]
		_rest_rel[p] = (q.global_basis.inverse() * p.global_basis).orthonormalized() if q else p.global_basis


func reset() -> void:
	for p in parts:
		var rid := p.get_rid()
		PhysicsServer3D.body_set_state(rid, PhysicsServer3D.BODY_STATE_TRANSFORM, _start[p])
		PhysicsServer3D.body_set_state(rid, PhysicsServer3D.BODY_STATE_LINEAR_VELOCITY, Vector3.ZERO)
		PhysicsServer3D.body_set_state(rid, PhysicsServer3D.BODY_STATE_ANGULAR_VELOCITY, Vector3.ZERO)


func _physics_process(delta: float) -> void:
	for p in parts:
		var q: RigidBody3D = _parent[p]
		var kd: Array = SPRING[p.get_meta("kind")]
		var target: Basis = (q.global_basis * _rest_rel[p]) if q else _home.basis
		var err := (target.orthonormalized() * p.global_basis.orthonormalized().inverse()).get_rotation_quaternion()
		var angle := err.get_angle()
		var w_err := Vector3.ZERO
		if angle > 0.0001:
			if angle > PI:
				angle -= TAU
			w_err = err.get_axis().normalized() * angle
		var rel_w := p.angular_velocity - (q.angular_velocity if q else Vector3.ZERO)
		var dw := (w_err * float(kd[0]) - rel_w * float(kd[1])) * delta
		p.angular_velocity += dw
		if q:
			# equal and opposite reaction on the parent (scaled by mass so light limbs barely move the body)
			q.angular_velocity -= dw * (p.mass / (p.mass + q.mass)) * 0.5
		else:
			var dv: Vector3 = ((_home.origin - p.global_position) * float(BASE_LINEAR[0]) - p.linear_velocity * float(BASE_LINEAR[1])) * delta
			p.linear_velocity += dv


## Name of the target zone a strike at world position `pos` landed on.
static func zone_for(body: RigidBody3D, pos: Vector3) -> String:
	var l := body.global_transform.affine_inverse() * pos
	match String(body.get_meta("part")):
		"head":
			if l.y < -0.03 and l.z > 0.03:
				return "CHIN"
			return "HEAD"
		"chest":
			if absf(l.x) > 0.12:
				return "RIBS"
			return "CHEST"
		"abdomen":
			if l.x < -0.05: # dummy's right side
				return "LIVER"
			if l.z > 0.0 and absf(l.x) < 0.06 and l.y > 0.0:
				return "SOLAR PLEXUS"
			return "BODY"
		"pelvis":
			return "BODY"
		"thigh_l", "thigh_r":
			return "THIGH"
		"calf_l", "calf_r":
			return "CALF"
		_:
			return "ARM"


# ------------------------------------------------------------- construction
func _mat(c: Color) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.roughness = 0.85
	return m


func _new_part(part: String, kind: String, mass: float, xform: Transform3D, parent_part: RigidBody3D) -> RigidBody3D:
	var rb := RigidBody3D.new()
	rb.name = part
	rb.mass = mass
	rb.gravity_scale = 0.0
	rb.linear_damp = 0.6
	rb.angular_damp = 1.0
	rb.can_sleep = false
	rb.collision_layer = 1
	rb.collision_mask = 0 # parts don't collide with each other; fists/feet still detect them
	rb.set_meta("part", part)
	rb.set_meta("kind", kind)
	rb.transform = xform
	add_child(rb)
	parts.append(rb)
	_parent[rb] = parent_part
	return rb


func _shape(rb: RigidBody3D, shape: Shape3D, local := Transform3D.IDENTITY) -> void:
	var cs := CollisionShape3D.new()
	cs.shape = shape
	cs.transform = local
	rb.add_child(cs)


func _mesh(rb: RigidBody3D, mesh: Mesh, c: Color, local := Transform3D.IDENTITY) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = _mat(c)
	mi.transform = local
	rb.add_child(mi)
	return mi


func _pin(a: RigidBody3D, b: RigidBody3D, at: Vector3) -> void:
	var j := PinJoint3D.new()
	j.position = at
	add_child(j)
	j.node_a = a.get_path()
	j.node_b = b.get_path()


## Basis whose Y axis points from a to b (for capsule segments).
func _seg_basis(a: Vector3, b: Vector3) -> Basis:
	var y := (b - a).normalized()
	var ref := Vector3.FORWARD if absf(y.dot(Vector3.FORWARD)) < 0.9 else Vector3.RIGHT
	var x := y.cross(ref).normalized()
	var z := x.cross(y).normalized()
	return Basis(x, y, z)


## Capsule limb from joint a to joint b, pinned to `parent_part` at a.
func _limb(part: String, kind: String, a: Vector3, b: Vector3, r_a: float, r_b: float,
		mass: float, parent_part: RigidBody3D) -> RigidBody3D:
	var seg_len := a.distance_to(b)
	var rb := _new_part(part, kind, mass, Transform3D(_seg_basis(a, b), (a + b) * 0.5), parent_part)
	var cap := CapsuleShape3D.new()
	cap.radius = maxf(r_a, r_b)
	cap.height = seg_len + cap.radius * 2.0
	_shape(rb, cap)
	var cm := CylinderMesh.new()
	cm.bottom_radius = r_a
	cm.top_radius = r_b
	cm.height = seg_len
	cm.radial_segments = 12
	_mesh(rb, cm, SKIN)
	var joint := SphereMesh.new()
	joint.radius = r_a
	joint.height = r_a * 2.0
	_mesh(rb, joint, SKIN, Transform3D(Basis.IDENTITY, Vector3(0.0, -seg_len * 0.5, 0.0)))
	_pin(parent_part, rb, a)
	return rb


## Box collision with a rounded mesh. capsule=true gives a torso-like capsule instead of an ellipsoid.
func _rounded(rb: RigidBody3D, size: Vector3, c: Color, capsule := false) -> void:
	var box := BoxShape3D.new()
	box.size = size
	_shape(rb, box)
	var mi: MeshInstance3D
	if capsule:
		var cm := CapsuleMesh.new()
		cm.radius = 0.5
		cm.height = 1.0 + size.y / size.x * 0.6
		mi = _mesh(rb, cm, c)
		mi.scale = Vector3(size.x, size.y / cm.height, size.z) * 1.06
	else:
		var sm := SphereMesh.new()
		sm.radius = 0.5
		sm.height = 1.0
		mi = _mesh(rb, sm, c)
		mi.scale = size * 1.08


func _build() -> void:
	# --- core
	var pelvis := _new_part("pelvis", "pelvis", 14.0, Transform3D(Basis.IDENTITY, Vector3(0.0, 0.95, 0.0)), null)
	_rounded(pelvis, Vector3(0.34, 0.20, 0.21), SHORTS)

	var abdomen := _new_part("abdomen", "abdomen", 12.0, Transform3D(Basis.IDENTITY, Vector3(0.0, 1.14, 0.0)), pelvis)
	_rounded(abdomen, Vector3(0.29, 0.26, 0.19), SKIN, true)
	_pin(pelvis, abdomen, Vector3(0.0, 1.04, 0.0))
	# liver marker on the dummy's right side (-X), lower ribs
	var mark := SphereMesh.new()
	mark.radius = 0.035
	mark.height = 0.07
	_mesh(abdomen, mark, MARK, Transform3D(Basis.IDENTITY.scaled(Vector3(0.4, 1.0, 1.0)), Vector3(-0.145, 0.05, 0.03)))

	chest = _new_part("chest", "chest", 22.0, Transform3D(Basis.IDENTITY, Vector3(0.0, 1.38, 0.0)), abdomen)
	_rounded(chest, Vector3(0.40, 0.30, 0.23), SKIN, true)
	_pin(abdomen, chest, Vector3(0.0, 1.25, 0.0))

	var head := _new_part("head", "head", 5.5, Transform3D(Basis.IDENTITY, Vector3(0.0, 1.66, 0.02)), chest)
	var hs := SphereShape3D.new()
	hs.radius = 0.11
	_shape(head, hs)
	var hm := SphereMesh.new()
	hm.radius = 0.105
	hm.height = 0.23
	_mesh(head, hm, SKIN)
	var neck := CylinderMesh.new()
	neck.top_radius = 0.05
	neck.bottom_radius = 0.058
	neck.height = 0.14
	_mesh(head, neck, SKIN, Transform3D(Basis.IDENTITY, Vector3(0.0, -0.13, -0.02)))
	var chin := SphereMesh.new()
	chin.radius = 0.03
	chin.height = 0.06
	_mesh(head, chin, MARK, Transform3D(Basis.IDENTITY.scaled(Vector3(1.2, 0.6, 0.8)), Vector3(0.0, -0.09, 0.06)))
	_pin(chest, head, Vector3(0.0, 1.52, 0.0))

	# --- arms in a high guard. Right side = -X.
	for side in [1.0, -1.0]:
		var tag := "l" if side > 0.0 else "r"
		var sh := Vector3(side * 0.22, 1.48, 0.0)
		var el := Vector3(side * 0.20, 1.24, 0.14)
		var fist := Vector3(side * 0.10, 1.50, 0.24 if side > 0.0 else 0.18) # lead hand a bit further out
		var ua := _limb("upper_arm_" + tag, "upper_arm", sh, el, 0.05, 0.04, 2.2, chest)
		var fa := _limb("forearm_" + tag, "forearm", el, fist, 0.04, 0.032, 1.6, ua)
		var fm := SphereMesh.new()
		fm.radius = 0.5
		fm.height = 1.0
		_mesh(fa, fm, Color(0.08, 0.08, 0.09), Transform3D(Basis.IDENTITY.scaled(Vector3(0.085, 0.10, 0.075)), Vector3(0.0, el.distance_to(fist) * 0.5 + 0.035, 0.0)))

	# --- legs, orthodox: left foot forward (+Z), knees soft
	for side in [1.0, -1.0]:
		var tag := "l" if side > 0.0 else "r"
		var fwd := 0.17 if side > 0.0 else -0.17
		var hip := Vector3(side * 0.10, 0.90, 0.0)
		var ankle := Vector3(side * 0.16, 0.08, fwd)
		var knee := (hip + ankle) * 0.5 + Vector3(0.0, 0.0, 0.07)
		knee = hip + (knee - hip).normalized() * 0.44
		var th := _limb("thigh_" + tag, "thigh", hip, knee, 0.085, 0.058, 8.0, pelvis)
		var cf := _limb("calf_" + tag, "calf", knee, ankle, 0.056, 0.04, 4.0, th)
		var foot := BoxMesh.new()
		foot.size = Vector3(0.09, 0.07, 0.24)
		var to_foot := cf.transform.affine_inverse()
		var foot_pos := to_foot * (ankle + Vector3(0.0, -0.03, 0.06))
		var foot_basis := to_foot.basis * Basis.IDENTITY
		_mesh(cf, foot, SKIN, Transform3D(foot_basis, foot_pos))

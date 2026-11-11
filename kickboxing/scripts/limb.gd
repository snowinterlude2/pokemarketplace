class_name Limb
extends RefCounted
## Small helpers for the procedural fighter rig: two-bone IK and segment placement.


## Two-bone IK. All positions share one coordinate space.
## Returns [mid_joint, clamped_tip]. `pole` is a direction the elbow/knee bends toward.
static func solve(root: Vector3, tip: Vector3, l1: float, l2: float, pole: Vector3) -> Array:
	var to_tip := tip - root
	if to_tip.length() < 0.0001:
		to_tip = Vector3(0.0, -0.01, -0.01)
	var dir := to_tip.normalized()
	var dist := clampf(to_tip.length(), absf(l1 - l2) + 0.001, (l1 + l2) * 0.999)
	var clamped_tip := root + dir * dist
	var a := (l1 * l1 - l2 * l2 + dist * dist) / (2.0 * dist)
	var h := sqrt(maxf(l1 * l1 - a * a, 0.0))
	var pole_perp := pole - dir * pole.dot(dir)
	if pole_perp.length() < 0.0001:
		pole_perp = dir.cross(Vector3.UP)
	pole_perp = pole_perp.normalized()
	return [root + dir * a + pole_perp * h, clamped_tip]


## Stretch a Y-aligned capsule mesh between points a and b (parent space).
static func place(node: Node3D, a: Vector3, b: Vector3) -> void:
	var d := b - a
	if d.length() < 0.0001:
		return
	var y := d.normalized()
	var ref := Vector3.RIGHT if absf(y.dot(Vector3.RIGHT)) < 0.9 else Vector3.FORWARD
	var x := ref.cross(y).normalized()
	var z := x.cross(y).normalized()
	node.transform = Transform3D(Basis(x, y, z), (a + b) * 0.5)

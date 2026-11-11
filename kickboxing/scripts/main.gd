extends Node3D
## Physics sandbox: flat arena, a humanoid dummy and a heavy bag to hit, the player rig and a debug HUD.
## B swaps between the dummy station and the bag station.

const DUMMY_POS := Vector3(0.0, 0.0, -0.90)
const BAG_POS := Vector3(2.5, 1.2, -0.95)
const BAG_TOP := 2.05

var player: Player
var bag: RigidBody3D
var dummy: Dummy
var _at_bag := false
var _bag_start: Transform3D
var _hud_status: Label
var _hud_hit: Label
var _hit_timer := 0.0


func _ready() -> void:
	_build_environment()
	_build_arena()
	_build_bag()
	dummy = Dummy.new()
	dummy.position = DUMMY_POS
	add_child(dummy)
	player = Player.new()
	player.target = dummy.chest
	add_child(player)
	player.strike_landed.connect(_on_strike)
	_build_hud()
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE


func _process(delta: float) -> void:
	_hud_status.text = player.status
	_hit_timer -= delta
	_hud_hit.modulate.a = clampf(_hit_timer, 0.0, 1.0)


func _unhandled_key_input(event: InputEvent) -> void:
	var k := event as InputEventKey
	if k and k.pressed and not k.echo and k.keycode == KEY_B:
		_at_bag = not _at_bag
		player.target = bag if _at_bag else dummy.chest
		player.global_position = Vector3(BAG_POS.x if _at_bag else DUMMY_POS.x, 0.0, 0.0)
	if k and k.pressed and not k.echo and k.keycode == KEY_R:
		dummy.reset()
		PhysicsServer3D.body_set_state(bag.get_rid(), PhysicsServer3D.BODY_STATE_TRANSFORM, _bag_start)
		PhysicsServer3D.body_set_state(bag.get_rid(), PhysicsServer3D.BODY_STATE_LINEAR_VELOCITY, Vector3.ZERO)
		PhysicsServer3D.body_set_state(bag.get_rid(), PhysicsServer3D.BODY_STATE_ANGULAR_VELOCITY, Vector3.ZERO)


func _on_strike(info: Dictionary) -> void:
	_hud_hit.text = "HIT  %s -> %s   %.1f m/s   impulse %.0f N*s" % [
		info["limb"], info["zone"], info["speed"], info["impulse"]]
	_hit_timer = 2.5


func _build_environment() -> void:
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.55, 0.65, 0.75)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.6, 0.6, 0.65)
	var we := WorldEnvironment.new()
	we.environment = env
	add_child(we)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-55.0, -30.0, 0.0)
	sun.shadow_enabled = true
	add_child(sun)


func _build_arena() -> void:
	var floor_body := StaticBody3D.new()
	var cs := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = Vector3(30.0, 0.2, 30.0)
	cs.shape = shape
	cs.position = Vector3(0.0, -0.1, 0.0)
	floor_body.add_child(cs)
	var mi := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(30.0, 30.0)
	mi.mesh = pm
	var fm := StandardMaterial3D.new()
	fm.albedo_color = Color(0.35, 0.37, 0.4)
	mi.material_override = fm
	floor_body.add_child(mi)
	add_child(floor_body)

	# 1 m grid so distances / reach are easy to judge
	var im := ImmediateMesh.new()
	im.surface_begin(Mesh.PRIMITIVE_LINES)
	for n in range(-10, 11):
		im.surface_add_vertex(Vector3(n, 0.005, -10.0))
		im.surface_add_vertex(Vector3(n, 0.005, 10.0))
		im.surface_add_vertex(Vector3(-10.0, 0.005, n))
		im.surface_add_vertex(Vector3(10.0, 0.005, n))
	im.surface_end()
	var grid := MeshInstance3D.new()
	grid.mesh = im
	var gm := StandardMaterial3D.new()
	gm.albedo_color = Color(0.2, 0.2, 0.22)
	gm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	grid.material_override = gm
	add_child(grid)


func _band(parent: Node3D, y_rel: float, c: Color) -> void:
	var mi := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = 0.285
	cm.bottom_radius = 0.285
	cm.height = 0.05
	mi.mesh = cm
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	mi.material_override = m
	mi.position = Vector3(0.0, y_rel, 0.0)
	parent.add_child(mi)


func _build_bag() -> void:
	var anchor := StaticBody3D.new()
	anchor.position = Vector3(BAG_POS.x, BAG_TOP, BAG_POS.z)
	add_child(anchor)

	bag = RigidBody3D.new()
	bag.mass = 35.0
	bag.linear_damp = 0.3
	bag.angular_damp = 1.2
	bag.position = BAG_POS
	var cs := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.28
	cap.height = 1.7
	cs.shape = cap
	bag.add_child(cs)
	var mi := MeshInstance3D.new()
	var cm := CapsuleMesh.new()
	cm.radius = 0.28
	cm.height = 1.7
	mi.mesh = cm
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(0.25, 0.25, 0.28)
	mi.material_override = m
	bag.add_child(mi)
	_band(bag, 0.25, Color(0.9, 0.2, 0.2)) # head / body boundary (world y 1.45)
	_band(bag, -0.5, Color(0.2, 0.4, 0.9)) # body / leg boundary (world y 0.70)
	add_child(bag)
	_bag_start = bag.global_transform

	var pin := PinJoint3D.new()
	pin.position = anchor.position
	add_child(pin)
	pin.node_a = anchor.get_path()
	pin.node_b = bag.get_path()


func _build_hud() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)
	var help := Label.new()
	help.text = "Click = capture mouse   Esc = release   C = 3rd-person debug cam   R = reset   B = dummy / bag   WASD = move\n" \
		+ "No buttons: mouse = sway/slip, Ctrl = duck, Ctrl+mouse X = roll under\n" \
		+ "RMB / LMB: punch (push mouse forward to extend, sideways = hook). +Ctrl = body\n" \
		+ "RMB+LMB: block head (+Ctrl body)\n" \
		+ "Shift+RMB / LMB: kick (mid; +Ctrl low; +Q high). Shift alone: check (mouse X picks leg)"
	help.position = Vector2(12.0, 8.0)
	layer.add_child(help)
	_hud_status = Label.new()
	_hud_status.position = Vector2(12.0, 140.0)
	_hud_status.add_theme_font_size_override("font_size", 22)
	layer.add_child(_hud_status)
	_hud_hit = Label.new()
	_hud_hit.position = Vector2(12.0, 175.0)
	_hud_hit.add_theme_font_size_override("font_size", 22)
	_hud_hit.modulate.a = 0.0
	layer.add_child(_hud_hit)
	var dot := ColorRect.new()
	dot.color = Color(1.0, 1.0, 1.0, 0.6)
	dot.size = Vector2(4.0, 4.0)
	dot.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	layer.add_child(dot)

extends Node

const SAVE_PATH := "user://wortwelten.json"
const WORDS := [
	["der Apfel", "apple"], ["die Katze", "cat"], ["das Haus", "house"],
	["die Sonne", "sun"], ["das Buch", "book"], ["das Wasser", "water"],
	["der Vogel", "bird"], ["der Freund", "friend"]
]
const LEVELS := ["Der versunkene Dungeon", "Wüste & Oasen", "Dschungel & Tiger"]
const BOSSES := ["Dungeon-Wächter", "Wüstenskorpion", "Dschungeltiger"]
const BG := [Color("#181c31"), Color("#c4826b"), Color("#244f42")]
const GROUND := [Color("#625b66"), Color("#c39362"), Color("#628353")]
const UPPER_HAZARDS := ["bridge", "dog", "pendulum", "ceiling", "sand", "lightning"]
const LOWER_HAZARDS := ["trapdoor", "boulder", "flame", "net", "wave", "vortex"]
const HAZARD_NAMES := {
	"bridge": "Die Brücke bricht!", "dog": "Der Wächterhund!", "pendulum": "Das Pendel schwingt!",
	"ceiling": "Die Decke senkt sich!", "sand": "Ein Sandsturm!", "lightning": "Ein Blitz!",
	"trapdoor": "Die Falltür öffnet sich!", "boulder": "Ein Rollstein!", "flame": "Die Feuerfalle!",
	"net": "Ein Fangnetz!", "wave": "Eine Wasserwelle!", "vortex": "Ein magischer Wirbel!"
}
const FLOOR_HEIGHTS := [0.0, .9, .15, 1.1, .2, 1.0, .1, .8]
const FLOOR_SECTION := 24.0
const TERRAIN_STEP := .6
const TRAP_OFFSET := 4.0
const BRIDGE_HEIGHT := 2.55
const BRIDGE_START := -3.4
const BRIDGE_END := 8.0
const BRIDGE_STEP := .6
const RUN_JUMP_SPEED := 10.4

var data := {"words": [], "profiles": {}, "selected": ""}
var profile := ""
var scene: Node3D
var actor: Node3D
var limbs: Array[Node3D] = []
var joints: Array[Node3D] = []
var scarf_tail: Node3D
var hero_eye: Node3D
var hero_bow: Node3D
var hero_shadow: MeshInstance3D
var gait_phase := 0.0
var shoot_pose := 0.0
var hurt_pose := 0.0
var obstacles: Node3D
var scenery: Array[Node3D] = []
var distant_scenery: Array[Node3D] = []
var boss_node: Node3D
var terrain_mesh: MeshInstance3D
var terrain_top_material: StandardMaterial3D
var terrain_front_material: StandardMaterial3D
var upper_hazard: Node3D
var lower_hazard: Node3D
var bridge_middle: Node3D
var ui: CanvasLayer
var info: Label
var prompt: Label
var feedback: Label
var profile_select: OptionButton
var status: Label
var storage_error: AcceptDialog
var menu: Control
var game_ui: Control
var dialog: FileDialog
var state := "menu"
var level := 0
var boss_defeated := [false, false, false]
var level_start_score := 0
var speed_start_score := 0
var speed_end_score := 1000
var score := 0
var lives := 12
var correct_count := 0
var last_word := -1
var current_word := 0
var correct_answer := ""
var answers: Array = []
var question_text := ""
var encounter_x := 17.0
var choice_locked := false
var choice_correct := false
var chosen_path := -1
var encounter_resolved := false
var encounter_number := 0
var run_distance := 0.0
var player_y := 0.0
var grounded := true
var on_bridge := false
var hazard_age := 0.0
var active_hazard := ""
var jump_y := 0.0
var jump_velocity := 0.0
var elapsed := 0.0
var near_scroll := 0.0
var far_scroll := 0.0
var boss_health := 5
var arrows: Array = []
var projectiles: Array = []
var fire_timer := 2.5
var invulnerable := 0.0
var boss_x := 0.0
var message_timer := 0.0

func _ready() -> void:
	randomize()
	_load_data()
	_build_world()
	_build_ui()
	_show_menu()

func _load_data() -> void:
	for pair in WORDS:
		data.words.append({"german": pair[0], "english": pair[1]})
	if not FileAccess.file_exists(SAVE_PATH):
		return
	var file := FileAccess.open(SAVE_PATH, FileAccess.READ)
	if file == null:
		push_error("Spielstand konnte nicht geöffnet werden: %s" % FileAccess.get_open_error())
		return
	var json := JSON.new()
	if json.parse(file.get_as_text()) != OK or not json.data is Dictionary:
		push_error("Spielstand ist ungültig und wird nicht überschrieben.")
		data = {}
		return
	var saved: Dictionary = json.data
	if not saved.has("words") or not saved.words is Array or saved.words.size() < 2 or not saved.has("profiles") or not saved.profiles is Dictionary:
		push_error("Spielstand hat ein ungültiges Format und wird nicht überschrieben.")
		data = {}
		return
	data = saved
	if not data.has("selected"):
		data.selected = ""

func _save() -> bool:
	var file := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if file == null:
		var error := "Speichern fehlgeschlagen: %s" % FileAccess.get_open_error()
		push_error(error)
		if status:
			status.text = error
		if storage_error:
			storage_error.dialog_text = error
			storage_error.popup_centered()
		return false
	file.store_string(JSON.stringify(data))
	file.flush()
	if file.get_error() != OK:
		push_error("Spielstand konnte nicht vollständig gespeichert werden.")
		if storage_error:
			storage_error.dialog_text = "Spielstand konnte nicht vollständig gespeichert werden."
			storage_error.popup_centered()
		return false
	return true

func _material(color: Color, roughness := 0.85) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = color
	m.roughness = roughness
	return m

func _box(parent: Node3D, size: Vector3, pos: Vector3, color: Color) -> MeshInstance3D:
	var mesh := BoxMesh.new()
	mesh.size = size
	var node := MeshInstance3D.new()
	node.mesh = mesh
	node.position = pos
	node.material_override = _material(color)
	parent.add_child(node)
	return node

func _sphere(parent: Node3D, radius: float, pos: Vector3, color: Color) -> MeshInstance3D:
	var mesh := SphereMesh.new()
	mesh.radius = radius
	mesh.height = radius * 2.0
	var node := MeshInstance3D.new()
	node.mesh = mesh
	node.position = pos
	node.material_override = _material(color)
	parent.add_child(node)
	return node

func _oval(parent: Node3D, size: Vector3, pos: Vector3, color: Color) -> MeshInstance3D:
	var node := _sphere(parent, 0.5, pos, color)
	node.scale = size
	return node

func _comic_outlines(node: Node, outline: ShaderMaterial) -> void:
	if node is MeshInstance3D:
		var material := node.material_override as StandardMaterial3D
		if material:
			material.diffuse_mode = BaseMaterial3D.DIFFUSE_TOON
			material.next_pass = outline
	for child in node.get_children():
		_comic_outlines(child, outline)

func _build_hero() -> void:
	actor = Node3D.new()
	scene.add_child(actor)
	actor.scale = Vector3(.68, .68, .68)
	var skin := Color("#f0ba92")
	var ink := Color("#35303b")
	var coat := Color("#3d8583")
	var dark_coat := Color("#316c71")
	var scarf := Color("#e57c58")
	var boots := Color("#805344")

	scarf_tail = Node3D.new()
	scarf_tail.position = Vector3(-.2, 1.94, -.18)
	actor.add_child(scarf_tail)
	var tail := _oval(scarf_tail, Vector3(.66, .22, .16), Vector3(-.36, -.05, 0), scarf)
	tail.rotation.z = .2
	var tail_tip := _oval(scarf_tail, Vector3(.28, .2, .14), Vector3(-.65, -.11, 0), Color("#f29c6e"))
	tail_tip.rotation.z = -.1

	_oval(actor, Vector3(.83, .95, .53), Vector3(0, 1.48, 0), coat)
	_oval(actor, Vector3(.23, .62, .09), Vector3(.16, 1.52, .28), Color("#64aaa0"))
	_box(actor, Vector3(.70, .12, .5), Vector3(0, 1.12, .03), Color("#6a4739"))
	_box(actor, Vector3(.18, .16, .08), Vector3(.08, 1.12, .30), Color("#ffd27a"))

	_oval(actor, Vector3(.90, .96, .64), Vector3(0, 2.31, 0), skin)
	_oval(actor, Vector3(.85, .36, .65), Vector3(-.06, 2.65, -.01), Color("#553c3a"))
	_oval(actor, Vector3(.95, .16, .7), Vector3(.03, 2.59, .08), Color("#65483f"))
	_oval(actor, Vector3(.16, .24, .12), Vector3(-.38, 2.29, .22), Color("#e49f7e"))
	hero_eye = Node3D.new()
	hero_eye.position = Vector3(.16, 2.38, .32)
	actor.add_child(hero_eye)
	_oval(hero_eye, Vector3(.28, .35, .10), Vector3.ZERO, Color("#fff6e2"))
	_oval(hero_eye, Vector3(.10, .16, .07), Vector3(.07, -.02, .07), ink)
	_sphere(hero_eye, .025, Vector3(.09, .02, .11), Color.WHITE)
	var eyebrow := _oval(actor, Vector3(.27, .055, .07), Vector3(.14, 2.59, .32), ink)
	eyebrow.rotation.z = -.12
	_oval(actor, Vector3(.34, .18, .21), Vector3(.37, 2.17, .25), Color("#eaa887"))
	_oval(actor, Vector3(.20, .06, .06), Vector3(.19, 2.08, .33), Color("#873f3c"))
	_oval(actor, Vector3(.77, .23, .65), Vector3(0, 1.98, 0), scarf)
	_oval(actor, Vector3(.22, .42, .12), Vector3(-.24, 1.77, .31), Color("#f29c6e"))

	for x in [-.22, .22]:
		var leg := Node3D.new()
		leg.position = Vector3(x, 1.05, 0)
		actor.add_child(leg)
		_oval(leg, Vector3(.30, .52, .30), Vector3(0, -.23, 0), Color("#414a60"))
		var knee := Node3D.new()
		knee.position = Vector3(0, -.42, 0)
		leg.add_child(knee)
		_oval(knee, Vector3(.25, .48, .25), Vector3(0, -.20, 0), Color("#4c5870"))
		_oval(knee, Vector3(.42, .25, .40), Vector3(.08, -.49, .03), boots)
		_oval(knee, Vector3(.26, .07, .13), Vector3(.12, -.46, .22), Color("#d3a27e"))
		limbs.append(leg)
		joints.append(knee)
		var arm := Node3D.new()
		arm.position = Vector3(x * 1.72, 1.80, .02)
		actor.add_child(arm)
		_oval(arm, Vector3(.29, .44, .29), Vector3(0, -.18, 0), dark_coat)
		var elbow := Node3D.new()
		elbow.position = Vector3(0, -.35, 0)
		arm.add_child(elbow)
		_oval(elbow, Vector3(.24, .36, .24), Vector3(0, -.14, 0), coat)
		_sphere(elbow, .13, Vector3(0, -.31, .02), skin)
		limbs.append(arm)
		joints.append(elbow)

	hero_bow = Node3D.new()
	hero_bow.position = Vector3(.42, 1.14, .35)
	actor.add_child(hero_bow)
	for direction in [-1, 1]:
		var bow_part := _box(hero_bow, Vector3(.09, .50, .09), Vector3(.06, direction * .22, 0), Color("#dda76d"))
		bow_part.rotation.z = direction * .30
	_box(hero_bow, Vector3(.025, .86, .025), Vector3(-.06, 0, 0), Color("#fff0cf"))
	hero_bow.visible = false

	var shader := Shader.new()
	shader.code = "shader_type spatial; render_mode unshaded, cull_front; void vertex() { VERTEX += NORMAL * 0.055; } void fragment() { ALBEDO = vec3(0.13, 0.11, 0.16); }"
	var outline := ShaderMaterial.new()
	outline.shader = shader
	_comic_outlines(actor, outline)

	hero_shadow = _oval(scene, Vector3(.75, .03, .42), Vector3(-5, .08, .3), Color(0.08, 0.07, 0.1, .32))
	var shadow_material := hero_shadow.material_override as StandardMaterial3D
	shadow_material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	actor.position.x = -5

func _shape(parent: Node3D, points: PackedVector2Array, z: float, color: Color) -> MeshInstance3D:
	var vertices := PackedVector3Array()
	for i in range(1, points.size() - 1):
		for p in [points[0], points[i], points[i + 1]]:
			vertices.append(Vector3(p.x, p.y, z))
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = vertices
	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	var node := MeshInstance3D.new()
	node.mesh = mesh
	var material := _material(color)
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	material.cull_mode = BaseMaterial3D.CULL_DISABLED
	node.material_override = material
	parent.add_child(node)
	return node

func _hill(x: float, width: float, height: float) -> PackedVector2Array:
	var points := PackedVector2Array([Vector2(x - width, 0)])
	for step in range(1, 8):
		var t := float(step) / 8.0
		points.append(Vector2(x - width + t * width * 2.0, sin(t * PI) * height))
	points.append(Vector2(x + width, 0))
	return points

func _plaque(parent: Node3D, width: float, height: float, y: float, answer: String, ignore_depth := true) -> void:
	_box(parent, Vector3(width + .14, height + .14, .16), Vector3(0, y, .13), Color("#372d35"))
	_box(parent, Vector3(width, height, .14), Vector3(0, y, .23), Color("#b9895f"))
	_box(parent, Vector3(width - .15, height - .15, .06), Vector3(0, y, .32), Color("#e0bb83"))
	for x in [-width * .44, width * .44]:
		_sphere(parent, .04, Vector3(x, y, .38), Color("#6a4c39"))
	_label_3d(parent, answer, Vector3(0, y, .41), 34, width - .32, ignore_depth)

func _build_world() -> void:
	scene = Node3D.new()
	add_child(scene)
	var camera := Camera3D.new()
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.size = 10.5
	camera.position = Vector3(0, 5.8, 20)
	camera.rotation_degrees.x = -9
	scene.add_child(camera)
	camera.current = true
	var environment := WorldEnvironment.new()
	environment.name = "WorldEnvironment"
	var env := Environment.new()
	env.background_mode = Environment.BG_SKY
	var sky := Sky.new()
	sky.sky_material = ProceduralSkyMaterial.new()
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color("#d6c6b6")
	env.ambient_light_energy = 0.65
	environment.environment = env
	scene.add_child(environment)
	var light := DirectionalLight3D.new()
	light.rotation_degrees = Vector3(-42, -35, -20)
	light.light_energy = 1.15
	scene.add_child(light)
	obstacles = Node3D.new()
	scene.add_child(obstacles)
	_build_hero()
	_refresh_world()

func _floor_at(x: float) -> float:
	var section := maxi(0, floori(x / FLOOR_SECTION))
	var previous: float = FLOOR_HEIGHTS[maxi(0, section - 1) % FLOOR_HEIGHTS.size()]
	var target: float = FLOOR_HEIGHTS[section % FLOOR_HEIGHTS.size()]
	return lerpf(previous, target, clampf((x - section * FLOOR_SECTION) / 6.0, 0.0, 1.0))

func _bridge_y() -> float:
	return _floor_at(run_distance) + BRIDGE_HEIGHT

func _render_terrain() -> void:
	var flat := state == "boss" or state == "menu"
	var gap_center := encounter_x + TRAP_OFFSET
	var top := SurfaceTool.new()
	top.begin(Mesh.PRIMITIVE_TRIANGLES)
	top.set_material(terrain_top_material)
	var front := SurfaceTool.new()
	front.begin(Mesh.PRIMITIVE_TRIANGLES)
	front.set_material(terrain_front_material)
	for i in 40:
		var x := -12.0 + i * TERRAIN_STEP
		var left := 0.0 if flat else _floor_at(run_distance + x + 5.0)
		var right := 0.0 if flat else _floor_at(run_distance + x + 5.0 + TERRAIN_STEP)
		if state == "falling" and chosen_path == 1 and absf(x + TERRAIN_STEP * .5 - gap_center) < .9:
			continue
		var a := Vector3(x, left, 3.0)
		var b := Vector3(x + TERRAIN_STEP, right, 3.0)
		var c := Vector3(x + TERRAIN_STEP, right, -3.0)
		var d := Vector3(x, left, -3.0)
		var normal := Vector3(left - right, TERRAIN_STEP, 0).normalized()
		for vertex in [a, b, c, a, c, d]:
			top.set_normal(normal)
			top.add_vertex(vertex)
		var bottom_left := Vector3(x, -2.0, 3.0)
		var bottom_right := Vector3(x + TERRAIN_STEP, -2.0, 3.0)
		for vertex in [bottom_left, bottom_right, b, bottom_left, b, a]:
			front.set_normal(Vector3.FORWARD * -1.0)
			front.add_vertex(vertex)
	var mesh := top.commit()
	front.commit(mesh)
	terrain_mesh.mesh = mesh

func _refresh_world() -> void:
	for child in obstacles.get_children():
		child.queue_free()
	scenery.clear()
	distant_scenery.clear()
	var environment := scene.get_node_or_null("WorldEnvironment") as WorldEnvironment
	if environment:
		var sky := environment.environment.sky.sky_material as ProceduralSkyMaterial
		sky.sky_top_color = BG[level].darkened(.35)
		sky.sky_horizon_color = BG[level].lightened(.27)
		sky.ground_bottom_color = BG[level].darkened(.12)
		sky.ground_horizon_color = BG[level].lightened(.27)
	terrain_mesh = MeshInstance3D.new()
	obstacles.add_child(terrain_mesh)
	terrain_top_material = _material(GROUND[level])
	terrain_front_material = _material(GROUND[level].darkened(.30))
	terrain_top_material.cull_mode = BaseMaterial3D.CULL_DISABLED
	terrain_front_material.cull_mode = BaseMaterial3D.CULL_DISABLED
	_render_terrain()
	for tile in 2:
		var far := Node3D.new()
		obstacles.add_child(far)
		distant_scenery.append(far)
		for i in range(-4, 5):
			var x := i * 2.6
			var peak := 3.4 + float((abs(i) * 7) % 4) * .55
			if level == 0:
				var rock := PackedVector2Array([Vector2(x - 2.1, 0), Vector2(x - .5, peak * .65), Vector2(x + .1, peak), Vector2(x + 2.2, 0)])
				_shape(far, rock, -8, BG[level].darkened(.16))
			elif level == 1:
				_shape(far, _hill(x, 2.7, peak * .65), -8, Color("#bd8977"))
			else:
				_oval(far, Vector3(3.9, 3.3, .4), Vector3(x, 2.0, -8), Color("#1c493d"))
		far.position.x = tile * 23.4
		var layer := Node3D.new()
		obstacles.add_child(layer)
		scenery.append(layer)
		for i in range(-4, 5):
			var x := i * 2.6
			if level == 0:
				_box(layer, Vector3(.52, 6.4, .7), Vector3(x, 3.2, -4.5), Color("#3d3d50"))
				_box(layer, Vector3(.75, .28, .9), Vector3(x, 6.28, -4.5), Color("#776b72"))
				_box(layer, Vector3(.7, .25, .9), Vector3(x, .12, -4.5), Color("#776b72"))
				_box(layer, Vector3(2.65, .34, .6), Vector3(x, 6.6, -4.7), Color("#393b4e"))
				if i % 2 == 0:
					_box(layer, Vector3(.14, .36, .12), Vector3(x, 2.8, -3.95), Color("#59423b"))
					_oval(layer, Vector3(.24, .45, .16), Vector3(x, 3.15, -3.9), Color("#f5a75f"))
					_sphere(layer, .07, Vector3(x, 3.13, -3.79), Color("#ffe4a0"))
			elif level == 1:
				_shape(layer, _hill(x, 2.2, 1.3 + float(abs(i) % 2) * .35), -5.0, Color("#d9ac79"))
				if i % 3 == 0:
					var trunk := _box(layer, Vector3(.24, 4.0, .25), Vector3(x, 2.0, -3.8), Color("#855f48"))
					trunk.rotation.z = .12
					for j in 5:
						var leaf := _oval(layer, Vector3(1.5, .2, .3), Vector3(x + (j - 2) * .32, 4.1 - abs(j - 2) * .15, -3.7), Color("#577c64"))
						leaf.rotation.z = (j - 2) * .35
			else:
				_box(layer, Vector3(.45, 6.5, .55), Vector3(x, 3.25, -4.4), Color("#4a4b37"))
				_oval(layer, Vector3(3.0, 1.8, .8), Vector3(x, 6.2, -4.4), Color("#315f4b"))
				_oval(layer, Vector3(1.8, 1.2, .7), Vector3(x + .9, 5.3, -4.0), Color("#47775a"))
				_oval(layer, Vector3(1.5, .65, .5), Vector3(x - .7, .5, -3.9), Color("#527b54"))
		layer.position.x = tile * 23.4
	_built_encounter()

func _label_3d(parent: Node3D, text: String, pos: Vector3, size := 38, max_width := 2.0, ignore_depth := true) -> Label3D:
	var label := Label3D.new()
	label.text = text
	label.position = pos
	label.font_size = size
	var text_width := ThemeDB.fallback_font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, size).x
	label.pixel_size = minf(.012, max_width / maxf(text_width, 1.0))
	label.modulate = Color("#402f2b")
	label.outline_size = 0
	label.no_depth_test = ignore_depth
	parent.add_child(label)
	return label

func _hazard(parent: Node3D, kind: String, y: float) -> Node3D:
	var node := Node3D.new()
	node.position = Vector3(TRAP_OFFSET, y, .35)
	if kind in ["pendulum", "ceiling", "lightning", "net"]:
		node.scale = Vector3(.75, .75, .75)
	parent.add_child(node)
	var dark := Color("#40333b")
	var wood := Color("#a16b48")
	var stone := Color("#80777a")
	var effect := Node3D.new()
	effect.name = "Effect"
	node.add_child(effect)
	effect.visible = false
	match kind:
		"bridge":
			for i in 5:
				var shard := _box(effect, Vector3(.35, .12, .25), Vector3((i - 2) * .3, -.3 - absf(i - 2) * .1, .2), wood)
				shard.rotation.z = (i - 2) * .35
		"trapdoor":
			_box(node, Vector3(1.7, .12, 1.0), Vector3(0, .04, 0), dark)
			var panel := _box(node, Vector3(1.45, .08, .9), Vector3(0, .12, .05), wood)
			panel.name = "Moving"
		"dog":
			var dog := Node3D.new()
			dog.name = "Moving"
			node.add_child(dog)
			_oval(dog, Vector3(1.25, .75, .55), Vector3(.1, .62, 0), dark)
			_oval(dog, Vector3(.65, .65, .55), Vector3(-.55, .91, .05), Color("#6a4b40"))
			_oval(dog, Vector3(.55, .25, .25), Vector3(-.82, .72, .28), Color("#a27d65"))
			_sphere(dog, .08, Vector3(-.69, .99, .33), Color("#ffb75a"))
			for x in [-.3, .45]:
				_box(dog, Vector3(.16, .43, .2), Vector3(x, .25, 0), dark)
		"pendulum":
			var pivot := Node3D.new()
			pivot.name = "Moving"
			pivot.position.y = 3.2
			node.add_child(pivot)
			_box(pivot, Vector3(.08, 2.6, .08), Vector3(0, -1.3, 0), stone)
			_sphere(pivot, .4, Vector3(0, -2.65, 0), dark)
			for x in [-.3, 0.0, .3]:
				_sphere(pivot, .1, Vector3(x, -2.65, .3), Color("#d3a070"))
		"ceiling":
			_box(node, Vector3(2.4, .18, .4), Vector3(0, 3.8, 0), dark)
			var block := _box(node, Vector3(2.0, .65, .8), Vector3(0, 3.35, 0), stone)
			block.name = "Moving"
			for x in [-.7, -.35, 0.0, .35, .7]:
				var spike := _box(block, Vector3(.15, .55, .3), Vector3(x, -.48, 0), dark)
				spike.rotation.z = .3
		"sand", "vortex":
			var color := Color("#e0c185") if kind == "sand" else Color("#b38de2")
			_oval(node, Vector3(1.3, .09, .8), Vector3(0, .08, 0), dark)
			for i in 6:
				var swirl := _oval(effect, Vector3(1.6 - i * .16, .16, .3), Vector3((i % 2 - .5) * .35, .35 + i * .33, .2), color)
				swirl.rotation.z = (i % 2 - .5) * .45
		"lightning":
			_box(node, Vector3(.7, .35, .55), Vector3(0, .2, 0), dark)
			_sphere(node, .25, Vector3(0, .5, 0), Color("#80d6e5"))
			_shape(effect, PackedVector2Array([Vector2(-.2, 3.8), Vector2(.35, 3.8), Vector2(.02, 2.1), Vector2(.45, 2.1), Vector2(-.5, .15), Vector2(-.18, 1.8), Vector2(-.5, 1.8)]), .2, Color("#fff394"))
		"boulder":
			var rock := _sphere(node, .65, Vector3(.5, 1.6, 0), stone)
			rock.name = "Moving"
			for p in [Vector3(-.2, .15, .55), Vector3(.22, -.2, .57), Vector3(.12, .35, .5)]:
				_oval(rock, Vector3(.22, .16, .05), p, dark)
		"flame":
			_box(node, Vector3(1.7, .16, .8), Vector3(0, .1, 0), dark)
			for x in [-.5, 0.0, .5]:
				_oval(effect, Vector3(.5, 1.8, .3), Vector3(x, .9, .15), Color("#ff823d"))
				_oval(effect, Vector3(.22, 1.0, .16), Vector3(x, .55, .32), Color("#ffdf77"))
		"net":
			_box(node, Vector3(2.2, .12, .18), Vector3(0, 3.8, 0), wood)
			var net := Node3D.new()
			net.name = "Moving"
			net.position.y = 3.45
			node.add_child(net)
			for x in [-.8, -.4, 0.0, .4, .8]:
				_box(net, Vector3(.06, 1.3, .08), Vector3(x, 0, .1), Color("#d5be8d"))
			for yy in [-.6, -.2, .2, .6]:
				_box(net, Vector3(1.65, .06, .08), Vector3(0, yy, .1), Color("#d5be8d"))
		"wave":
			_box(node, Vector3(1.8, .35, .65), Vector3(0, .2, 0), dark)
			for i in 5:
				_oval(effect, Vector3(.8, 1.7 - absf(i - 2) * .2, .3), Vector3((i - 2) * .4, .8, .2), Color("#69b9c9"))
				_sphere(effect, .13, Vector3((i - 2) * .4, 1.55 - absf(i - 2) * .1, .35), Color("#d6f5e9"))
	node.visible = false
	return node

func _animate_hazards() -> void:
	if not is_instance_valid(upper_hazard) or not is_instance_valid(lower_hazard):
		return
	var revealed := choice_locked
	upper_hazard.visible = revealed and (active_hazard.is_empty() or chosen_path == 0)
	lower_hazard.visible = revealed and (active_hazard.is_empty() or chosen_path == 1)
	var upper_kind: String = UPPER_HAZARDS[encounter_number % UPPER_HAZARDS.size()]
	var lower_kind: String = LOWER_HAZARDS[encounter_number % LOWER_HAZARDS.size()]
	for path in 2:
		var node := upper_hazard if path == 0 else lower_hazard
		var kind := upper_kind if path == 0 else lower_kind
		var triggered := active_hazard == kind and chosen_path == path
		var effect := node.get_node("Effect") as Node3D
		effect.visible = triggered
		var moving := node.get_node_or_null("Moving") as Node3D
		if moving:
			match kind:
				"dog":
					moving.position.x = -minf(hazard_age * 2.0, .8) if triggered else 0.0
				"pendulum":
					moving.rotation.z = sin(elapsed * (8.0 if triggered else 2.0)) * (.9 if triggered else .25)
				"ceiling":
					moving.position.y = 3.35 - minf(hazard_age * 5.0, 2.3) if triggered else 3.35
				"trapdoor":
					moving.rotation.z = minf(hazard_age * 5.0, 1.3) if triggered else 0.0
				"boulder":
					moving.position = Vector3(.5 - minf(hazard_age * 3.0, 1.5), maxf(.65, 1.6 - hazard_age * 4.0), 0) if triggered else Vector3(.5, 1.6, 0)
					moving.rotation.z = hazard_age * 4.0 if triggered else 0.0
				"net":
					moving.position.y = 3.45 - minf(hazard_age * 5.0, 2.4) if triggered else 3.45
		if triggered:
			match kind:
				"bridge":
					effect.position.y = -hazard_age * hazard_age * 2.0
				"sand", "vortex":
					effect.rotation.z = sin(hazard_age * 8.0) * .3
				"lightning":
					effect.scale.x = .8 + .2 * absf(sin(hazard_age * 18.0))
				"flame":
					effect.scale.y = .9 + .1 * sin(hazard_age * 15.0)
				"wave":
					effect.position.x = maxf(0.0, 1.2 - hazard_age * 4.0)
	bridge_middle.visible = active_hazard != "bridge"

func _built_encounter() -> void:
	if boss_node and is_instance_valid(boss_node):
		boss_node.queue_free()
	boss_node = Node3D.new()
	obstacles.add_child(boss_node)
	if state == "boss":
		boss_node.position = Vector3(5, 0, 0)
		_oval(boss_node, Vector3(3.3, 5.0, 1.0), Vector3(0, 2.6, -.55), GROUND[level].darkened(.42))
		_oval(boss_node, Vector3(2.7, 4.4, .45), Vector3(0, 2.7, -.1), GROUND[level].darkened(.15))
		_oval(boss_node, Vector3(1.9, 1.6, .9), Vector3(0, 5.0, -.45), Color("#3d3039") if level == 0 else Color("#bc8445"))
		for x in [-.35, .35]:
			_oval(boss_node, Vector3(.26, .12, .10), Vector3(x, 5.2, .08), Color("#ffb453"))
		if level == 0:
			for x in [-.7, .7]:
				var horn := _box(boss_node, Vector3(.22, 1.0, .3), Vector3(x, 5.85, -.5), Color("#c4a47f"))
				horn.rotation.z = x * -.6
				_oval(boss_node, Vector3(.8, 1.15, .55), Vector3(x * 2.0, 3.8, -.3), Color("#474552"))
			_box(boss_node, Vector3(.75, .12, .12), Vector3(0, 4.8, .1), Color("#d9c4a0"))
			for x in [-.27, 0.0, .27]:
				_box(boss_node, Vector3(.08, .22, .10), Vector3(x, 4.75, .14), Color("#d9c4a0"))
		elif level == 1:
			for x in [-1.6, 1.6]:
				var claw := _oval(boss_node, Vector3(1.1, 1.3, .7), Vector3(x, 2.6, -.35), Color("#b37e4b"))
				claw.rotation.z = x * .25
				_box(boss_node, Vector3(.8, .12, .25), Vector3(x, 2.6, .1), Color("#593e32"))
				for y in [1.0, 1.6, 2.2]:
					var leg := _box(boss_node, Vector3(1.1, .16, .18), Vector3(x, y, -.5), Color("#684834"))
					leg.rotation.z = signf(x) * -.5
			var tail := _box(boss_node, Vector3(.3, 2.2, .3), Vector3(1.6, 4.1, -.6), Color("#785039"))
			tail.rotation.z = -.7
			_sphere(boss_node, .26, Vector3(2.25, 4.9, -.6), Color("#d8a668"))
		else:
			for x in [-.65, .65]:
				_sphere(boss_node, .3, Vector3(x, 5.8, -.5), Color("#a97040"))
			for x in [-.55, 0.0, .55]:
				_box(boss_node, Vector3(.13, .45, .08), Vector3(x, 5.7, .3), Color("#382e2b"))
			_oval(boss_node, Vector3(.9, .4, .18), Vector3(0, 4.8, .15), Color("#f0d7ae"))
			_oval(boss_node, Vector3(.2, .13, .1), Vector3(0, 4.95, .25), Color("#443334"))
		for i in answers.size():
			var y := 1.0 + float(answers.size() - 1 - i) * 1.05
			_plaque(boss_node, 2.4, .75, y, answers[i])
	elif state == "run":
		boss_node.position.x = encounter_x
		var sign_world_x := run_distance + encounter_x + 5.0
		boss_node.position.y = _floor_at(sign_world_x)
		var sign := Node3D.new()
		sign.name = "RouteSign"
		sign.position.z = -1.5
		boss_node.add_child(sign)
		_box(sign, Vector3(.32, 4.65, .3), Vector3(0, 2.325, 0), Color("#56433d"))
		_box(sign, Vector3(.4, .18, .4), Vector3(0, 4.7, 0), Color("#d2ab78"))
		for i in 2:
			var y := BRIDGE_HEIGHT + 1.25 if i == 0 else 1.05
			_plaque(sign, 3.1, .9, y, answers[i], false)
		bridge_middle = Node3D.new()
		boss_node.add_child(bridge_middle)
		for i in roundi((BRIDGE_END - BRIDGE_START) / BRIDGE_STEP):
			var x := BRIDGE_START + i * BRIDGE_STEP
			var left := _floor_at(sign_world_x + x)
			var right := _floor_at(sign_world_x + x + BRIDGE_STEP)
			var middle_x := x + BRIDGE_STEP * .5
			var parent := bridge_middle if absf(middle_x - TRAP_OFFSET) < .9 else boss_node
			var board := _box(parent, Vector3(BRIDGE_STEP + .01, .16, 1.25), Vector3(middle_x, (left + right) * .5 - boss_node.position.y + BRIDGE_HEIGHT - .08, -.15), Color("#91684e"))
			board.rotation.z = atan2(right - left, BRIDGE_STEP)
		var lower_y := _floor_at(run_distance + encounter_x + 5.0 + TRAP_OFFSET) - boss_node.position.y
		upper_hazard = _hazard(boss_node, UPPER_HAZARDS[encounter_number % UPPER_HAZARDS.size()], lower_y + BRIDGE_HEIGHT)
		lower_hazard = _hazard(boss_node, LOWER_HAZARDS[encounter_number % LOWER_HAZARDS.size()], lower_y)

func _button(parent: Node, title: String, callback: Callable) -> Button:
	var b := Button.new()
	b.text = title
	b.custom_minimum_size = Vector2(0, 42)
	b.pressed.connect(callback)
	parent.add_child(b)
	return b

func _panel(parent: Control, pos: Vector2, dimensions: Vector2, color: Color, border: Color) -> Panel:
	var panel := Panel.new()
	panel.position = pos
	panel.size = dimensions
	panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var style := StyleBoxFlat.new()
	style.bg_color = color
	style.border_color = border
	style.set_border_width_all(1)
	style.set_corner_radius_all(9)
	style.content_margin_left = 16
	panel.add_theme_stylebox_override("panel", style)
	parent.add_child(panel)
	return panel

func _ui_theme() -> Theme:
	var theme := Theme.new()
	theme.default_font_size = 17
	var button := StyleBoxFlat.new()
	button.bg_color = Color("#80594b")
	button.border_color = Color("#cba477")
	button.set_border_width_all(1)
	button.set_corner_radius_all(6)
	button.content_margin_left = 16
	button.content_margin_right = 16
	button.content_margin_top = 8
	button.content_margin_bottom = 8
	var hover := button.duplicate() as StyleBoxFlat
	hover.bg_color = Color("#a1755b")
	var pressed := button.duplicate() as StyleBoxFlat
	pressed.bg_color = Color("#614638")
	for type in ["Button", "OptionButton"]:
		theme.set_stylebox("normal", type, button)
		theme.set_stylebox("hover", type, hover)
		theme.set_stylebox("pressed", type, pressed)
		theme.set_stylebox("focus", type, hover)
		theme.set_color("font_color", type, Color("#fff0d6"))
	var field := StyleBoxFlat.new()
	field.bg_color = Color("#1a2330")
	field.border_color = Color("#8f786a")
	field.set_border_width_all(1)
	field.set_corner_radius_all(6)
	field.content_margin_left = 12
	field.content_margin_right = 12
	field.content_margin_top = 8
	field.content_margin_bottom = 8
	theme.set_stylebox("normal", "LineEdit", field)
	theme.set_stylebox("focus", "LineEdit", field)
	theme.set_color("font_color", "Label", Color("#fff0d9"))
	return theme

func _build_ui() -> void:
	ui = CanvasLayer.new()
	add_child(ui)
	storage_error = AcceptDialog.new()
	storage_error.title = "Speicherfehler"
	ui.add_child(storage_error)
	menu = Control.new()
	menu.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	menu.theme = _ui_theme()
	ui.add_child(menu)
	var backdrop := ColorRect.new()
	backdrop.color = Color("#111c2a85")
	backdrop.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	backdrop.mouse_filter = Control.MOUSE_FILTER_IGNORE
	menu.add_child(backdrop)
	_panel(menu, Vector2(44, 44), Vector2(670, 615), Color("#1d2834ef"), Color("#b49a7d"))
	var column := VBoxContainer.new()
	column.position = Vector2(72, 67)
	column.size = Vector2(614, 560)
	column.add_theme_constant_override("separation", 14)
	menu.add_child(column)
	var eyebrow := Label.new()
	eyebrow.text = "✦   EIN ABENTEUER IN WORTEN"
	eyebrow.add_theme_font_size_override("font_size", 14)
	eyebrow.add_theme_color_override("font_color", Color("#e0bc8c"))
	column.add_child(eyebrow)
	var title := Label.new()
	title.text = "Wortwelten"
	title.add_theme_font_size_override("font_size", 48)
	column.add_child(title)
	var subtitle := Label.new()
	subtitle.text = "Drei Welten. Ein Abenteuer. Viele neue Wörter."
	subtitle.add_theme_color_override("font_color", Color("#c6c1b6"))
	column.add_child(subtitle)
	profile_select = OptionButton.new()
	column.add_child(profile_select)
	profile_select.item_selected.connect(_select_profile)
	var row := HBoxContainer.new()
	column.add_child(row)
	var name_input := LineEdit.new()
	name_input.placeholder_text = "Neues Spielerprofil"
	name_input.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(name_input)
	_button(row, "PROFIL ANLEGEN", func():
		if data.is_empty():
			status.text = "Der ungültige Spielstand muss zuerst überprüft werden."
			return
		var value := name_input.text.strip_edges()
		if value.is_empty():
			status.text = "Bitte einen Namen eingeben."
			return
		for name in data.profiles:
			if name.to_lower() == value.to_lower():
				status.text = "Dieses Profil existiert bereits."
				return
		data.profiles[value] = {"stats": {}, "highscore": 0}
		data.selected = value
		if _save():
			name_input.clear()
			_show_menu()
	)
	_button(column, "ABENTEUER STARTEN", _start_game)
	_button(column, "VOKABELN ALS CSV IMPORTIEREN", func(): dialog.popup_centered_ratio(.8))
	status = Label.new()
	status.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	column.add_child(status)
	dialog = FileDialog.new()
	dialog.access = FileDialog.ACCESS_FILESYSTEM
	dialog.file_mode = FileDialog.FILE_MODE_OPEN_FILE
	dialog.add_filter("*.csv", "CSV-Datei")
	dialog.file_selected.connect(_import_csv)
	ui.add_child(dialog)
	game_ui = Control.new()
	game_ui.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	game_ui.theme = menu.theme
	game_ui.mouse_filter = Control.MOUSE_FILTER_IGNORE
	ui.add_child(game_ui)
	_panel(game_ui, Vector2(18, 14), Vector2(1096, 112), Color("#192431dd"), Color("#b79a77"))
	info = Label.new()
	info.position = Vector2(38, 23)
	info.add_theme_font_size_override("font_size", 19)
	info.add_theme_color_override("font_color", Color("#e4c49b"))
	game_ui.add_child(info)
	prompt = Label.new()
	prompt.position = Vector2(38, 62)
	prompt.size = Vector2(1045, 58)
	prompt.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	prompt.add_theme_font_size_override("font_size", 28)
	game_ui.add_child(prompt)
	feedback = Label.new()
	feedback.position = Vector2(38, 137)
	feedback.add_theme_font_size_override("font_size", 20)
	feedback.add_theme_color_override("font_color", Color("#ffe4aa"))
	feedback.add_theme_color_override("font_outline_color", Color("#1a2636"))
	feedback.add_theme_constant_override("outline_size", 5)
	game_ui.add_child(feedback)
	var controls_label := Label.new()
	controls_label.text = "LAUF: LEERTASTE / ↑ SPRINGEN · ↓ HINUNTER   |   BOSS: ← → BEWEGEN · ↑ SPRINGEN · LEERTASTE SCHIESSEN"
	_panel(game_ui, Vector2(18, 663), Vector2(1030, 40), Color("#192431cc"), Color("#867765"))
	controls_label.position = Vector2(34, 673)
	controls_label.add_theme_font_size_override("font_size", 14)
	game_ui.add_child(controls_label)
	_button(game_ui, "MENÜ", _show_menu).position = Vector2(1150, 18)

func _select_profile(index: int) -> void:
	if index < 0:
		return
	data.selected = profile_select.get_item_text(index)
	_save()
	_update_status()

func _update_status() -> void:
	if data.is_empty():
		status.text = "Spielstand ungültig. Bitte Sicherung prüfen; es wird nichts überschrieben."
		return
	if data.selected == "" or not data.profiles.has(data.selected):
		status.text = "Bitte ein Profil anlegen."
		return
	var p: Dictionary = data.profiles[data.selected]
	status.text = "%s  ·  Highscore: %d  ·  %d gemeinsame Vokabeln\nSpielstände dieser Godot-Version werden getrennt von Browserdaten gespeichert." % [data.selected, p.highscore, data.words.size()]

func _show_menu() -> void:
	state = "menu"
	hero_bow.visible = false
	menu.visible = true
	game_ui.visible = false
	profile_select.clear()
	if data.is_empty():
		_update_status()
		return
	var selected := -1
	for name in data.profiles:
		profile_select.add_item(name)
		if name == data.selected:
			selected = profile_select.item_count - 1
	profile_select.select(selected)
	_update_status()

func _import_csv(path: String) -> void:
	if data.is_empty():
		status.text = "Der ungültige Spielstand muss zuerst überprüft werden."
		return
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		status.text = "CSV-Datei konnte nicht geöffnet werden."
		return
	var incoming: Array = []
	var existing := {}
	for word in data.words:
		existing[word.english.to_lower()] = true
	var line := 0
	while not file.eof_reached():
		var raw := file.get_line().trim_suffix("\r")
		line += 1
		if raw.strip_edges().is_empty():
			continue
		if raw.contains('"'):
			status.text = "CSV-Zeile %d: Anführungszeichen werden noch nicht unterstützt." % line
			return
		var delimiter := ";" if raw.contains(";") else ","
		var fields := raw.split(delimiter)
		if fields.size() != 2:
			status.text = "CSV-Zeile %d: zwei einfache Spalten erwartet." % line
			return
		var german := fields[0].strip_edges().trim_prefix("\ufeff")
		var english := fields[1].strip_edges()
		if line == 1 and german.to_lower() == "deutsch" and english.to_lower() == "englisch":
			continue
		if german.is_empty() or english.is_empty() or existing.has(english.to_lower()):
			status.text = "CSV-Zeile %d: leere oder doppelte Vokabel." % line
			return
		existing[english.to_lower()] = true
		incoming.append({"german": german, "english": english})
	data.words.append_array(incoming)
	if _save():
		_update_status()
		status.text += "\n%d Vokabeln importiert." % incoming.size()

func _start_game() -> void:
	if data.is_empty() or not data.profiles.has(data.selected):
		status.text = "Bitte zuerst ein Profil auswählen."
		return
	profile = data.selected
	score = 0
	level = 0
	level_start_score = 0
	speed_start_score = 0
	speed_end_score = 1000
	lives = 12
	correct_count = 0
	boss_defeated = [false, false, false]
	last_word = -1
	encounter_x = 17
	choice_locked = false
	choice_correct = false
	chosen_path = -1
	encounter_resolved = false
	encounter_number = 0
	run_distance = 0
	player_y = 0
	grounded = true
	on_bridge = false
	active_hazard = ""
	hazard_age = 0
	jump_y = 0
	jump_velocity = 0
	gait_phase = 0
	shoot_pose = 0
	hurt_pose = 0
	feedback.text = ""
	message_timer = 0
	hero_bow.visible = false
	state = "run"
	menu.visible = false
	game_ui.visible = true
	_new_question(2)
	_refresh_world()
	_update_ui()

func _category(word: Dictionary) -> int:
	var stats: Dictionary = data.profiles[profile].stats.get(word.english, {"right": 0, "wrong": 0})
	var total: int = stats.right + stats.wrong
	if total == 0 or stats.right * 2 <= total:
		return 0
	if stats.right >= 3 and stats.right * 5 >= total * 4:
		return 2
	return 1

func _new_question(count: int) -> void:
	var groups := [[], [], []]
	for i in data.words.size():
		groups[_category(data.words[i])].append(i)
	var weights := [20, 50, 30]
	var total := 0
	for i in 3:
		if not groups[i].is_empty():
			total += weights[i]
	var draw := randi_range(1, total)
	var category := 0
	for i in 3:
		if not groups[i].is_empty():
			draw -= weights[i]
			if draw <= 0:
				category = i
				break
	var candidates: Array = groups[category].duplicate()
	if candidates.size() > 1:
		candidates.erase(last_word)
	current_word = candidates.pick_random()
	last_word = current_word
	var word: Dictionary = data.words[current_word]
	var english_answers := randf() < .5
	var field := "english" if english_answers else "german"
	var pool: Array = []
	for other in data.words:
		if other[field].to_lower() != word[field].to_lower() and not pool.has(other[field]):
			pool.append(other[field])
	if pool.is_empty():
		field = "english"
		pool.clear()
		for other in data.words:
			if other.english.to_lower() != word.english.to_lower():
				pool.append(other.english)
	correct_answer = word[field]
	question_text = ("Übersetze ins Englische: " + word.german) if field == "english" else ("Übersetze ins Deutsche: " + word.english)
	pool.shuffle()
	answers = [correct_answer]
	for value in pool:
		if answers.size() >= count:
			break
		answers.append(value)
	answers.shuffle()

func _record(correct: bool) -> void:
	var word: Dictionary = data.words[current_word]
	var stats: Dictionary = data.profiles[profile].stats.get(word.english, {"right": 0, "wrong": 0})
	if correct:
		score += [100, 50, 10][_category(word)]
		correct_count += 1
		lives = mini(20, lives + 1)
		stats.right += 1
	else:
		stats.wrong += 1
		_lose_life()
	data.profiles[profile].stats[word.english] = stats
	data.profiles[profile].highscore = maxi(data.profiles[profile].highscore, score)
	_save()

func _lose_life() -> void:
	lives = maxi(0, lives - 4)
	hurt_pose = .4
	speed_start_score = score
	var end := level_start_score + 1000
	speed_end_score = end if score < end else score + 1000

func _speed() -> float:
	return 4.0 * (1.0 + clampf(float(score - speed_start_score) / float(speed_end_score - speed_start_score), 0.0, 1.0))

func _set_feedback(text: String) -> void:
	feedback.text = text
	message_timer = 2.5

func _update_ui() -> void:
	info.text = "LEVEL %d  ·  %s     %d Punkte     ♥ %.2f" % [level + 1, LEVELS[level], score, float(lives) / 4.0]
	if state == "boss":
		info.text += "     %s: %d / 5" % [BOSSES[level], boss_health]
	prompt.text = question_text

func _start_boss() -> void:
	state = "boss"
	hero_bow.visible = true
	boss_health = 5
	fire_timer = 2.5
	invulnerable = 0
	boss_x = -5
	jump_y = 0
	jump_velocity = 0
	player_y = 0
	grounded = true
	on_bridge = false
	active_hazard = ""
	arrows.clear()
	projectiles.clear()
	_new_question(3)
	_refresh_world()
	_set_feedback(BOSSES[level] + " erscheint!")
	_update_ui()

func _finish_boss() -> void:
	boss_defeated[level] = true
	if level < 2:
		level += 1
		level_start_score = score
		speed_start_score = score
		speed_end_score = score + 1000
	state = "run"
	hero_bow.visible = false
	encounter_x = 17
	choice_locked = false
	choice_correct = false
	chosen_path = -1
	encounter_resolved = false
	encounter_number += 1
	run_distance = 0
	player_y = 0
	grounded = true
	on_bridge = false
	active_hazard = ""
	hazard_age = 0
	jump_y = 0
	jump_velocity = 0
	_new_question(2)
	_refresh_world()
	_set_feedback("Boss besiegt!")
	_update_ui()

func _end_game() -> void:
	state = "over"
	prompt.text = "Abenteuer beendet! %d Punkte" % score
	_set_feedback("Wähle MENÜ für einen neuen Lauf.")

func _unhandled_input(event: InputEvent) -> void:
	if not event is InputEventKey or not event.pressed or event.echo:
		return
	var key: Key = event.keycode
	if state == "run" and not choice_locked and (key == KEY_SPACE or key == KEY_UP or key == KEY_W) and grounded:
		jump_velocity = RUN_JUMP_SPEED
		grounded = false
		on_bridge = false
	elif state == "run" and not choice_locked and (key == KEY_DOWN or key == KEY_S) and on_bridge:
		on_bridge = false
		grounded = false
		player_y -= .05
	elif state == "boss":
		if (key == KEY_UP or key == KEY_W) and jump_y <= .001:
			jump_velocity = 9.5
		elif key == KEY_SPACE and arrows.is_empty():
			var arrow_y := jump_y + actor.scale.y * 1.14
			arrows.append({"x": boss_x + .34, "y": arrow_y, "mesh": _box(obstacles, Vector3(.7, .07, .08), Vector3(boss_x + .34, arrow_y, .6), Color("#ffdf9a"))})
			shoot_pose = .25

func _animate_actor(delta: float) -> void:
	var walking := state == "run" or Input.is_key_pressed(KEY_LEFT) or Input.is_key_pressed(KEY_A) or Input.is_key_pressed(KEY_RIGHT) or Input.is_key_pressed(KEY_D)
	var airborne := (state == "boss" and jump_y > .001) or (state in ["run", "hit", "falling"] and not grounded)
	if walking and not airborne:
		gait_phase += delta * (8.0 + clampf(_speed() / 4.0 - 1.0, 0.0, 1.0) * 3.0)
	shoot_pose = maxf(0.0, shoot_pose - delta)
	hurt_pose = maxf(0.0, hurt_pose - delta)
	var blend := minf(1.0, delta * 14.0)
	for i in limbs.size():
		var phase: float = [0.0, PI, PI, 0.0][i]
		var swing := sin(gait_phase + phase)
		var limb_target := swing * (.65 if i % 2 == 0 else .8) if walking else 0.0
		var joint_target := -maxf(0.0, -swing) * .8 if i % 2 == 0 and walking else (-.3 if i % 2 == 1 and walking else 0.0)
		if airborne:
			limb_target = [.45, -.7, -.55, .7][i]
			joint_target = [-.65, -.25, -.45, -.25][i]
		if state == "boss" and shoot_pose > 0 and i == 3:
			limb_target = 1.1
			joint_target = -.15
		limbs[i].rotation.z = lerp_angle(limbs[i].rotation.z, limb_target, blend)
		joints[i].rotation.z = lerp_angle(joints[i].rotation.z, joint_target, blend)
	var bob := absf(sin(gait_phase)) * .055 if walking and not airborne else 0.0
	actor.position.y = (player_y if state in ["run", "hit", "falling"] else jump_y) + bob
	var lean := (minf(hazard_age * 3.0, 1.3) if state in ["hit", "falling"] else (.2 if hurt_pose > 0 else (-.12 if airborne else (sin(gait_phase * 2.0) * .025 if walking else 0.0))))
	actor.rotation.z = lerp_angle(actor.rotation.z, lean, blend)
	scarf_tail.rotation.z = lerp_angle(scarf_tail.rotation.z, -.12 + sin(elapsed * 6.0) * (.18 if walking else .06), blend)
	var blink := fposmod(elapsed, 4.0)
	hero_eye.scale.y = maxf(.08, absf(blink - 3.75) / .12) if blink > 3.63 and blink < 3.87 else 1.0
	hero_shadow.position.x = actor.position.x
	var shadow_ground := (_bridge_y() if on_bridge else _floor_at(run_distance)) if state in ["run", "hit", "falling"] else 0.0
	hero_shadow.position.y = shadow_ground + .08
	hero_shadow.visible = state != "falling"
	var shadow_height := maxf(0.0, player_y - shadow_ground) if state in ["run", "hit", "falling"] else jump_y
	var shadow_scale := 1.0 - clampf(shadow_height * .12, 0.0, .35)
	hero_shadow.scale.x = shadow_scale
	hero_shadow.scale.z = .55 * shadow_scale

func _next_encounter() -> void:
	encounter_number += 1
	encounter_x = 17.0
	choice_locked = false
	choice_correct = false
	chosen_path = -1
	encounter_resolved = false
	active_hazard = ""
	hazard_age = 0
	if on_bridge:
		on_bridge = false
		grounded = false
	_new_question(2)
	_built_encounter()
	_update_ui()

func _process_run(delta: float) -> void:
	var distance := _speed() * delta
	var previous_floor := _floor_at(run_distance)
	near_scroll = fposmod(near_scroll + distance * .28, 46.8)
	far_scroll = fposmod(far_scroll + distance * .10, 46.8)
	for i in scenery.size():
		scenery[i].position.x = fposmod(float(i) * 23.4 - near_scroll + 11.7, 46.8) - 11.7
		distant_scenery[i].position.x = fposmod(float(i) * 23.4 - far_scroll + 11.7, 46.8) - 11.7
	run_distance += distance
	encounter_x -= distance
	boss_node.position.x = encounter_x
	actor.position.x = -5
	var bridge_y := _bridge_y()
	var above_bridge := encounter_x + BRIDGE_START <= -5.0 and encounter_x + BRIDGE_END >= -5.0
	if grounded and on_bridge and not above_bridge:
		grounded = false
		on_bridge = false
	if grounded:
		player_y = bridge_y if on_bridge else _floor_at(run_distance)
	else:
		player_y += _floor_at(run_distance) - previous_floor
		var previous_y := player_y
		jump_velocity -= 17.0 * delta
		player_y += jump_velocity * delta
		if above_bridge and (not choice_locked or chosen_path == 0) and jump_velocity <= 0 and previous_y >= bridge_y and player_y <= bridge_y:
			player_y = bridge_y
			jump_velocity = 0
			grounded = true
			on_bridge = true
		elif player_y <= _floor_at(run_distance):
			player_y = _floor_at(run_distance)
			jump_velocity = 0
			grounded = true
			on_bridge = false
	jump_y = maxf(0.0, player_y - _floor_at(run_distance))
	if encounter_x <= -5.0 and not choice_locked:
		choice_locked = true
		chosen_path = 0 if on_bridge or (above_bridge and player_y >= bridge_y) else 1
		if chosen_path == 0:
			player_y = bridge_y
			jump_velocity = 0
			grounded = true
			on_bridge = true
		choice_correct = answers[chosen_path] == correct_answer
	if choice_locked and not encounter_resolved and encounter_x + TRAP_OFFSET <= -5.0:
		encounter_resolved = true
		_record(choice_correct)
		if choice_correct:
			_set_feedback("Richtig!")
			_update_ui()
			if not boss_defeated[level] and score - level_start_score >= 1000:
				_start_boss()
				return
		else:
			active_hazard = (UPPER_HAZARDS if chosen_path == 0 else LOWER_HAZARDS)[encounter_number % 6]
			hazard_age = 0
			state = "falling" if active_hazard in ["bridge", "trapdoor"] else "hit"
			grounded = false
			jump_velocity = 1.0 if state == "hit" else -1.0
			_set_feedback(HAZARD_NAMES[active_hazard] + " −1 Leben")
			_update_ui()
			return
	if encounter_x < -13.1:
		_next_encounter()

func _process_damage(delta: float) -> void:
	hazard_age += delta
	jump_velocity -= 12.0 * delta
	player_y += jump_velocity * delta
	if state == "hit":
		player_y = maxf(_floor_at(run_distance) + (BRIDGE_HEIGHT if chosen_path == 0 else 0.0), player_y)
	jump_y = maxf(0.0, player_y - _floor_at(run_distance))
	if hazard_age >= 1.1:
		if lives <= 0:
			_end_game()
			return
		player_y = _floor_at(run_distance)
		jump_y = 0
		jump_velocity = 0
		grounded = true
		on_bridge = false
		state = "run"
		_next_encounter()

func _process(delta: float) -> void:
	if state not in ["run", "boss", "hit", "falling"]:
		return
	delta = minf(delta, .05)
	elapsed += delta
	message_timer -= delta
	if message_timer <= 0:
		feedback.text = ""
	if state == "run":
		_process_run(delta)
	elif state in ["hit", "falling"]:
		_process_damage(delta)
	elif state == "boss":
		jump_velocity -= 17.0 * delta
		jump_y = maxf(0.0, jump_y + jump_velocity * delta)
		if jump_y == 0:
			jump_velocity = 0
		_update_boss(delta)
		actor.position.x = boss_x
	if state in ["run", "hit", "falling"]:
		_render_terrain()
		_animate_hazards()
	_animate_actor(delta)

func _update_boss(delta: float) -> void:
	var direction := float(Input.is_key_pressed(KEY_RIGHT) or Input.is_key_pressed(KEY_D)) - float(Input.is_key_pressed(KEY_LEFT) or Input.is_key_pressed(KEY_A))
	boss_x = clampf(boss_x + direction * delta * 4.0, -7, 1)
	for arrow in arrows.duplicate():
		arrow.x += delta * 12
		arrow.mesh.position.x = arrow.x
		if arrow.x >= 3.8:
			arrow.mesh.queue_free()
			arrows.erase(arrow)
			for i in answers.size():
				var y := 1.0 + float(answers.size() - 1 - i) * 1.05
				if absf(arrow.y - y) <= .375:
					var correct: bool = answers[i] == correct_answer
					_record(correct)
					if correct:
						boss_health -= 1
					_set_feedback("Treffer!" if correct else "Falsches Schild! −1 Leben")
					if lives == 0:
						_end_game()
						return
					if boss_health == 0:
						_finish_boss()
						return
					_new_question(3)
					_built_encounter()
					_update_ui()
					break
	fire_timer -= delta
	invulnerable = maxf(0, invulnerable - delta)
	if fire_timer <= 0:
		fire_timer = 2.8
		var ball := _sphere(obstacles, .18, Vector3(3.8, jump_y + 1.0, .6), Color("#ff9a49"))
		projectiles.append({"x": 3.8, "y": jump_y + 1.0, "mesh": ball})
	for ball in projectiles.duplicate():
		ball.x -= delta * 5
		ball.mesh.position.x = ball.x
		if ball.x < boss_x + .4 and ball.x > boss_x - .4 and absf(ball.y - jump_y - 1.0) < .8 and invulnerable == 0:
			_lose_life()
			_save()
			invulnerable = 1.5
			ball.mesh.queue_free()
			projectiles.erase(ball)
			_set_feedback("Geschoss! −1 Leben")
			_update_ui()
			if lives == 0:
				_end_game()
				return
		elif ball.x < -10:
			ball.mesh.queue_free()
			projectiles.erase(ball)

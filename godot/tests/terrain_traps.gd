extends SceneTree

var game: Node
var failures: Array[String] = []

func _initialize() -> void:
	call_deferred("_test")

func check(condition: bool, message: String) -> void:
	if not condition:
		failures.append(message)
		push_error(message)

func tick_until(predicate: Callable, limit := 500) -> void:
	for i in limit:
		if predicate.call():
			return
		game._process(.016)
	check(false, "Timed out waiting for game state")

func mesh_top(node: Node, parent_transform: Transform3D) -> float:
	var highest := -INF
	for child in node.get_children():
		if not child is Node3D or not child.visible:
			continue
		var child_transform: Transform3D = parent_transform * child.transform
		if child is MeshInstance3D:
			var bounds: AABB = child.get_aabb()
			for i in 8:
				highest = maxf(highest, (child_transform * bounds.get_endpoint(i)).y)
		highest = maxf(highest, mesh_top(child, child_transform))
	return highest

func prepare(index: int, path: int, correct: bool, fast := false) -> void:
	game.data.profiles.Test.stats = {}
	game._start_game()
	game.boss_defeated = [true, true, true]
	game.encounter_number = index
	game.encounter_x = 2.4 if fast else 1.2
	game.score = 1000 if fast else 0
	game.answers = ["yes", "no"]
	game.correct_answer = game.answers[path if correct else 1 - path]
	game._built_encounter()
	if path == 0:
		var jump := InputEventKey.new()
		jump.keycode = KEY_SPACE
		jump.pressed = true
		game._unhandled_input(jump)

func _test() -> void:
	game = load("res://main.tscn").instantiate()
	root.add_child(game)
	await process_frame
	game.set_process(false)
	game.data = {
		"words": [{"german": "eins", "english": "one"}, {"german": "zwei", "english": "two"}, {"german": "drei", "english": "three"}],
		"profiles": {"Test": {"stats": {}, "highscore": 0}},
		"selected": "Test"
	}
	check(game.actor.scale.x < 1.0, "Character was not reduced")
	check(game._floor_at(27.0) > game._floor_at(24.0), "Terrain must climb")
	check(game._floor_at(51.0) < game._floor_at(48.0), "Terrain must descend")
	game._start_game()
	game.run_distance = 27.0
	game.player_y = game._floor_at(game.run_distance)
	game._process(.016)
	check(absf(game.actor.position.y - game._floor_at(game.run_distance)) < .1, "Character must follow sloped terrain")
	var hero_height: float = mesh_top(game.actor, Transform3D.IDENTITY) * game.actor.scale.y
	check(game.BRIDGE_HEIGHT - .16 >= hero_height + .2, "Lower route must have headroom for the character")

	for fast in [false, true]:
		for sign_world in [12.0, 24.0, 27.0, 30.0, 48.0, 51.0, 54.0, 72.0, 75.0, 78.0]:
			prepare(1, 0, true, fast)
			game.run_distance = sign_world - game.encounter_x - 5.0
			game.player_y = game._floor_at(game.run_distance)
			game._built_encounter()
			check(game.boss_node.get_node("RouteSign").position.z < game.actor.position.z, "Signs must stay behind the character")
			var boards: Array = game.bridge_middle.get_children()
			for child in game.boss_node.get_children():
				if child is MeshInstance3D:
					boards.append(child)
			for board in boards:
				var top: float = game.boss_node.position.y + board.position.y + .08 * cos(board.rotation.z)
				var floor_y: float = game._floor_at(sign_world + board.position.x)
				check(absf(top - floor_y - game.BRIDGE_HEIGHT) < .04, "Bridge must follow the actual terrain")
			tick_until(func(): return game.choice_locked)
			check(game.chosen_path == 0 and game.on_bridge, "Upper route unreachable at %.1f (fast: %s)" % [sign_world, fast])
			var phase: float = game.gait_phase
			for frame in 15:
				game._process(.016)
				if game.state == "run" and game.on_bridge:
					check(absf(game.player_y - game._bridge_y()) < .001, "Character must stand on the sloped bridge")
			check(game.gait_phase > phase, "Character must walk rather than float on the bridge")
			check(absf(game.hero_shadow.position.y - game._bridge_y() - .08) < .001, "Shadow must follow the bridge")

	for path in 2:
		for index in 6:
			prepare(index, path, false, index == 5)
			check(not game.upper_hazard.visible and not game.lower_hazard.visible, "Hazards must be hidden before choosing")
			tick_until(func(): return game.choice_locked)
			check(game.chosen_path == path, "Wrong route selected for path %d hazard %d" % [path, index])
			check(game.data.profiles.Test.stats.is_empty(), "Decision was recorded before the trap")
			check(game.upper_hazard.visible and game.lower_hazard.visible, "Hazards must appear after choosing")
			var locked_jump := InputEventKey.new()
			locked_jump.keycode = KEY_SPACE
			locked_jump.pressed = true
			game._unhandled_input(locked_jump)
			check(game.grounded and game.jump_velocity == 0.0, "Jump must not change a locked route")
			tick_until(func(): return game.state != "run")
			var expected: String = (game.UPPER_HAZARDS if path == 0 else game.LOWER_HAZARDS)[index]
			check(game.active_hazard == expected, "Wrong trap activated: %s" % expected)
			check(game.lives == 8, "Trap must remove exactly one life")
			check(absf(game._speed() - 4.0) < .001, "Speed must reset after a hit")
			var hazard: Node3D = game.upper_hazard if path == 0 else game.lower_hazard
			check(hazard.get_node("Effect").visible, "Trap effect not visible: %s" % expected)
			if expected == "bridge":
				check(not game.bridge_middle.visible, "Broken bridge must open")
			if expected == "trapdoor":
				check(game.terrain_mesh.mesh.surface_get_array_len(0) < 40 * 6, "Trapdoor must open a hole")
			var moving := hazard.get_node_or_null("Moving") as Node3D
			var old_transform := moving.transform if moving else Transform3D.IDENTITY
			for frame in 4:
				game._process(.05)
			if moving and expected != "pendulum":
				check(moving.transform != old_transform, "Trap must animate: %s" % expected)
			tick_until(func(): return game.state == "run")
			check(game.lives == 8 and game.grounded, "Respawn must preserve remaining lives")
			check(game.encounter_number == index + 1 and not game.choice_locked, "Respawn must continue with another encounter")

	for path in 2:
		prepare(1, path, true)
		tick_until(func(): return game.choice_locked)
		check(game.chosen_path == path, "Correct route could not be reached")
		check(game.score == 0, "Score awarded before the trap")
		tick_until(func(): return game.encounter_resolved)
		check(game.state == "run" and game.score == 100 and game.lives == 13, "Correct route must be safe and award points")
		check(game.active_hazard == "", "Correct route must not trigger a trap")
		tick_until(func(): return game.encounter_number == 2)

	prepare(1, 0, true)
	tick_until(func(): return game.on_bridge)
	var down := InputEventKey.new()
	down.keycode = KEY_DOWN
	down.pressed = true
	game._unhandled_input(down)
	tick_until(func(): return game.choice_locked)
	check(game.chosen_path == 1, "Down must allow leaving the bridge before choosing")

	prepare(0, 1, false)
	game.lives = 4
	tick_until(func(): return game.state == "falling")
	tick_until(func(): return game.state == "over")
	check(game.lives == 0, "The last life must end the game after the fall")

	game._start_game()
	game.score = 900
	game.encounter_x = -8.9
	game.answers = ["no", "yes"]
	game.correct_answer = "yes"
	game.choice_locked = true
	game.chosen_path = 1
	game.choice_correct = true
	game._process(.05)
	check(game.state == "boss" and game.level == 0, "1000 points must start the first boss")
	for expected_level in 3:
		check(game.state == "boss" and game.level == expected_level, "Wrong boss level")
		check(game.hero_bow.visible, "Boss bow missing")
		game.boss_x = 1.0
		game.fire_timer = 100.0
		for hit in 5:
			tick_until(func(): return game.jump_y == 0.0)
			game.answers = ["top", "middle", "bottom"]
			var target := hit % 3
			game.correct_answer = game.answers[target]
			var target_y := 1.0 + float(2 - target) * 1.05
			if target != 2:
				var jump := InputEventKey.new()
				jump.keycode = KEY_UP
				jump.pressed = true
				game._unhandled_input(jump)
				tick_until(func(): return game.jump_y + game.actor.scale.y * 1.14 >= target_y - .12)
			var shot := InputEventKey.new()
			shot.keycode = KEY_SPACE
			shot.pressed = true
			game._unhandled_input(shot)
			check(game.arrows.size() == 1, "Boss arrow did not fire")
			tick_until(func(): return game.state != "boss" or game.boss_health == 4 - hit)
		check(game.state == "run", "Five real arrow hits must defeat the boss")
		if expected_level < 2:
			check(game.level == expected_level + 1, "Boss defeat must advance level")
			game._start_boss()
	check(game.boss_defeated == [true, true, true], "All bosses must be defeated")

	for frame in 10:
		await process_frame
	if failures.is_empty():
		print("Terrain and trap tests passed")
		quit(0)
	else:
		print("%d checks failed" % failures.size())
		quit(1)

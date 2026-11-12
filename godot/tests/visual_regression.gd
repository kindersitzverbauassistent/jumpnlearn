extends SceneTree

func _initialize() -> void:
	call_deferred("_test")

func _test() -> void:
	var game = load("res://main.tscn").instantiate()
	root.add_child(game)
	await process_frame
	game.set_process(false)
	game.data = {
		"words": [{"german": "eins", "english": "one"}, {"german": "zwei", "english": "two"}],
		"profiles": {"Test": {"stats": {}, "highscore": 0}},
		"selected": "Test"
	}
	game._start_game()
	game._process(.01)
	var previous_near: float = game.scenery[0].position.x
	var previous_far: float = game.distant_scenery[0].position.x
	game.score = 500
	game._process(.01)
	assert(absf(game.scenery[0].position.x - previous_near) < .1)
	assert(absf(game.distant_scenery[0].position.x - previous_far) < .1)
	assert(absf(game.limbs[0].rotation.z + game.limbs[2].rotation.z) < .001)
	for i in 12:
		game._animate_actor(.05)
	assert(absf(game.limbs[0].rotation.z) > .05)
	assert(absf(game.joints[0].rotation.z) > .01 or absf(game.joints[2].rotation.z) > .01)
	game.jump_y = 1.0
	game.player_y = game._floor_at(game.run_distance) + 1.0
	game.grounded = false
	for i in 8:
		game._animate_actor(.05)
	assert(game.limbs[0].rotation.z > .3 and game.limbs[2].rotation.z < -.3)
	assert(game.hero_shadow.scale.x < 1.0)
	game._start_boss()
	assert(game.hero_bow.visible)
	for i in 20:
		game._animate_actor(.05)
	assert(absf(game.limbs[0].rotation.z) < .01)
	var shoot := InputEventKey.new()
	shoot.keycode = KEY_SPACE
	shoot.pressed = true
	game._unhandled_input(shoot)
	assert(game.arrows.size() == 1 and game.shoot_pose > 0)
	game._animate_actor(.05)
	assert(game.limbs[3].rotation.z > .5)
	game._finish_boss()
	assert(not game.hero_bow.visible)
	var text := "Eine besonders lange Übersetzung für das Antwortschild"
	var label: Label3D = game._label_3d(game.actor, text, Vector3.ZERO, 34, 2.0)
	var width := ThemeDB.fallback_font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, 34).x
	assert(width * label.pixel_size <= 2.001)
	print("Visual regression tests passed")
	quit()

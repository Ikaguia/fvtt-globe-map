import "../lib/maplibre-gl/maplibre-gl.js";

Hooks.once('init', async function() {
	// CONFIG.debug.hooks = true;
});

Hooks.once('ready', async function() {
	const maplibregl = window.maplibregl;
});

Hooks.on("canvasReady", (canvas) => {
	const enabled = canvas.scene.getFlag("fvtt-globe-map", "enabled");
	if (!enabled) return;

	const container = document.createElement("div");
	container.id = "maplibre-container";
	Object.assign(container.style, {
		position: "absolute",
		top: 0,
		left: 0,
		width: "100%",
		height: "100%",
		zIndex: 50
	});
	document.body.appendChild(container);

	console.log("MapLibre version:", maplibregl.version);
	console.log("MapLibre projections:", maplibregl.projections);
	const map = new maplibregl.Map({
		container: "maplibre-container",
		style: "https://demotiles.maplibre.org/style.json",
		center: [0, 0],
		zoom: 1
	});

	map.once("style.load", () => {
		console.log("Style loaded. Attempting to switch to globe projection...");
		try {
			map.setProjection({ type: "globe" });
			console.log("Projection set to globe.");
		} catch (err) {
			console.error("Failed to set projection:", err);
		}

		// map.addLayer({
		// 	id: "sky",
		// 	type: "sky",
		// 	paint: {
		// 		"sky-type": "atmosphere",
		// 		"sky-atmosphere-sun": [0.0, 0.0],
		// 		"sky-atmosphere-sun-intensity": 15
		// 	}
		// });
	});
});

Hooks.on("renderSceneConfig", (app, html, data) => {
	const $html = $(html);

	const current = foundry.utils.getProperty(app.document, "flags.fvtt-globe-map.enabled");

	const flagHtml = $(`
		<div class="form-group">
			<label>Enable MapLibre Globe</label>
			<input type="checkbox" name="flags.fvtt-globe-map.enabled" ${current ? "checked" : ""}/>
		</div>
	`);

	$html.find("div[data-tab='basics']").append(flagHtml);
});

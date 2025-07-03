Hooks.once('init', async function() {
		CONFIG.debug.hooks = true;
		await loadScript("https://unpkg.com/maplibre-gl@2.4.0/dist/maplibre-gl.js");
});

Hooks.once('ready', async function() {

});

Hooks.on("canvasReady", async () => {
	if (!canvas.scene.getFlag("maplibre-globe", "enabled")) return;

	const container = document.createElement("div");
	container.id = "maplibre-container";
	container.style.position = "absolute";
	container.style.top = "0";
	container.style.left = "0";
	container.style.width = "100%";
	container.style.height = "100%";
	container.style.zIndex = "30"; // Above tokens/layers
	document.body.appendChild(container);

	const map = new maplibregl.Map({
		container: "maplibre-container",
		style: "https://demotiles.maplibre.org/style.json", // Replace with your globe tiles
		center: [0, 0],
		zoom: 1,
		projection: "globe"
	});

	map.on("load", () => {
		console.log("MapLibre GL map loaded");
	});
});

Hooks.on("renderSceneConfig", (app, html, data) => {
	const $html = $(html);

	const current = foundry.utils.getProperty(app.document, "flags.maplibre-globe.enabled");

	const flagHtml = $(`
		<div class="form-group">
			<label>Enable MapLibre Globe</label>
			<input type="checkbox" name="flags.maplibre-globe.enabled" ${current ? "checked" : ""}/>
		</div>
	`);

	$html.find("div[data-tab='basics']").append(flagHtml);
});

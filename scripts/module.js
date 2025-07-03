Hooks.once('init', async function() {
		CONFIG.debug.hooks = true;
});

Hooks.once('ready', async function() {

});

Hooks.on("canvasReady", async (canvas) => {
  const enabled = canvas.scene.getFlag("fvtt-globe-map", "enabled");
  if (!enabled) return;

  await loadScript("https://unpkg.com/maplibre-gl@2.4.0/dist/maplibre-gl.js");
  await loadCSS("https://unpkg.com/maplibre-gl@2.4.0/dist/maplibre-gl.css");

  let container = document.getElementById("maplibre-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "maplibre-container";
    Object.assign(container.style, {
      position: "absolute",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      zIndex: 50,
      pointerEvents: "auto"
    });
    document.body.appendChild(container);
  }

  const map = new maplibregl.Map({
    container: "maplibre-container",
    style: "https://demotiles.maplibre.org/style.json",
    center: [0, 0],
    zoom: 1,
    projection: "globe"
  });

  map.on("load", () => {
    console.log("MapLibre map loaded");
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

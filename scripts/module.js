import { TokenMarkers } from "./token-on-globe.js";
import { createMap } from "./map.js";

Hooks.once('init', async function() {
	// CONFIG.debug.hooks = true;
});

Hooks.once('ready', async function() {
	const maplibregl = window.maplibregl;
});

Hooks.on("canvasReady", (canvas) => {
	const enabled = canvas.scene.getFlag("fvtt-globe-map", "enabled");
	if (!enabled) return;

	// Map container
	const container = document.createElement("div");
	container.id = "maplibre-container";
	Object.assign(container.style, {
		position: "absolute",
		top: 0,
		left: 0,
		width: "100%",
		height: "100%",
		zIndex: 10
	});
	document.body.appendChild(container);

	// Map
	const [map, projection] = createMap();

	// Maximize/Minimize button
	const toggleBtn = document.createElement("button");
	toggleBtn.innerText = "—"; // "—" for minimize, "☐" for maximize later
	Object.assign(toggleBtn.style, {
		position: "absolute",
		top: "10px",
		right: "60px",
		zIndex: 9999,
		background: "#fff",
		border: "1px solid #ccc",
		borderRadius: "5px",
		padding: "2px 8px",
		cursor: "pointer",
		userSelect: "none"
	});
	document.body.appendChild(toggleBtn);

	let minimized = false;
	toggleBtn.addEventListener("click", () => {
		if (!minimized) {
			// Minimize: move container to top-right corner, shrink size, disable pointer
			Object.assign(container.style, {
				width: "20vw",
				height: "20vh",
				top: "10px",
				left: "auto",
				right: "60px",
				bottom: "auto",
				pointerEvents: "none",
				border: "1px solid #ccc",
				borderRadius: "5px",
				boxShadow: "0 0 10px rgba(0,0,0,0.3)",
				transition: "all 0.3s ease"
			});
			map.setProjection({ type: "mercator" });
			toggleBtn.innerText = "☐";  // Change button to "maximize" icon
			minimized = true;
		} else {
			// Maximize: restore full screen and pointer interaction
			Object.assign(container.style, {
				width: "100%",
				height: "100%",
				top: 0,
				left: 0,
				right: "auto",
				bottom: "auto",
				pointerEvents: "auto",
				border: "none",
				borderRadius: "0",
				boxShadow: "none",
				transition: "all 0.3s ease"
			});
			map.setProjection({ type: projection });
			toggleBtn.innerText = "—"; // Change button back to "minimize"
			minimized = false;
		}
	});

	Hooks.once("fvtt-globe-map.style.load", (map) => {
		// Tokens on map
		const tokenMarkers = new TokenMarkers(map, canvas.scene);
		// Token movement
		Hooks.on("createToken", () => { tokenMarkers.update(); });
		Hooks.on("updateToken", () => { tokenMarkers.update(); });
		Hooks.on("deleteToken", () => { tokenMarkers.update(); });
		Hooks.on("updateScene", () => { tokenMarkers.update(); });
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

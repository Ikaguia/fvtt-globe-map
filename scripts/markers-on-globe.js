import * as Marker from './markers/index.js';

export class MapMarkers {
	// MapLibre map instance as `map`
	// Foundry scene instance as `scene`
	constructor(map, scene) {
		this.map = map;
		this.scene = scene;
		this.hooks = new Set();
		// Markers
		this.markers = [
			// Tokens
			new Marker.Token(this),
			// Notes
			new Marker.Note(this),
			// Ruler
			new Marker.Ruler(this),
		];
		// Initial Setup
		this.addMapListeners();
		this.addFoundryHooks();
	}

	destroy() {
		for (const marker of this.markers) marker.destroy?.();
		this.clearFoundryHooks();
		this.map.remove();
		this.map = null;
	}

	// --------------------------- //
	// Getters                     //
	// --------------------------- //

	get padding() { return this.scene.padding }
	get width() { return this.scene.width * (1 + 2 * this.padding) - this.scene.grid.sizeX }
	get height() { return this.scene.height * (1 + 2 * this.padding) }


	// --------------------------- //
	// Listeners                   //
	// --------------------------- //

	addMapListeners() {
		this.map.on("click", (e) => this.onMapClick(e));
		this.map.on("mousemove", (e) => this.onMouseMove(e));
		this.map.on("mousedown", (e) => this.onMouseDown(e));
		this.map.on("mouseup", (e) => this.onMouseUp(e));
		this.map.getCanvas().addEventListener("mouseleave", (e) => this.onMouseLeaveMap(e));

		for (const marker of this.markers) marker.addMapListeners?.();
	}

	addFoundryHook(hook, foo) {
		const id = Hooks.on(hook, foo);
		this.hooks.add([hook, id]);
	}

	addFoundryHooks() {
		for (const marker of this.markers) marker.addFoundryHooks?.();
	}

	clearFoundryHooks() {
		for (const [hookName, hookID] of this.hooks) Hooks.off(hookName, hookID);
		this.hooks.clear();
	}

	// Primary listeners

	onMapClick(event) {
		const features = this.getFeaturesOnPoint(event.point);
		for (const marker of this.markers) {
			const markerFeatures = features[marker.layerID];
			if (markerFeatures?.length) {
				for (const feature of markerFeatures) marker.onClick?.(event, feature.properties.id);
			} else {
				marker.onClick?.(event);
			}
		}
	}

	onMouseMove(event) {
		const features = this.getFeaturesOnPoint(event.point);
		for (const marker of this.markers) marker.onMouseMove?.(event, features[marker.layerID]);
	}

	onMouseLeaveMap(event) {
		for (const marker of this.markers) marker.onLeaveMap?.(event);
	}

	onMouseDown(event) {
		const features = this.getFeaturesOnPoint(event.point);
		for (const marker of this.markers) {
			const markerFeatures = features[marker.layerID];
			if (markerFeatures?.length) {
				for (const feature of markerFeatures) marker.onGrab?.(event, feature.properties.id);
			} else {
				marker.onGrab?.(event);
			}
		}
	}

	onMouseUp(event) {
		// Regular mouse up logic
		const features = this.getFeaturesOnPoint(event.point);
		for (const marker of this.markers) {
			const markerFeatures = features[marker.layerID];
			if (markerFeatures?.length) {
				for (const feature of markerFeatures) marker.onRelease?.(event, feature.properties.id);
			} else {
				marker.onRelease?.(event);
			}
		}
	}

	// --------------------------- //
	// Helpers                     //
	// --------------------------- //

	sceneToLngLat(x, y) {
		const lng = Math.clamp((x / this.width) * 360 - 180, -180, 180);
		const lat = Math.clamp(90 - (y / this.height) * 180, -90, 90);
		return { lng, lat };
	}

	lngLatToScene(lng, lat) {
		const x = Math.clamp(((lng + 180) / 360) * this.width, 0, this.width);
		const y = Math.clamp(((90 - lat) / 180) * this.height, 0, this.height);
		return { x, y };
	}

	groupFeaturesByLayer(features, layers) {
		const grouped = Object.fromEntries(layers.map(l => [l, []]));
		for (const feature of features) grouped[feature.layer.id].push(feature);
		return grouped;
	}

	getFeaturesOnPoint(point, layers=undefined) {
		if (layers === undefined) layers = this.markers.map(m => m.layerID).filter(id => id !== undefined);
		const features = this.map.queryRenderedFeatures(point, { layers });
		return this.groupFeaturesByLayer(features, layers);
	}
}

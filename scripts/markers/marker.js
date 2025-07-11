export class Marker {
	// Setup
	constructor(mapMarkers) {
		this.mapMarkers = mapMarkers;
		this.reset();
	}
	reset() {}
	destroy() {
		this.mapMarkers = null;
	}

	// Marker Functions
	createMarker(data={}) {
		// console.log("createMarker.data:", data);
	}
	updateMarker(data={}) {
		// console.log("updateMarker.data:", data);
	}
	deleteMarker(data={}) {
		// console.log("deleteMarker.data:", data);
	}

	// Getters
	get map() { return this.mapMarkers.map; }
	get scene() { return this.mapMarkers.scene; }

	// MapMarkers Helper Functions
	sceneToLngLat(...args) { return this.mapMarkers.sceneToLngLat(...args); }
	lngLatToScene(...args) { return this.mapMarkers.lngLatToScene(...args); }

	// Hooks
	addFoundryHooks() {}
	addMapListeners() {}

	// Event handlers
	//// Generic
	onMouseMove(event, hovering) {}
	onLeaveMap(event) {}
	//// Specific Marker
	onClick(event, properties={}) {}
	onGrab(event, properties={}) {}
	onRelease(event, properties={}) {}
}

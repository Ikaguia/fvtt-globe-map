export class TokenMarkers {
	// MapLibre map instance as `map`
	// Foundry scene instance as `scene`
	constructor(map, scene) {
		this.map = map;
		this.scene = scene
		this.tokenMarkers = [];

		console.debug("map:", this.map);
		console.debug("scene:", this.scene);
		console.debug("width:", this.width);
		console.debug("height:", this.height);
		console.debug("tokens:", this.tokens);
		console.debug("tokenMarkers:", this.tokenMarkers);

		this.update();
	}

	get padding(){ return this.scene.padding }
	get width(){ return this.scene.width * (1 + 2 * this.padding) - this.scene.grid.sizeX }
	get height(){ return this.scene.height * (1 + 2 * this.padding) }
	get tokens(){ return this.scene.tokens }

	sceneToLatLon(x, y) {
		const lon = Math.clamp((x / this.width) * 360 - 180, -180, 180); // 0 to width → -180 to +180
		const lat = Math.clamp(90 - (y / this.height) * 180,  -90,  90); // 0 to height → +90 to -90
		console.debug("token.x", x, "width", this.width);
		console.debug("token.y", y, "height", this.height);
		console.debug("lon", lon);
		console.debug("lat", lat);
		return { lat, lon };
	}
	createTokenMarker(token) {
		const { x, y } = token;
		const { lat, lon } = this.sceneToLatLon(x, y);

		// Create a DOM element or use MapLibre Marker options
		const el = document.createElement('div');
		el.className = 'token-marker';
		el.style.width = '20px';
		el.style.height = '20px';
		el.style.background = 'red';
		el.style.borderRadius = '50%';

		const marker =  new maplibregl.Marker(el);
		marker.setLngLat([lon, lat]);
		marker.addTo(this.map);
		this.tokenMarkers.push(marker);
	}
	update() {
		// Clear old markers
		this.tokenMarkers.forEach(m => m.remove());
		// Create new markers
		this.tokens.forEach(token => this.createTokenMarker(token));
	}
}
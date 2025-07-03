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
	async createImage(token) {
		const tokenImageUrl = token.texture.src;

		if (!this.map.hasImage(`token-icon-${token.id}`)) {
			try {
				const image = await new Promise((resolve, reject) => {
					this.map.loadImage(tokenImageUrl, (error, image) => {
						if (error) reject(error);
						else resolve(image);
					});
				});
				this.map.addImage(`token-icon-${token.id}`, image);
			} catch (err) {
				console.error("Failed to load token image:", err);
			}
		}
	}

	async createTokenMarker(token) {
		const { x, y } = token;
		const { lat, lon } = this.sceneToLatLon(x, y);

		await this.createImage(token);

		this.map.addSource(`token-source-${token.id}`, {
			type: "geojson",
			data: {
				type: "FeatureCollection",
				features: [{
					type: "Feature",
					geometry: {
						type: "Point",
						coordinates: [lon, lat],
					},
					properties: {}
				}]
			}
		});

		this.map.addLayer({
			id: `token-layer-${token.id}`,
			type: "symbol",
			source: `token-source-${token.id}`,
			layout: {
				"icon-image": `token-icon-${token.id}`,
				"icon-size": 0.25,
				"icon-allow-overlap": true
			}
		});

		this.tokenMarkers.push(token.id);
	}
	update() {
		// Clear old markers
		this.tokenMarkers.forEach(id => {
			this.map.removeLayer(`token-layer-${id}`);
			this.map.removeSource(`token-source-${id}`);
		});
		this.tokenMarkers = [];
		// Create new markers
		this.tokens.forEach(token => this.createTokenMarker(token));
	}
}
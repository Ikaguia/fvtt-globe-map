export class TokenMarkers {
	// MapLibre map instance as `map`
	// Foundry scene instance as `scene`
	constructor(map, scene) {
		this.map = map;
		this.scene = scene;
		this.tokenMarkers = [];

		console.debug("map:", this.map);
		console.debug("scene:", this.scene);
		console.debug("width:", this.width);
		console.debug("height:", this.height);
		console.debug("tokens:", this.tokens);
		console.debug("tokenMarkers:", this.tokenMarkers);

		this.update();
	}

	get padding() { return this.scene.padding }
	get width() { return this.scene.width * (1 + 2 * this.padding) - this.scene.grid.sizeX }
	get height() { return this.scene.height * (1 + 2 * this.padding) }
	get tokens() { return this.scene.tokens }

	sceneToLatLon(x, y) {
		const lon = Math.clamp((x / this.width) * 360 - 180, -180, 180);
		const lat = Math.clamp(90 - (y / this.height) * 180, -90, 90);
		console.debug("token.x", x, "width", this.width, "lon", lon);
		console.debug("token.y", y, "height", this.height, "lat", lat);
		return { lat, lon };
	}

	async createImage(token) {
		const id = `token-icon-${token.id}`;
		const url = token.texture.src;

		if (this.map.hasImage(id)) {
			console.debug(`Image already exists: ${id}`);
			return;
		}

		try {
			const image = await new Promise((resolve, reject) => {
				this.map.loadImage(url, (error, image) => {
					if (error) reject(error);
					else resolve(image);
				});
			});
			this.map.addImage(id, image);
			console.debug(`Loaded and added image for token: ${id}`);
		} catch (err) {
			console.error(`Failed to load token image (${url}):`, err);
		}
	}

	async createTokenMarker(token) {
		console.debug("createTokenMarker", token);
		const { x, y } = token;
		const { lat, lon } = this.sceneToLatLon(x, y);
		const id = token.id;

		await this.createImage(token);

		console.debug(`Creating source and layer for token ${id} at (${lon}, ${lat})`);

		this.map.addSource(`token-source-${id}`, {
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
			id: `token-layer-${id}`,
			type: "symbol",
			source: `token-source-${id}`,
			layout: {
				"icon-image": `token-icon-${id}`,
				"icon-size": 0.25,
				"icon-allow-overlap": true
			}
		});

		this.tokenMarkers.push(id);
	}

	update() {
		// Clear old markers
		this.tokenMarkers.forEach(id => {
			if (this.map.getLayer(`token-layer-${id}`)) this.map.removeLayer(`token-layer-${id}`);
			if (this.map.getSource(`token-source-${id}`)) this.map.removeSource(`token-source-${id}`);
		});
		this.tokenMarkers = [];

		// Create new markers
		this.tokens.forEach(token => this.createTokenMarker(token));
	}
}

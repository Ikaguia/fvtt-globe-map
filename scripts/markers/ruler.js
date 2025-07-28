import { Marker } from "./marker.js";
import * as turf from '../../lib/turf/turf-bundle.js';

export class RulerMarker extends Marker {
	// Setup
	constructor(mapMarkers) {
		super(mapMarkers);
		this.createSourceLayer();
	}
	reset() {
		super.reset();

		this.status = "inactive";
		this.points = [];
		this.features = [];
		this.totalDistance = 0;
		this.temp = null;
	}
	destroy() {
		this.deleteSourceLayer();
		super.destroy();
	}

	// Create
	createSourceLayer(data={}) {
		// Line
		if (!this.lineSource) this.map.addSource(this.lineSourceID, {
			type: "geojson",
			data: this.lineSourceData,
		});
		if (!this.lineLayer) this.map.addLayer({
			id: this.lineLayerID,
			type: "line",
			source: this.lineSourceID,
			paint: {
				"line-color": "#ff0000",
				"line-width": 3
			}
		});
		// Labels
		if (!this.labelSource) this.map.addSource(this.labelSourceID, {
			type: "geojson",
			data: {
				type: "FeatureCollection",
				features: []
			},
		});
		if (!this.labelLayer) this.map.addLayer({
			id: this.labelLayerID,
			type: "symbol",
			source: this.labelSourceID,
			layout: {
				"text-field": ["get", "label"],
				"text-size": 24,
				"text-anchor": "top",
				"text-offset": [0, 1],
				"symbol-placement": "point",
				"text-font": ["NotoSans-Medium"],
				"text-allow-overlap": true,
				"text-ignore-placement": true
			},
			paint: {
				"text-color": "#ffffff",
				"text-halo-color": "#000000",
				"text-halo-width": 1
			},
		});
	}
	createPoint(data={}) {
		const { lng, lat } = data;
		if (!lng || !lat) return;

		const point = [lng, lat];
		const last_point = (this.points.length > 0) ? this.points.at(-1) : undefined;
		this.points.push(point);
		if (last_point) this.features.push(this.labelFeatureData(last_point, point));

		this.updateSourceLayer();
	}
	// Update
	updateSourceLayer(data={}) {
		this.lineSource?.setData(this.lineSourceData);
		this.labelSource?.setData(this.labelSourceData);
	}
	// Delete
	deleteSourceLayer(data={}) {
		if (this.lineLayer) this.map.removeLayer(this.lineLayerID);
		if (this.lineSource) this.map.removeSource(this.lineSourceID);
		if (this.labelLayer) this.map.removeLayer(this.labelLayerID);
		if (this.labelSource) this.map.removeSource(this.labelSourceID);
	}
	deletePoint(data={}) {
		if (this.features.length) this.features.pop();
		if (this.points.length) this.points.pop();

		this.updateSourceLayer();
	}

	// Getters
	get coordinates() {
		const coords = [...this.points];
		if (this.temp) coords.push(this.temp);
		return coords;
	}
	get lineSourceData() {
		return {
			type: "Feature",
			geometry: {
				type: "LineString",
				coordinates: this.coordinates
			}
		}
	}
	get lineSourceID() { return "ruler-line-source"; }
	get lineSource() { return this.map.getSource(this.lineSourceID); }
	get lineLayerID() { return "ruler-line-layer"; }
	get lineLayer() { return this.map.getLayer(this.lineLayerID); }
	get labelSourceData() {
		const features = [...this.features];
		if (this.temp && this.points.length > 0) features.push(this.labelFeatureData(this.points.at(-1), this.temp, true));
		return { type: "FeatureCollection", features };
	}
	get labelSourceID() { return "ruler-label-source"; }
	get labelSource() { return this.map.getSource(this.labelSourceID); }
	get labelLayerID() { return "ruler-label-layer"; }
	get labelLayer() { return this.map.getLayer(this.labelLayerID); }

	get sourceIDs() { return [this.lineSourceID, this.labelSourceID]; }
	get layerIDs() { return [this.lineLayerID, this.labelLayerID]; }

	// Helper Functions
	labelFeatureData(point1, point2, temp=false) {
		const [lng1, lat1] = point1;
		const [lng2, lat2] = point2;

		// Midpoint for label
		const midLng = (lng1 + lng2) / 2;
		const midLat = (lat1 + lat2) / 2;

		// Real distance
		const segment = turf.distance([lng1, lat1], [lng2, lat2], "kilometers");
		const totalDistance = this.totalDistance + segment;

		let label = this.formatDistance(segment);
		if (totalDistance !== segment) label += this.formatDistance(totalDistance);
		if (!temp) this.totalDistance = totalDistance;

		return {
			type: "Feature",
			geometry: {
				type: "Point",
				coordinates: [midLng, midLat]
			},
			properties: { label }
		};
	}
	formatDistance(km) {
		const v = km < 1 ? km * 1000 : km;
		const unit = km < 1 ? "m" : "km";
		return `${v.toFixed(2)} ${unit}`;
	};


	// Hooks
	// addFoundryHooks() {
	// 	super.addFoundryHooks();
	// }
	// addMapListeners() {
	// 	super.addMapListeners();
	// }

	// Event handlers
	onMouseMove(event, properties={}) {
		if (this.status === "active") {
			const { lng, lat } = this.map.unproject(event.point);

			if (!this.temp) {
				const last_point = this.points.at(-1);
				const dlng = Math.abs(lng - last_point[0]);
				const dlat = Math.abs(lat - last_point[1]);
				const distSq = dlng * dlng + dlat * dlat;

				// If more than 3 units from the last point, add a temporary point for where the mouse is
				if (distSq > 9) this.temp = [lng, lat];
			} else this.temp = [lng, lat];
			this.updateSourceLayer();
		}
	}
	onClick(event, properties={}) {
		const ctrl = event.originalEvent.ctrlKey;
		const { lng, lat } = this.map.unproject(event.point);
		// Ruler measurement logic
		if (ctrl) {
			if (this.status === "finished") this.reset();
			this.status = "active";
			this.createPoint({ event, lng, lat });
		} else if (this.status === "active") {
			this.temp = null;
			this.status = "finished";
			this.createPoint({ event, lng, lat });
		}
	}
}

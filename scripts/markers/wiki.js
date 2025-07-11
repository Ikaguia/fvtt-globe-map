import { Marker } from "./marker.js";

export class WikiLinkMarker extends Marker {
	// Getters
	get layerIDs() { return ["location-labels", "location-icons"]; }

	// Event handlers
	onClick(event, properties) {
		if (!event?.originalEvent?.altKey) return;
		if (!properties?.link) return;

		const url = properties.link;
		console.log(`Opening Pathfinder Wiki link: ${url}`);
		window.open(url, "_blank");
	}
}

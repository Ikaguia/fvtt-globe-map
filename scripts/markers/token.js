import { ItemMarker } from "./item.js";

export class TokenMarker extends ItemMarker {
	// Getters
	get type() { return "token"; }
	get sceneItems() { return new Set(this.scene.tokens.map(t => t.id)); }

	// Utility functions
	getItem(id) { return this.scene.tokens.get(id); }

	// Hooks
	addFoundryHooks() {
		super.addFoundryHooks();
		// Token movement
		this.mapMarkers.addFoundryHook("createToken", (token) => { this.createMarker({
			item: token,
			id: token.id,
		}); });
		this.mapMarkers.addFoundryHook("updateToken", (token, upd) => { this.updateMarker({
			item: token,
			id: token.id,
			updateImage: "texture" in upd,
		}); });
		this.mapMarkers.addFoundryHook("refreshToken", (token) => { this.updateMarker({
			item: token.document,
			id: token.document.id,
		}); });
		this.mapMarkers.addFoundryHook("deleteToken", (token) => { this.deleteMarker({
			item: token,
			id: token.id,
		}); });
		this.mapMarkers.addFoundryHook("updateScene", () => { this.updateAll(); });
	}
}

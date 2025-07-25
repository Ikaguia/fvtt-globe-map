import { ItemMarker } from "./item.js";

export class NoteMarker extends ItemMarker {
	// Getters
	get type() { return "note"; }
	get sceneItems() { return new Set(this.scene.notes.map(t => t.id)); }

	// Utility functions
	getItem(id) { return this.scene.notes.get(id); }
	// getSize(id) { return (this.getItem(id)?.iconSize ?? 40) / this.mapMarkers.width; }
	getSize(id) { return (this.getItem(id)?.iconSize ?? 40) / 40; }
	getScalable(id) { return (this.getItem(id)?.elevation ?? 0) === 0; }
	hasPermission(data, permission="OWNER") {
		const item = data.item ?? this.getItem(data.id);
		return item?.entry?.testUserPermission(game.user, permission);
	}


	// Hooks
	addFoundryHooks() {
		super.addFoundryHooks();
		// Note movement
		this.mapMarkers.addFoundryHook("createNote", (note) => { this.createMarker({
			item: note,
			id: note.id,
		}); });
		this.mapMarkers.addFoundryHook("updateNote", (note, upd) => { this.updateMarker({
			item: note,
			id: note.id,
			updateImage: "texture" in upd,
		}); });
		this.mapMarkers.addFoundryHook("refreshNote", (note) => { this.updateMarker({
			item: note.document,
			id: note.document.id,
		}); });
		this.mapMarkers.addFoundryHook("deleteNote", (note) => { this.deleteMarker({
			item: note,
			id: note.id,
		}); });
		this.mapMarkers.addFoundryHook("updateScene", () => { this.updateAll(); });
	}

	// Event handlers
	onClick(event, properties={}) {
		const { id } = properties;
		const item = this.getItem(id);
		if (!id || !item || !this.hasPermission({ item }, "LIMITED")) return;
		item.entry?.sheet?.render?.(true);
	}
}

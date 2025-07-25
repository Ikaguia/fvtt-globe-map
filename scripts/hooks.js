const DEBUG = false;

function addHook(id, hookID) {
	libWrapper.register('fvtt-globe-map', id, function (wrapped, ...args) {
		if (DEBUG) console.debug(`libWrapper hook '${id}' start`);
		const allowed = Hooks.call('fvtt-globe-map.pre' + (hookID ?? id), this, ...args);
		if (allowed === false) return;
		const result = wrapped(...args);
		const config = { result };
		Hooks.call('fvtt-globe-map.' + (hookID ?? id), this, result, config, ...args);
		if (DEBUG) console.debug(`libWrapper hook '${id}' end`);
		return config.result;
	}, 'WRAPPER');
}

function addHookAsync(id, hookID) {
	libWrapper.register('fvtt-globe-map', id, async function (wrapped, ...args) {
		if (DEBUG) console.debug(`libWrapper hook '${id}' start`);
		const allowed = Hooks.call('fvtt-globe-map.pre' + (hookID ?? id), this, ...args);
		if (allowed === false) return;
		const result = await wrapped(...args);
		const config = { result };
		Hooks.call('fvtt-globe-map.' + (hookID ?? id), this, result, config, ...args);
		if (DEBUG) console.debug(`libWrapper hook '${id}' end`);
		return config.result;
	}, 'WRAPPER');
}

export function addHooks() {
	addHook('canvas.controls.handlePing', 'handlePing');
}

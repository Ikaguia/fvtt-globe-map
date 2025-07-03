import fs from 'fs';
import path from 'path';
import https from 'https';

const font = 'NotoSans-Medium';
const ranges = [
	'0-255', '256-511', '512-767', '768-1023',
	'1024-1279', '1280-1535', '1536-1791', '1792-2047'
];

const baseUrl = `https://map.pathfinderwiki.com/fonts/${font}/`;

function downloadGlyph(range) {
	const url = `${baseUrl}${range}.pbf`;
	const destPath = path.join('lib', 'pathfinder-wiki-maps', 'data', 'fonts', font, `${range}.pbf`);

	return new Promise((resolve, reject) => {
		https.get(url, res => {
			if (res.statusCode !== 200) {
				reject(`Failed to get ${url}: ${res.statusCode}`);
				return;
			}

			const file = fs.createWriteStream(destPath);
			res.pipe(file);
			file.on('finish', () => {
				file.close();
				console.log(`Downloaded ${range}`);
				resolve();
			});
		}).on('error', reject);
	});
}

(async () => {
	if (!fs.existsSync(path.join('fonts', font))) {
		fs.mkdirSync(path.join('fonts', font), { recursive: true });
	}

	for (const range of ranges) {
		try {
			await downloadGlyph(range);
		} catch (err) {
			console.error(err);
		}
	}

	console.log('✅ Download complete.');
})();

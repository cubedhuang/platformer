import savedWorld from '../worlds/fun.json';
import { Tile } from './Tile';

type CompressedTile = {
	tile: Tile;
	x: number;
	y: number;
	width: number;
	height: number;
};

type SavedLayer = CompressedTile[];

type SavedWorld = {
	player: { x: number; y: number };
	layers: {
		foreground: SavedLayer;
		midground: SavedLayer;
		background: SavedLayer;
	};
};

class ChunkedStorage {
	private chunks: Map<string, Uint8Array> = new Map();
	private chunkSize: number = 32;

	set(x: number, y: number, tile: Tile): void {
		const chunkKey = this.getChunkKey(x, y);

		let chunk = this.chunks.get(chunkKey);

		if (!chunk) {
			chunk = new Uint8Array(this.chunkSize * this.chunkSize);
			this.chunks.set(chunkKey, chunk);
		}

		const localX = x % this.chunkSize;
		const localY = y % this.chunkSize;

		chunk[localY * this.chunkSize + localX] = tile;
	}

	get(x: number, y: number): Tile {
		const chunkKey = this.getChunkKey(x, y);
		const chunk = this.chunks.get(chunkKey);

		if (!chunk) return Tile.Empty;

		const localX = x % this.chunkSize;
		const localY = y % this.chunkSize;

		return chunk[localY * this.chunkSize + localX] as Tile;
	}

	private getChunkKey(x: number, y: number): string {
		const chunkX = Math.floor(x / this.chunkSize);
		const chunkY = Math.floor(y / this.chunkSize);

		return `${chunkX},${chunkY}`;
	}

	*entries(): IterableIterator<[number, number, Tile]> {
		for (const [chunkKey, chunk] of this.chunks.entries()) {
			const [chunkX, chunkY] = chunkKey.split(',').map(Number);

			for (let y = 0; y < this.chunkSize; y++) {
				for (let x = 0; x < this.chunkSize; x++) {
					const tile = chunk[y * this.chunkSize + x] as Tile;

					if (tile !== Tile.Empty) {
						const worldX = chunkX * this.chunkSize + x;
						const worldY = chunkY * this.chunkSize + y;
						yield [worldX, worldY, tile];
					}
				}
			}
		}
	}
}

export class Layer {
	private storage: ChunkedStorage = new ChunkedStorage();

	constructor(savedLayer: SavedLayer) {
		for (const { tile, x, y, width, height } of savedLayer) {
			for (let dy = 0; dy < height; dy++) {
				for (let dx = 0; dx < width; dx++) {
					this.set(x + dx, y + dy, tile);
				}
			}
		}
	}

	at(x: number, y: number): Tile {
		return this.storage.get(x, y);
	}

	set(x: number, y: number, tile: Tile): void {
		this.storage.set(x, y, tile);
	}

	save(): SavedLayer {
		const compressed: SavedLayer = [];
		const visited = new Set<string>();

		for (const [x, y, tile] of this.storage.entries()) {
			if (visited.has(`${x},${y}`)) continue;

			let width = 1;
			let height = 1;

			// Expand width
			while (this.storage.get(x + width, y) === tile) {
				width++;
			}

			// Expand height
			let canExpandHeight = true;
			while (canExpandHeight) {
				for (let dx = 0; dx < width; dx++) {
					if (this.storage.get(x + dx, y + height) !== tile) {
						canExpandHeight = false;
						break;
					}
				}

				if (canExpandHeight) height++;
			}

			// Mark all tiles in this area as visited
			for (let dy = 0; dy < height; dy++) {
				for (let dx = 0; dx < width; dx++) {
					visited.add(`${x + dx},${y + dy}`);
				}
			}

			compressed.push({ tile, x, y, width, height });
		}

		return compressed;
	}
}

export class World {
	readonly playerStart: { x: number; y: number };
	readonly foreground: Layer;
	readonly midground: Layer;
	readonly background: Layer;

	constructor() {
		this.playerStart = savedWorld.player;
		this.foreground = new Layer(savedWorld.layers.foreground);
		this.midground = new Layer(savedWorld.layers.midground);
		this.background = new Layer(savedWorld.layers.background);
	}

	getPlayer() {
		return this.playerStart;
	}

	save(): SavedWorld {
		return {
			player: this.playerStart,
			layers: {
				foreground: this.foreground.save(),
				midground: this.midground.save(),
				background: this.background.save()
			}
		};
	}
}

import savedWorld from '../worlds/fun.json';
import { Tile } from './Tile';

type CompressedTile = {
	tile: Tile;
	x: number;
	y: number;
	width: number;
	height: number;
};

type Layer = CompressedTile[];

type SavedWorld = {
	player: { x: number; y: number };
	layers: { foreground: Layer };
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

export class World {
	readonly playerStart: { x: number; y: number };
	private tiles: ChunkedStorage = new ChunkedStorage();

	constructor() {
		this.playerStart = savedWorld.player;

		for (const { tile, x, y, width, height } of savedWorld.layers
			.foreground) {
			for (let dy = 0; dy < height; dy++) {
				for (let dx = 0; dx < width; dx++) {
					this.set(x + dx, y + dy, tile);
				}
			}
		}
	}

	getPlayer() {
		return this.playerStart;
	}

	at(wx: number, wy: number): Tile {
		return this.tiles.get(wx, wy);
	}

	set(wx: number, wy: number, tile: Tile): void {
		this.tiles.set(wx, wy, tile);
	}

	save(): SavedWorld {
		const compressedForeground = this.compressLayer();

		return {
			player: this.playerStart,
			layers: {
				foreground: compressedForeground
			}
		};
	}

	private compressLayer(): Layer {
		const compressed: Layer = [];
		const visited = new Set<string>();

		for (const [x, y, tile] of this.tiles.entries()) {
			if (visited.has(`${x},${y}`)) continue;

			let width = 1;
			let height = 1;

			// Expand width
			while (this.tiles.get(x + width, y) === tile) {
				width++;
			}

			// Expand height
			let canExpandHeight = true;
			while (canExpandHeight) {
				for (let dx = 0; dx < width; dx++) {
					if (this.tiles.get(x + dx, y + height) !== tile) {
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

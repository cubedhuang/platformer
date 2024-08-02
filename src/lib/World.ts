import world from '../worlds/world.world?raw';
import { Tile } from './Tile';

export class World {
	private tiles: Map<string, Tile> = new Map();

	constructor() {
		const rows = world.split('\n');

		for (const row of rows) {
			const [wx, wy, tile] = row.split(',');
			this.set(Number(wx), Number(wy), tile as Tile);
		}
	}

	at(wx: number, wy: number) {
		return this.tiles.get(`${wx},${wy}`) || Tile.Empty;
	}

	set(wx: number, wy: number, tile: Tile) {
		this.tiles.set(`${wx},${wy}`, tile);
	}

	toString() {
		return Array.from(this.tiles.entries())
			.filter(([, tile]) => tile !== Tile.Empty)
			.sort((a, b) => {
				const [x1, y1] = a[0].split(',').map(Number);
				const [x2, y2] = b[0].split(',').map(Number);

				if (x1 === x2) return y1 - y2;
				return x1 - x2;
			})
			.map(([key, value]) => `${key},${value}`)
			.join('\n');
	}

	entries(): IterableIterator<[[number, number], Tile]> {
		const entries = this.tiles.entries();

		return {
			next() {
				const entry = entries.next();
				if (entry.done) return { done: true, value: undefined };

				const [key, value] = entry.value;
				const [wx, wy] = key.split(',').map(Number);

				return { done: false, value: [[wx, wy], value] };
			},
			[Symbol.iterator]() {
				return this;
			}
		};
	}

	*[Symbol.iterator]() {
		for (const [[wx, wy], tile] of this.entries()) {
			yield [[wx, wy], tile] as [[number, number], Tile];
		}
	}
}

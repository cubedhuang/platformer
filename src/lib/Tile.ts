export enum Tile {
	Empty = 0,
	Earth = 1,
	Lava = 2
}

export const COLLIDES = [Tile.Earth];
export const DEATH = [Tile.Lava];

export enum Tile {
	Empty = 0,
	Earth = 1,
	Lava = 2,
	Rock = 3
}

export const COLLIDES = [Tile.Earth, Tile.Rock];
export const DEATH = [Tile.Lava];

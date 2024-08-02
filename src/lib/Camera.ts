export class Camera {
	private readonly SPEED = 10;

	private target: { x: number; y: number };
	private current: { x: number; y: number };

	constructor(
		x: number,
		y: number,
		private width: number,
		private height: number
	) {
		this.current = { x, y };
		this.target = { x, y };
	}

	follow(target: { x: number; y: number }) {
		this.target = target;
	}

	shift(dx: number, dy: number) {
		this.target.x += dx;
		this.target.y += dy;
	}

	update(dt: number) {
		// https://lisyarus.github.io/blog/posts/exponential-smoothing.html

		this.current.x += (this.target.x - this.current.x) * (1 - Math.exp(-this.SPEED * dt));
		this.current.y += (this.target.y - this.current.y) * (1 - Math.exp(-this.SPEED * dt));
	}

	contains(x: number, y: number, width = 0, height = width) {
		return (
			x >= this.current.x - width &&
			x <= this.current.x + this.width &&
			y >= this.current.y - height &&
			y <= this.current.y + this.height
		);
	}

	get x() {
		return this.current.x;
	}

	get y() {
		return this.current.y;
	}
}

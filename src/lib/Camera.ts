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

	follow(center: { x: number; y: number }) {
		const dx = center.x - (this.target.x + this.width / 2);
		const dy = center.y - (this.target.y + this.height / 2);

		const MAX_D_LEFT = this.width / 6;
		const MAX_D_RIGHT = 0;
		const MAX_D_UP = -this.height / 6;
		const MAX_D_DOWN = this.height / 3;

		if (dx < -MAX_D_LEFT) {
			this.target.x += dx + MAX_D_LEFT;
			this.target.x = Math.max(this.target.x, 0);
		} else if (dx > MAX_D_RIGHT) {
			this.target.x += dx - MAX_D_RIGHT;
		}

		if (dy < -MAX_D_UP) {
			this.target.y += dy + MAX_D_UP;
		} else if (dy > MAX_D_DOWN) {
			this.target.y += dy - MAX_D_DOWN;
			this.target.y = Math.min(this.target.y, 0);
		}
	}

	shift(dx: number, dy: number) {
		this.target.x += dx;
		this.target.y += dy;
	}

	update(dt: number) {
		// https://lisyarus.github.io/blog/posts/exponential-smoothing.html

		this.current.x +=
			(this.target.x - this.current.x) * (1 - Math.exp(-this.SPEED * dt));
		this.current.y +=
			(this.target.y - this.current.y) * (1 - Math.exp(-this.SPEED * dt));
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

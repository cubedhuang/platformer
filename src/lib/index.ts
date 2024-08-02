export function debounce<F extends (...args: unknown[]) => unknown>(
	callback: F,
	wait: number
) {
	let timeoutId: number | null = null;
	return (...args: Parameters<F>) => {
		if (timeoutId !== null) clearTimeout(timeoutId);
		timeoutId = setTimeout(() => {
			callback(...args);
		}, wait);
	};
}

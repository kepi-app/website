class Deferred<T, TErr = unknown> {
	public readonly promise: Promise<T>
	public settled = false

	private _resolve!: (value: T | PromiseLike<T>) => void
	private _reject!: (reason: unknown) => void

	constructor() {
		this.promise = new Promise<T>((resolve, reject) => {
			this._resolve = resolve
			this._reject = reject
		})
	}

	public resolve(value: T | PromiseLike<T>) {
		this._resolve(value)
		this.settled = true
	}

	public reject(reason: TErr) {
		this._reject(reason)
		this.settled = true
	}
}

export { Deferred }

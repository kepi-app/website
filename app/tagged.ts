declare const tag: unique symbol

type Tagged<T, Tag extends PropertyKey, Meta = void> = T & {
	[tag]: { [K in Tag]: Meta }
}

export type { Tagged }

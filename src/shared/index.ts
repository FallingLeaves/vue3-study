export const extend = Object.assign;

export function isObject(val: unknown): val is Object {
	return val !== null && typeof val === "object";
}

export function hasChanged(val, newVal) {
	return !Object.is(val, newVal);
}

export function hasOwn(target, key) {
	return Reflect.has(target, key);
}

export const EMPTY_OBJ = {};

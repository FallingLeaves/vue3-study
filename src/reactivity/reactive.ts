import {
	mutableHandlers,
	readonlyHandlers,
	shallowReadonlyHandlers,
	shallowMutableHandlers,
} from "./baseHandlers";

export const enum ReactiveFlags {
	IS_REACTIVE = "__v_isReactive",
	IS_READONLY = "__v_isReadonly",
	RAW = "__v_raw",
}

export function isReactive(raw) {
	return !!raw[ReactiveFlags.IS_REACTIVE];
}

export function isReadonly(raw) {
	return !!raw[ReactiveFlags.IS_READONLY];
}

function createActiveObject(raw, baseHandlers) {
	return new Proxy(raw, baseHandlers);
}

export function reactive(raw) {
	return createActiveObject(raw, mutableHandlers);
}

export function readonly(raw) {
	return createActiveObject(raw, readonlyHandlers);
}

export function shallowReadonly(raw) {
	return createActiveObject(raw, shallowReadonlyHandlers);
}

export function isProxy(wrapped) {
	return isReactive(wrapped) || isReadonly(wrapped);
}

export function shallowReactive(raw) {
	return createActiveObject(raw, shallowMutableHandlers);
}

export function toRaw(observed) {
	const original = observed && observed[ReactiveFlags.RAW];
	return isProxy(original) ? toRaw(original) : original;
}

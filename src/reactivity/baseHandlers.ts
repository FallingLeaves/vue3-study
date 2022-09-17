import { extend } from "./../shared/index";
import { track, trigger } from "./effect";
import { reactive, ReactiveFlags, readonly } from "./reactive";
import { isObject } from "../shared";

const get = createGetter();
const readonlyGet = createGetter(true);
const set = createSetter();

const shallowReadonlyGet = createGetter(true, true);

const shallowMutableGet = createGetter(false, true);

function createGetter(isReadonly = false, shallow = false) {
	return function get(target, key, receiver) {
		if (key === ReactiveFlags.IS_REACTIVE) {
			return !isReadonly;
		} else if (key === ReactiveFlags.IS_READONLY) {
			return isReadonly;
		} else if (key === ReactiveFlags.RAW) {
			return target;
		}

		const res = Reflect.get(target, key, receiver);

		if (shallow) {
			return res;
		}

		// 嵌套处理
		if (isObject(res)) {
			return isReadonly ? readonly(res) : reactive(res);
		}

		if (!isReadonly) {
			track(target, key);
		}
		return res;
	};
}

function createSetter() {
	return function set(target, key, value, receiver) {
		const res = Reflect.set(target, key, value, receiver);
		trigger(target, key);
		return res;
	};
}

export const mutableHandlers = {
	get,
	set,
};

export const readonlyHandlers = {
	get: readonlyGet,
	set(target, key, value) {
		console.warn(
			`key: ${key} set value: ${value} fail, because the target is readonly`,
			target
		);
		return true;
	},
};

export const shallowReadonlyHandlers = extend({}, readonlyHandlers, {
	get: shallowReadonlyGet,
});

export const shallowMutableHandlers = extend({}, mutableHandlers, {
	get: shallowMutableGet,
});

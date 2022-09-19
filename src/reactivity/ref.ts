import { hasChanged, isObject } from "../shared";
import { trackEffect, triggerEffect } from "./effect";
import { reactive } from "./reactive";

const enum RefFlags {
	IS_REF = "__v_isRef",
}

class RefImpl {
	private _value: any;
	// 存储依赖
	public deps = new Set();

	constructor(value) {
		// 判断是否是对象
		this._value = isObject(value) ? reactive(value) : value;
		this[RefFlags.IS_REF] = true;
	}

	get value() {
		trackEffect(this.deps);
		return this._value;
	}

	set value(newValue) {
		if (hasChanged(this._value, newValue)) {
			this._value = newValue;
			triggerEffect(this.deps);
		}
	}
}

export function ref(value) {
	return new RefImpl(value);
}

export function isRef(ref) {
	return !!ref[RefFlags.IS_REF];
}

export function unRef(ref) {
	return ref[RefFlags.IS_REF] ? ref.value : ref;
}

export function proxyRefs(objectWithRefs) {
	if (!isObject(objectWithRefs)) return;
	return new Proxy(objectWithRefs, {
		get(target, key, receiver) {
			return unRef(Reflect.get(target, key, receiver));
		},
		set(target, key, value, receiver) {
			// 原有的值是 ref 新值不是 ref 更新原来的 ref.value = newValue
			// 原有的值是 ref 新值也是 直接替换
			if (isRef(target[key]) && !isRef(value)) {
				return (target[key].value = value);
			} else {
				return Reflect.set(target, key, value, receiver);
			}
		},
	});
}

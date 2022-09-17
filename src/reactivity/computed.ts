import { ReactiveEffect } from "./effect";

class ComputedRefImpl {
	private _getter: any;
	// 缓存值
	private _value: any;
	// 是否需要更新
	private _dirty = true;
	private _effect: any;

	constructor(getter) {
		this._getter = getter;
		// 维护 ReactiveEffect 实例
		this._effect = new ReactiveEffect(getter, {
			scheduler: () => {
				this._dirty = true;
			},
		});
	}

	get value() {
		if (this._dirty) {
			this._value = this._effect.run();
			this._dirty = false;
		}
		return this._value;
	}
}

export function computed(getter) {
	return new ComputedRefImpl(getter);
}

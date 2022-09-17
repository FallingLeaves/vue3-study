import { extend } from "../shared";
let activeEffect;

export class ReactiveEffect {
	// 反向记录对应 dep
	deps = [];

	active = true;

	private _fn: any;

	constructor(fn, public options) {
		this._fn = fn;
	}

	run() {
		// 保存当前的 this
		activeEffect = this;
		const res = this._fn();
		return res;
	}

	// 根据 this.deps 删除 this 对应的effect
	stop() {
		cleanupEffect(this);
	}
}

export function effect(fn, options: any = {}) {
	const _effect = new ReactiveEffect(fn, options);
	extend(_effect, options);
	_effect.run();

	const runner: any = _effect.run.bind(_effect);
	runner.effect = _effect;

	return runner;

	// this 指向
	// return _effect.run.bind(_effect);
}

//
const targetMap = new WeakMap();

export function track(target, key) {
	// 可能创建多个 target，每个 target 可能有多个 key，每个 key 关联多个 effectFn
	let depsMap = targetMap.get(target);
	if (!depsMap) {
		depsMap = new Map();
		targetMap.set(target, depsMap);
	}
	let dep = depsMap.get(key);
	if (!dep) {
		dep = new Set();
		depsMap.set(key, dep);
	}

	trackEffect(dep);
}

export function trackEffect(dep) {
	if (activeEffect && activeEffect.active) {
		// 反向追踪 activeEffect 的 dep
		activeEffect.deps.push(dep);

		// 将 effect 加人到 dep
		dep.add(activeEffect);
	}
}

export function trigger(target, key) {
	// 取出 deps 遍历执行 effect
	const depsMap = targetMap.get(target);
	const deps = depsMap.get(key);
	triggerEffect(deps);
}

export function triggerEffect(deps) {
	for (const effect of deps) {
		if (effect.options.scheduler) {
			effect.options.scheduler();
		} else {
			effect.run();
		}
	}
}

export function stop(runner) {
	runner.effect.stop();
}

function cleanupEffect(effect) {
	if (effect.active) {
		effect.deps.forEach((dep: any) => {
			dep.delete(effect);
		});
		if (effect.onStop) {
			effect.onStop();
		}
		effect.active = false;
	}
}

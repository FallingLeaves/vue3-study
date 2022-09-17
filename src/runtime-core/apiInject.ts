import { getCurrentInstance } from "./component";

export function provide(key, value) {
	const currentInstance = getCurrentInstance();
	if (currentInstance) {
		let provides = currentInstance.provides;
		if (currentInstance.parent) {
			const parentProvides = currentInstance.parent.provides;
			// 如果 provides 和 parent.provides 一样，就是初始化阶段
			if (provides === parentProvides) {
				// 此时将 provides 的原型链设置为 parent.provides
				// 这样我们在设置的时候就不会五绕道 parent.provides
				// 在读取的时候因为原型链的特性，我们也能读取到 parent.provides
				provides = currentInstance.provides = Object.create(parentProvides);
			}
		}
		provides[key] = value;
	}
}

export function inject(key, defaultValue) {
	const currentInstance = getCurrentInstance();
	if (currentInstance) {
		const { parent } = currentInstance;
		if (key in parent.provides) {
			return parent.provides[key];
		} else if (defaultValue) {
			if (typeof defaultValue === "function") {
				return defaultValue();
			}
			return defaultValue;
		}
	}
}

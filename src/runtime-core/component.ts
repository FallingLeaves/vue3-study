import { shallowReadonly } from "../reactivity/reactive";
import { hasOwn } from "../shared";
import { emit } from "./componentEmit";
import { initProps } from "./componentProps";
import { initSlots } from "./componentSlots";

let currentInstance;

export function getCurrentInstance() {
	return currentInstance;
}

export function setCurrentInstance(instance) {
	currentInstance = instance;
}

export function createComponentInstance(vnode) {
	// 返回 component 数据结构
	const component = {
		vnode,
		type: vnode.type,
		setupState: {},
		props: {},
		emit: () => {},
		slots: {},
	};
	// 传参
	component.emit = emit.bind(null, component) as any;
	return component;
}

export function setupComponent(instance, container) {
	// initProps
	initProps(instance, instance.vnode.props);
	// initSlots
	initSlots(instance, instance.vnode.children);
	// 处理 setup 返回值
	setupStatefulComponent(instance, container);
}

function setupStatefulComponent(instance, container) {
	// 获取 setup 返回值
	//

	const component = instance.vnode.type;

	instance.proxy = new Proxy(
		{ _: instance },
		componentPublicInstanceProxyHandlers
	);

	const { setup } = component;
	if (setup) {
		setCurrentInstance(instance);
		// 返回函数 作为组件的render  反之 是 setupState 注入到上下文中
		const setupResult = setup(shallowReadonly(instance.props), {
			emit: instance.emit,
		});
		setCurrentInstance(null);
		handleSetupResult(instance, setupResult);
	}
}

export function handleSetupResult(instance, setupResult) {
	// 先处理 object
	if (typeof setupResult === "object") {
		instance.setupState = setupResult;
	}

	finishComponentSetup(instance);
}

function finishComponentSetup(instance) {
	const component = instance.type;

	if (!instance.render) {
		instance.render = component.render;
	}
}

const PublicProxyGetterMapping = {
	$el: (i) => i.vnode.el,
	$slots: (i) => i.slots,
	$props: (i) => i.props,
};

export const componentPublicInstanceProxyHandlers = {
	get({ _: instance }, key) {
		const { setupState, props } = instance;
		if (hasOwn(setupState, key)) {
			return Reflect.get(setupState, key);
		} else if (hasOwn(props, key)) {
			return Reflect.get(props, key);
		}

		const publicGetter = PublicProxyGetterMapping[key];
		if (publicGetter) {
			return publicGetter(instance);
		}
	},
};

import { shallowReadonly } from "../reactivity/reactive";
import { hasOwn } from "../shared";
import { emit } from "./componentEmit";
import { initProps } from "./componentProps";
import { initSlots } from "./componentSlots";
import { proxyRefs } from "../reactivity/ref";

let currentInstance;

export function getCurrentInstance() {
	return currentInstance;
}

export function setCurrentInstance(instance) {
	currentInstance = instance;
}

export function createComponentInstance(vnode, parent) {
	// 返回 component 数据结构
	const component = {
		vnode,
		type: vnode.type,
		setupState: {},
		props: {},
		emit: () => {},
		slots: {},
		// 初始化的 provides 指向父级的 provides
		provides: parent ? parent.provides : {},
		// 挂载parent
		parent,
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
		const setupResult = proxyRefs(
			setup(shallowReadonly(instance.props), {
				emit: instance.emit,
			})
		);
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

	// 有 compiler 没提供 render
	if (!component.render && compiler) {
		if (component.template) {
			// 将 template 编译成 render
			component.render = compiler(component.template);
		}
	}

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

let compiler;

export function registerCompiler(_compiler) {
	compiler = _compiler;
}

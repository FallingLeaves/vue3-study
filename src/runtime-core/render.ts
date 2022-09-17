import { isObject } from "../shared";
import { ShapeFlags } from "../shared/ShapeFlag";
import { createComponentInstance, setupComponent } from "./component";
import { Fragment, TextNode } from "./vnode";

export function render(vnode, container) {
	// 递归处理子节点
	patch(vnode, container);
}

export function patch(vnode, container) {
	const { shapeFlags, type } = vnode;
	switch (type) {
		case Fragment:
			processFragment(vnode, container);
			break;
		case TextNode:
			processTextNode(vnode, container);
			break;

		default:
			if (shapeFlags & ShapeFlags.ELEMENT) {
				processElement(vnode, container);
			} else if (shapeFlags & ShapeFlags.STATEFUL_COMPONENT) {
				processComponent(vnode, container);
			}
			break;
	}
}

function processFragment(vnode, container) {
	// 因为 fragment 就是用来处理 children 的
	mountChildren(vnode, container);
}

function processTextNode(vnode, container) {
	const element = (vnode.el = document.createTextNode(vnode.children));
	container.appendChild(element);
}

export function processComponent(vnode, container) {
	mountComponent(vnode, container);
}

function processElement(vnode, container) {
	// 分为 init 和 update 两种，这里先写 init
	mountElement(vnode, container);
}

// vnode -> domEl
function mountElement(vnode, container) {
	const { type: domElType, props, children, shapeFlags } = vnode;
	const domEl = (vnode.el = document.createElement(domElType) as HTMLElement);

	// 处理事件 onClick
	const isOn = (key: string) => /^on[A-Z]/.test(key);
	for (const prop in props) {
		if (isOn(prop)) {
			const event = prop.slice(2).toLowerCase();
			domEl.addEventListener(event, props[prop]);
		} else {
			domEl.setAttribute(prop, props[prop]);
		}
	}

	if (shapeFlags & ShapeFlags.TEXT_CHILDREN) {
		domEl.textContent = children;
	} else if (shapeFlags & ShapeFlags.ARRAY_CHILDREN) {
		mountChildren(vnode, domEl);
	}
	container.appendChild(domEl);
}

function mountChildren(vnode, container) {
	vnode.children.forEach((child) => {
		// 如果 children 是一个 array，就递归 patch
		patch(child, container);
	});
}

export function mountComponent(vnode, container) {
	// 通过 vnode 获取组件实例
	const instance = createComponentInstance(vnode);

	setupComponent(instance, container);
	setupRenderEffect(instance, vnode, container);
}

function setupRenderEffect(instance, vnode, container) {
	const { setupState, proxy } = instance;
	const subTree = instance.render.call(proxy, proxy);
	patch(subTree, container);
	vnode.el = subTree.el;
}

import { isObject } from "../shared";
import { ShapeFlags } from "../shared/ShapeFlag";
import { createComponentInstance, setupComponent } from "./component";
import { Fragment, TextNode } from "./vnode";
import { createElement, patchProp, insert } from "../runtime-dom";
import { createAppAPI } from "./createApp";

export function createRenderer(options) {
	const { createElement, insert, patchProp, selector } = options;

	function render(vnode, container, parent?) {
		// 递归处理子节点
		patch(vnode, container, parent);
	}

	function patch(vnode, container, parent) {
		const { shapeFlags, type } = vnode;
		switch (type) {
			case Fragment:
				processFragment(vnode, container, parent);
				break;
			case TextNode:
				processTextNode(vnode, container);
				break;

			default:
				if (shapeFlags & ShapeFlags.ELEMENT) {
					processElement(vnode, container, parent);
				} else if (shapeFlags & ShapeFlags.STATEFUL_COMPONENT) {
					processComponent(vnode, container, parent);
				}
				break;
		}
	}

	function processFragment(vnode, container, parent) {
		// 因为 fragment 就是用来处理 children 的
		mountChildren(vnode, container, parent);
	}

	function processTextNode(vnode, container) {
		const element = (vnode.el = document.createTextNode(vnode.children));
		container.appendChild(element);
	}

	function processComponent(vnode, container, parent) {
		mountComponent(vnode, container, parent);
	}

	function processElement(vnode, container, parent) {
		// 分为 init 和 update 两种，这里先写 init
		mountElement(vnode, container, parent);
	}

	// vnode -> domEl
	function mountElement(vnode, container, parent) {
		const { type: domElType, props, children, shapeFlags } = vnode;
		const domEl = (vnode.el = createElement(domElType));

		for (const prop in props) {
			patchProp(domEl, prop, props);
		}

		if (shapeFlags & ShapeFlags.TEXT_CHILDREN) {
			domEl.textContent = children;
		} else if (shapeFlags & ShapeFlags.ARRAY_CHILDREN) {
			mountChildren(vnode, domEl, parent);
		}

		insert(domEl, container);
	}

	function mountChildren(vnode, container, parent) {
		vnode.children.forEach((child) => {
			// 如果 children 是一个 array，就递归 patch
			patch(child, container, parent);
		});
	}

	function mountComponent(vnode, container, parent) {
		// 通过 vnode 获取组件实例
		const instance = createComponentInstance(vnode, parent);

		setupComponent(instance, container);
		setupRenderEffect(instance, vnode, container);
	}

	function setupRenderEffect(instance, vnode, container) {
		const { setupState, proxy } = instance;
		const subTree = instance.render.call(proxy, proxy);
		patch(subTree, container, instance);
		vnode.el = subTree.el;
	}

	return {
		createApp: createAppAPI(render, selector),
	};
}

import { isObject } from "../shared";
import { ShapeFlags } from "../shared/ShapeFlag";
import { createComponentInstance, setupComponent } from "./component";
import { Fragment, TextNode } from "./vnode";
import { createElement, patchProp, insert, effect } from "../runtime-dom";
import { createAppAPI } from "./createApp";

export function createRenderer(options) {
	const { createElement, insert, patchProp, selector } = options;

	function render(vnode, container, parent?) {
		// 递归处理子节点
		patch(null, vnode, container, parent);
	}

	function patch(n1, n2, container, parent) {
		const { shapeFlags, type } = n2;
		switch (type) {
			case Fragment:
				processFragment(n2, container, parent);
				break;
			case TextNode:
				processTextNode(n2, container);
				break;

			default:
				if (shapeFlags & ShapeFlags.ELEMENT) {
					processElement(n1, n2, container, parent);
				} else if (shapeFlags & ShapeFlags.STATEFUL_COMPONENT) {
					processComponent(n1, n2, container, parent);
				}
				break;
		}
	}

	function processFragment(n2, container, parent) {
		// 因为 fragment 就是用来处理 children 的
		mountChildren(n2, container, parent);
	}

	function processTextNode(vnode, container) {
		const element = (vnode.el = document.createTextNode(vnode.children));
		container.appendChild(element);
	}

	function processComponent(n1, n2, container, parent) {
		mountComponent(n2, container, parent);
	}

	function processElement(n1, n2, container, parent) {
		// 分为 init 和 update 两种，这里先写 init
		if (n1) {
			// update 逻辑
			patchElement(n1, n2, container);
		} else {
			// init 逻辑
			mountElement(n1, n2, container, parent);
		}
	}

	function patchElement(n1, n2, container) {
		console.log("更新");
	}

	// vnode -> domEl
	function mountElement(n1, n2, container, parent) {
		const { type: domElType, props, children, shapeFlags } = n2;
		const domEl = (n2.el = createElement(domElType));

		for (const prop in props) {
			patchProp(domEl, prop, props);
		}

		if (shapeFlags & ShapeFlags.TEXT_CHILDREN) {
			domEl.textContent = children;
		} else if (shapeFlags & ShapeFlags.ARRAY_CHILDREN) {
			mountChildren(n2, domEl, parent);
		}

		insert(domEl, container);
	}

	function mountChildren(n2, container, parent) {
		n2.children.forEach((child) => {
			// 如果 children 是一个 array，就递归 patch
			patch(null, child, container, parent);
		});
	}

	function mountComponent(n2, container, parent) {
		// 通过 vnode 获取组件实例
		const instance = createComponentInstance(n2, parent);

		setupComponent(instance, container);
		setupRenderEffect(instance, n2, container);
	}

	function setupRenderEffect(instance, vnode, container) {
		const { setupState, proxy } = instance;
		effect(() => {
			// 根据 instance.isMounted 状态判断
			if (instance.isMounted) {
				// update
				const subTree = instance.render.call(proxy, proxy);
				vnode.el = subTree.el;
				// 获取上一个 subTree
				const preSubTree = instance.subTree;
				instance.subTree = subTree;
				console.log({ subTree, preSubTree });
				patch(preSubTree, subTree, container, instance);
			} else {
				// init 逻辑
				const subTree = (instance.subTree = instance.render.call(proxy, proxy));
				patch(null, subTree, container, instance);
				vnode.el = subTree.el;
				instance.isMounted = true;
			}
		});
	}

	return {
		createApp: createAppAPI(render, selector),
	};
}

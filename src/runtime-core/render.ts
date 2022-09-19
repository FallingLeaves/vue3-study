import { isObject, EMPTY_OBJ } from "../shared";
import { ShapeFlags } from "../shared/ShapeFlag";
import { createComponentInstance, setupComponent } from "./component";
import { Fragment, TextNode } from "./vnode";
import { createElement, patchProp, insert, effect } from "../runtime-dom";
import { createAppAPI } from "./createApp";

export function createRenderer(options) {
	const { createElement, insert, patchProp, selector, setElementText, remove } =
		options;

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
		mountChildren(n2.children, container, parent);
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
			patchElement(n1, n2, container, parent);
		} else {
			// init 逻辑
			mountElement(n2, container, parent);
		}
	}

	function patchElement(n1, n2, container, parent) {
		console.log("更新");
		const oldProps = n1.props || EMPTY_OBJ;
		const newProps = n2.props || EMPTY_OBJ;
		const el = (n2.el = n1.el);
		patchProps(el, oldProps, newProps);
		patchChildren(n1, n2, container, parent);
	}

	function patchProps(el, oldProps, newProps) {
		// old !== new 更新
		// old 存在，new !== undefined 删除
		// old 存在，new 不存在 删除
		if (oldProps === newProps) {
			return;
		}
		// old !== new
		for (const propKey of Reflect.ownKeys(newProps)) {
			const oldProp = oldProps[propKey];
			const newProp = newProps[propKey];
			// 新旧属性对比
			if (oldProp !== newProp) {
				patchProp(el, propKey, newProp, oldProp);
			}
		}
		if (oldProps !== EMPTY_OBJ) {
			// old 存在 new 不存在
			for (const propKey of Reflect.ownKeys(oldProps)) {
				if (!(propKey in oldProps)) {
					patchProp(el, propKey, undefined, oldProps[propKey]);
				}
			}
		}
	}

	function patchChildren(n1, n2, container, parent) {
		const prevShapeFlag = n1.shapeFlags;
		const shapeFlag = n2.shapeFlags;
		const c1 = n1.children;
		const c2 = n2.children;
		// 文本
		if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
			if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
				// 清空原有 children
				unmountChildren(n1.children);
			}
			if (c1 !== c2) {
				setElementText(n2.el, c2);
			}
		} else {
			// 数组
			if (prevShapeFlag & ShapeFlags.TEXT_CHILDREN) {
				setElementText(n1.el, "");
				mountChildren(c2, container, parent);
			}
		}
	}

	function unmountChildren(children) {
		for (let index = 0; index < children.length; index++) {
			const child = children[index];
			remove(child.el);
		}
	}

	// vnode -> domEl
	function mountElement(n2, container, parent) {
		const { type: domElType, props, children, shapeFlags } = n2;
		const domEl = (n2.el = createElement(domElType));

		for (const prop in props) {
			patchProp(domEl, prop, props[prop]);
		}

		if (shapeFlags & ShapeFlags.TEXT_CHILDREN) {
			domEl.textContent = children;
		} else if (shapeFlags & ShapeFlags.ARRAY_CHILDREN) {
			mountChildren(n2.children, domEl, parent);
		}

		insert(domEl, container);
	}

	function mountChildren(children, container, parent) {
		children.forEach((child) => {
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

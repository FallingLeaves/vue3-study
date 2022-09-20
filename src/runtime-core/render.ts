import { isObject, EMPTY_OBJ } from "../shared";
import { ShapeFlags } from "../shared/ShapeFlag";
import { createComponentInstance, setupComponent } from "./component";
import { Fragment, TextNode } from "./vnode";
import { effect } from "../reactivity";
import { createAppAPI } from "./createApp";

export function createRenderer(options) {
	const { createElement, insert, patchProp, selector, setElementText, remove } =
		options;

	function render(vnode, container, parent?) {
		// 递归处理子节点
		patch(null, vnode, container, parent, null);
	}

	function patch(n1, n2, container, parent, anchor) {
		const { shapeFlags, type } = n2;
		switch (type) {
			case Fragment:
				processFragment(n2, container, parent, anchor);
				break;
			case TextNode:
				processTextNode(n2, container);
				break;

			default:
				if (shapeFlags & ShapeFlags.ELEMENT) {
					processElement(n1, n2, container, parent, anchor);
				} else if (shapeFlags & ShapeFlags.STATEFUL_COMPONENT) {
					processComponent(n1, n2, container, parent, anchor);
				}
				break;
		}
	}

	function processFragment(n2, container, parent, anchor) {
		// 因为 fragment 就是用来处理 children 的
		mountChildren(n2.children, container, parent, anchor);
	}

	function processTextNode(vnode, container) {
		const element = (vnode.el = document.createTextNode(vnode.children));
		container.appendChild(element);
	}

	function processComponent(n1, n2, container, parent, anchor) {
		mountComponent(n2, container, parent, anchor);
	}

	function processElement(n1, n2, container, parent, anchor) {
		// 分为 init 和 update 两种，这里先写 init
		if (n1) {
			// update 逻辑
			patchElement(n1, n2, parent, anchor);
		} else {
			// init 逻辑
			mountElement(n2, container, parent, anchor);
		}
	}

	function patchElement(n1, n2, parent, anchor) {
		console.log("更新");
		const oldProps = n1.props || EMPTY_OBJ;
		const newProps = n2.props || EMPTY_OBJ;
		// 这里需要传递 el，我们需要考虑一点，到这一层的时候
		// n2.el 是 undefined，所以我们需要把 n1.el 赋给 n2.el
		// 这是因为在下次 patch 的时候 n2 === n1, 此刻的新节点变成旧节点，el 就生效了
		const el = (n2.el = n1.el);
		patchProps(el, oldProps, newProps);
		patchChildren(n1, n2, el, parent, anchor);
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

	function patchChildren(n1, n2, container, parent, anchor) {
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
				mountChildren(c2, container, parent, anchor);
			} else {
				// 对比 array => array
				patchKeyChildren(c1, c2, container, parent, anchor);
			}
		}
	}

	function unmountChildren(children) {
		for (let index = 0; index < children.length; index++) {
			const child = children[index];
			remove(child.el);
		}
	}

	function patchKeyChildren(c1, c2, container, parent, anchor) {
		let l2 = c2.length;
		// 声明3个指针，e1 老节点最后一个 e2 新节点最后一个 i 当前对比元素
		let e1 = c1.length - 1;
		let e2 = l2 - 1;
		let i = 0;
		// 暂时通过 type 和 key 判断
		function isSameVNode(n1, n2) {
			return n1.type === n2.type && n1.key === n2.key;
		}
		// 新旧节点头部开始
		while (i <= e1 && i <= e2) {
			if (isSameVNode(c1[i], c2[i])) {
				patch(c1[i], c2[i], container, parent, anchor);
			} else {
				break;
			}
			i += 1;
		}

		// 比较尾部
		while (i <= e1 && i <= e2) {
			// 如果当前对比 vnode 相同 进入 patch
			if (isSameVNode(c1[e1], c2[e2])) {
				patch(c1[e1], c2[e2], container, parent, anchor);
			} else {
				break;
			}
			e1 -= 1;
			e2 -= 1;
		}

		// 新节点比旧节点长，添加新节点 - 尾部
		if (i > e1) {
			if (i <= e2) {
				const nextPos = e2 + 1;
				const anchor = nextPos < l2 ? c2[nextPos].el : null;
				while (i <= e2) {
					patch(null, c2[i], container, parent, anchor);
					i += 1;
				}
			}
		} else if (i > e2) {
			// 新节点比旧节点短 删除
			while (i <= e1) {
				remove(c1[i].el);
				i += 1;
			}
		}
	}

	// vnode -> domEl
	function mountElement(n2, container, parent, anchor) {
		const { type: domElType, props, children, shapeFlags } = n2;
		const domEl = (n2.el = createElement(domElType));

		for (const prop in props) {
			patchProp(domEl, prop, props[prop]);
		}

		if (shapeFlags & ShapeFlags.TEXT_CHILDREN) {
			domEl.textContent = children;
		} else if (shapeFlags & ShapeFlags.ARRAY_CHILDREN) {
			mountChildren(n2.children, domEl, parent, anchor);
		}

		insert(domEl, container, anchor);
	}

	function mountChildren(children, container, parent, anchor) {
		children.forEach((child) => {
			// 如果 children 是一个 array，就递归 patch
			patch(null, child, container, parent, anchor);
		});
	}

	function mountComponent(n2, container, parent, anchor) {
		// 通过 vnode 获取组件实例
		const instance = createComponentInstance(n2, parent);

		setupComponent(instance, container);
		setupRenderEffect(instance, n2, container, anchor);
	}

	function setupRenderEffect(instance, vnode, container, anchor) {
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
				patch(preSubTree, subTree, container, instance, anchor);
			} else {
				// init 逻辑
				const subTree = (instance.subTree = instance.render.call(proxy, proxy));
				patch(null, subTree, container, instance, anchor);
				vnode.el = subTree.el;
				instance.isMounted = true;
			}
		});
	}

	return {
		createApp: createAppAPI(render, selector),
	};
}

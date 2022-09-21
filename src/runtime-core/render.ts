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

		console.log(i, e1, e2);

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
		} else {
			// 中间对比
			let s1 = i;
			let s2 = i;

			// 记录需要 patch 的节点，当前新节点的混乱部分个数
			const toBePatched = e2 - s2 + 1;
			// 当前 patch 的个数
			let patched = 0;

			// 混乱部分映射
			const keyToNewIndexMap = new Map();
			// 混乱元素的索引
			const newIndexToOldIndexMap = new Array(toBePatched);
			// 应该移动
			let shouldMove = false;
			// 目前最大索引
			let maxNewIndexSoFar = 0;
			for (let i = 0; i < toBePatched; i++) {
				newIndexToOldIndexMap[i] = 0;
			}
			// 添加映射
			for (let i = s2; i <= e2; i++) {
				const newChild = c2[i];
				keyToNewIndexMap.set(newChild.key, i);
			}
			// 循环老的，查找
			for (let i = s1; i <= e1; i++) {
				const prevChild = c1[i];
				if (patched >= toBePatched) {
					remove(prevChild.el);
					continue;
				}
				let newIndex;
				// 当前老的节点 key 不是空
				if (prevChild.key !== null) {
					// 找新对应的
					newIndex = keyToNewIndexMap.get(prevChild.key);
				} else {
					// 老节点 key 为空，再次遍历新节点，找与当前老节点相同的 vnode
					for (let j = s2; j <= e2; j++) {
						if (isSameVNode(prevChild, c2[j])) {
							newIndex = j;
							break;
						}
					}
				}

				// 新节点不存在对应的老节点 删除
				if (newIndex === undefined) {
					remove(prevChild.el);
				} else {
					// 当前索引 >= 记录的最大索引
					if (newIndex >= maxNewIndexSoFar) {
						maxNewIndexSoFar = newIndex;
					} else {
						// 不是一直递增，需移动
						shouldMove = true;
					}
					newIndexToOldIndexMap[newIndex - s2] = i + 1;
					// 继续 patch
					patch(prevChild, c2[newIndex], container, parent, null);
					patched += 1;
				}
			}
			// 获取最长递增子序列索引
			const increasingNewIndexSquence = shouldMove
				? getSequence(newIndexToOldIndexMap)
				: [];
			// i 指向获取的最长递增子序列的索引
			// j 新节点
			// 倒序
			let j = increasingNewIndexSquence.length - 1;
			for (let i = toBePatched - 1; i >= 0; i--) {
				// 获取索引
				const nextIndex = i + s2;
				// 获取需要插入的元素
				const nextChild = c2[nextIndex];
				// 获取锚点
				const anchor = nextIndex + 1 < l2 ? c2[nextIndex + 1].el : null;
				// 如果某项是0，证明在旧节点中不存在，需创建
				if (newIndexToOldIndexMap[i] === 0) {
					console.log("创建");

					patch(null, nextChild, container, parent, anchor);
				} else if (shouldMove) {
					if (j <= 0 || i !== increasingNewIndexSquence[j]) {
						console.log("移动");

						insert(nextChild.el, container, anchor);
					} else {
						j -= 1;
					}
				}
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

function getSequence(arr: number[]): number[] {
	// 浅拷贝
	const _arr = arr.slice();
	const len = _arr.length;
	// 存储最长递增子序列对应 arr 的下标
	const result = [0];

	for (let i = 0; i < len; i++) {
		const val = _arr[i];

		if (val !== 0) {
			// 获取当前 result 最大值下标
			const j = result[result.length - 1];
			// 如果 当前 val 大于 当前递增子序列的最大值 直接添加
			if (arr[j] < val) {
				// 保存上一次递增子序列最后一个值的索引
				_arr[i] = j;
				result.push(i);
				continue;
			}

			// 二分法
			let left = 0;
			let right = result.length - 1;
			while (left < right) {
				const mid = Math.floor((left + right) / 2);
				if (arr[result[mid]] < val) {
					left = mid + 1;
				} else {
					right = mid;
				}
			}

			// 当前递增子序列按顺序找到第一个大于 val 的值
			if (val < arr[result[left]]) {
				if (left > 0) {
					// 保存上一次递增子序列最后一个值的索引
					_arr[i] = result[left - 1];
				}
				result[left] = i;
			}
		}

		let len2 = result.length;
		let idx = result[len2 - 1];
		while (len2-- > 0) {
			result[len2] = idx;
			idx = _arr[idx];
		}
	}

	return result;
}

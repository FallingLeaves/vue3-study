import { createVNode } from "./vnode";

export function createAppAPI(renderer, selector) {
	return function createApp(rootComponent) {
		return {
			mount(rootContainer) {
				const vnode = createVNode(rootComponent);
				// 如果传过来了 selector，我们就用 selector 方法来获取 rootContainer
				// 如果没有传 selector，就直接用 rootContainer
				renderer(vnode, selector ? selector(rootContainer) : rootContainer);
			},
		};
	};
}

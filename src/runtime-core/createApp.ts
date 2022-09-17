import { render } from "./render";
import { createVNode } from "./vnode";

export function createApp(rootComponent) {
	return {
		mount(rootContainer) {
			// rootComponent 转为 VNode
			const vnode = createVNode(rootComponent);
			render(vnode, document.querySelector(rootContainer));
		},
	};
}

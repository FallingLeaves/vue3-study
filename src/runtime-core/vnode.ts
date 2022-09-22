import { ShapeFlags } from "../shared/ShapeFlag";

export function createVNode(type, props?, children?) {
	const vnode = {
		type,
		props,
		children,
		el: null,
		// 初始化 component
		component: null,
		// 初始化 key
		key: props ? props.key : null,
		shapeFlags: getShapeFlags(type),
	};

	if (typeof children === "string") {
		vnode.shapeFlags |= ShapeFlags.TEXT_CHILDREN;
	} else if (Array.isArray(children)) {
		vnode.shapeFlags |= ShapeFlags.ARRAY_CHILDREN;
	}

	return vnode;
}

function getShapeFlags(type) {
	return typeof type === "string"
		? ShapeFlags.ELEMENT
		: ShapeFlags.STATEFUL_COMPONENT;
}

export const Fragment = Symbol("Fragment");

export const TextNode = Symbol("TextNode");

export function createTextVNode(text) {
	return createVNode(TextNode, {}, text);
}

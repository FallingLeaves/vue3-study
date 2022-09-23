import { TO_DISPLAY_STRING } from "./runtimerHelpers";
import { NodeType } from "./ast";

export function transform(root, options = {}) {
	// 创建 transform 上下文
	const context = createTransformContext(root, options);
	traverseNode(root, context);
	createRootCodegen(root);
	// 根节点挂载 helpers
	root.helpers = [...context.helpers.keys()];
}

function traverseNode(node, context) {
	const { nodeTransforms } = context;
	for (let i = 0; i < nodeTransforms.length; i++) {
		const transform = nodeTransforms[i];
		transform(node, context);
	}
	// 遍历树根据不同 node 的类型存入不同的 helper
	switch (node.type) {
		case NodeType.INTERPOLATION:
			context.helper(TO_DISPLAY_STRING);
			break;
		case NodeType.ROOT:
		case NodeType.ELEMENT:
			// ROOT 和 ELEMENT 存在children
			traverseChildren(node, context);
		default:
			break;
	}
}

function traverseChildren(node, context) {
	const children = node.children;
	if (children) {
		for (let i = 0; i < children.length; i++) {
			traverseNode(children[i], context);
		}
	}
}

function createTransformContext(root, options) {
	const context = {
		root,
		nodeTransforms: options.nodeTransforms || {},
		helpers: new Map(),
		helper(name: string) {
			context.helpers.set(name, 1);
		},
	};
	return context;
}

function createRootCodegen(root) {
	root.codegenNode = root.children[0];
}

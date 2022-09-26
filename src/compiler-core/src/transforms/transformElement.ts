import { CREATE_ELEMENT_VNODE } from "../runtimerHelpers";
import { NodeType, createVNodeCall } from "../ast";

export function transformElement(node, context) {
	if (node.type === NodeType.ELEMENT) {
		return () => {
			// 处理 props 和 tag
			const vnodeTag = `'${node.tag}'`;
			const vnodeProps = node.props;

			const { children } = node;
			const vnodeChildren = children;

			node.codegenNode = createVNodeCall(
				context,
				vnodeTag,
				vnodeProps,
				vnodeChildren
			);
		};
	}
}

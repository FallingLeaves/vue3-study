import { CREATE_ELEMENT_VNODE } from "../runtimerHelpers";
import { NodeType } from "../ast";

export function transformElement(node, context) {
	if (node.type === NodeType.ELEMENT) {
		context.helper(CREATE_ELEMENT_VNODE);
	}
}

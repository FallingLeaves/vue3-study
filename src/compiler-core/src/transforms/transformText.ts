import { NodeType } from "../ast";

export function transformText(node) {
	return () => {
		const { children } = node;
		if (children && children.length) {
			let currentContainer;
			for (let i = 0; i < children.length; i++) {
				const child = children[i];
				if (isText(child)) {
					for (let j = i + 1; j < children.length; j++) {
						const next = children[j];
						if (isText(next)) {
							// 相邻的是 text 或者 interpolation 就变成联合类型
							if (!currentContainer) {
								currentContainer = children[i] = {
									type: NodeType.COMPOUND_EXPRESSION,
									children: [child],
								};
							}
							// 每个相邻的下一个之前加上 +
							currentContainer.children.push(" + ");
							currentContainer.children.push(next);
							// 删除
							children.splice(j, 1);
							// 修正索引
							j -= 1;
						} else {
							currentContainer = undefined;
							break;
						}
					}
				}
			}
		}
	};
}

function isText(node) {
	return node.type === NodeType.TEXT || node.type === NodeType.INTERPOLATION;
}

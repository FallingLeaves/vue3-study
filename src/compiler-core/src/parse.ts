import { NodeType } from "./ast";

const enum TagType {
	START,
	END,
}

export function baseParse(content: string) {
	const context = createContext(content);
	return createRoot(parseChildren(context, []));
}

// 创建上下文
function createContext(content: string) {
	return {
		source: content,
	};
}

// 创建 ast 根节点
function createRoot(children) {
	return {
		children,
		type: NodeType.ROOT,
	};
}

// 结束条件 1. 遇到结束标签  2. context.source 没值了
function isEnd(context: { source: string }, ancestors) {
	const s = context.source;
	if (s.startsWith("</")) {
		for (let i = ancestors.length - 1; i >= 0; i--) {
			const tag = ancestors[i].tag;
			if (startsWidthEndTagOpen(context.source, tag)) {
				return true;
			}
		}
	}
	return !s;
}

function startsWidthEndTagOpen(source, tag) {
	const endTokenLength = "</".length;
	return source.slice(endTokenLength, tag.length + endTokenLength) === tag;
}

// 创建 children
function parseChildren(context: { source: string }, ancestors): any {
	const nodes: any[] = [];
	while (!isEnd(context, ancestors)) {
		let node;
		const s = context.source;
		if (s.startsWith("{{")) {
			node = parseInterpolation(context);
		} else if (s.startsWith("<") && /[a-z]/i.test(s[1])) {
			// 第一位是 < 并且第二位是 a-z
			node = parseElement(context, ancestors);
		}
		// 如果上面两种无法解析，就是普通的 text 节点
		if (!node) {
			node = parseText(context);
		}
		nodes.push(node);
	}

	return nodes;
}

function parseText(context: { source: string }): any {
	// 获取 content
	// 如果 context.source 包含 {{ ，就以 {{ 作为结束点
	const s = context.source;
	const endTokens = ["<", "{{"];
	let endIndex = s.length;
	for (let i = 0; i < endTokens.length; i++) {
		const index = s.indexOf(endTokens[i]);
		if (index !== -1 && endIndex > index) {
			endIndex = index;
		}
	}
	const content = parseTextData(context, endIndex);
	advanceBy(context, content.length);
	return {
		type: NodeType.TEXT,
		content,
	};
}

//
function parseElement(context: { source: string }, ancestors): any {
	const element: any = parseTag(context, TagType.START);
	ancestors.push(element);
	element.children = parseChildren(context, ancestors);
	ancestors.pop();
	if (startsWidthEndTagOpen(context.source, element.tag)) {
		parseTag(context, TagType.END);
	} else {
		throw new Error(`不存在结束标签: ${element.tag}`);
	}
	return element;
}

//
function parseTag(context: { source: string }, type: TagType) {
	console.log(context);

	const match = /^<\/?([a-z]*)/i.exec(context.source);
	const tag = match![1];
	advanceBy(context, match![0].length + 1);
	if (type === TagType.END) {
		return;
	}
	return {
		type: NodeType.ELEMENT,
		tag,
	};
}

// 解析插值表达式 {{message}}
function parseInterpolation(context: { source: string }) {
	const openDelimiter = "{{";
	const closeDelimiter = "}}";
	// 将字符串截取
	const closeIndex = context.source.indexOf(
		closeDelimiter,
		openDelimiter.length
	);
	// 将字符串前面的 {{ 舍弃
	advanceBy(context, openDelimiter.length);
	// 获取 {{}} 中间值的长度
	const rawContentLength = closeIndex - closeDelimiter.length;
	// 获取
	const rawContent = parseTextData(context, rawContentLength);
	const content = rawContent.trim();
	advanceBy(context, rawContentLength + closeDelimiter.length);

	return {
		type: NodeType.INTERPOLATION,
		content: {
			type: NodeType.SIMPLE_EXPRESSION,
			content: content,
		},
	};
}

function advanceBy(context, length: number) {
	context.source = context.source.slice(length);
}

function parseTextData(context: { source: string }, length: number) {
	return context.source.slice(0, length);
}

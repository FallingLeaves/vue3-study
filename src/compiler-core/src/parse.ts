import { NodeType } from "./ast";

const enum TagType {
	START,
	END,
}

export function baseParse(content: string) {
	const context = createContext(content);
	return createRoot(parseChildren(context));
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
	};
}

// 创建 children
function parseChildren(context: { source: string }): any {
	const nodes: any[] = [];
	let node;
	const s = context.source;
	if (s.startsWith("{{")) {
		node = parseInterpolation(context);
	} else if (s.startsWith("<") && /[a-z]/i.test(s[1])) {
		// 第一位是 < 并且第二位是 a-z
		node = parseElement(context);
	}
	// 如果上面两种无法解析，就是普通的 text 节点
	if (!node) {
		node = parseText(context);
	}
	nodes.push(node);
	return [node];
}

function parseText(context: { source: string }): any {
	// 获取 content
	const content = parseTextData(context, context.source.length);
	advanceBy(context, content.length);
	return {
		type: NodeType.TEXT,
		content,
	};
}

//
function parseElement(context: { source: string }): any {
	const element = parseTag(context, TagType.START);
	parseTag(context, TagType.END);
	return element;
}

//
function parseTag(context: { source: string }, type: TagType) {
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

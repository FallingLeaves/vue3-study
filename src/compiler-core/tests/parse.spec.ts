import { NodeType } from "../src/ast";
import { baseParse } from "../src/parse";

describe("parse", () => {
	describe("interpolation", () => {
		test("simple interpolation", () => {
			const interpolation = "{{message}}";
			const ast = baseParse(interpolation);
			expect(ast.children[0]).toStrictEqual({
				type: NodeType.INTERPOLATION,
				content: {
					type: NodeType.SIMPLE_EXPRESSION,
					content: "message",
				},
			});
		});

		test("simple element", () => {
			const elementStr = "<div></div>";
			const ast = baseParse(elementStr);
			expect(ast.children[0]).toStrictEqual({
				type: NodeType.ELEMENT,
				tag: "div",
				children: [],
			});
		});

		test("simple text", () => {
			const textStr = "simple text";
			const ast = baseParse(textStr);
			expect(ast.children[0]).toStrictEqual({
				type: NodeType.TEXT,
				content: "simple text",
			});
		});

		test("happy path", () => {
			const ast = baseParse("<div>hi,{{message}}</div>");
			expect(ast.children[0]).toStrictEqual({
				type: NodeType.ELEMENT,
				tag: "div",
				children: [
					{
						type: NodeType.TEXT,
						content: "hi,",
					},
					{
						type: NodeType.INTERPOLATION,
						content: {
							type: NodeType.SIMPLE_EXPRESSION,
							content: "message",
						},
					},
				],
			});
		});

		test("should throw error when lack end tag", () => {
			expect(() => {
				baseParse("<div><span></div>");
			}).toThrow();
		});
	});
});

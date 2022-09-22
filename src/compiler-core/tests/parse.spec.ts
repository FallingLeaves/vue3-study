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
	});
});

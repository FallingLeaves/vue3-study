import { baseParse } from "../src";
import { codegen } from "../src/codegen";
import { transform } from "../src/transform";
import { transformElement } from "../src/transforms/transformElement";
import { transformExpression } from "../src/transforms/transformExpression";

describe("codegen", () => {
	test("text", () => {
		const template = "hi";
		const ast = baseParse(template);
		transform(ast);
		const code = codegen(ast);
		console.log(code);
		expect(code).toMatchSnapshot();
	});

	test("interpolation", () => {
		const template = "{{message}}";
		const ast = baseParse(template);
		transform(ast, {
			nodeTransforms: [transformExpression],
		});
		const code = codegen(ast);
		console.log(code);
		expect(code).toMatchSnapshot();
	});

	test("simple element", () => {
		const template = `<div></div>`;
		const ast = baseParse(template);
		transform(ast, {
			nodeTransforms: [transformElement],
		});
		const code = codegen(ast);
		console.log(code);

		expect(code).toMatchSnapshot();
	});
});

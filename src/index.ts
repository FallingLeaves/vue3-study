// export * from "./runtime-core";
export * from "./runtime-dom";
export * from "./compiler-core/src";

import { baseCompile } from "./compiler-core/src";
import { registerCompiler } from "./runtime-core/component";
import * as runtimeDom from "./runtime-dom";

function compileToFunction(template: string) {
	const { code } = baseCompile(template);
	const render = new Function("Vue", code)(runtimeDom);
	return render;
}

registerCompiler(compileToFunction);

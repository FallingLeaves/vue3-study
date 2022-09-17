import {
	reactive,
	readonly,
	isReactive,
	isReadonly,
	shallowReadonly,
	shallowReactive,
	toRaw,
} from "../reactive";

describe("reactive", () => {
	it("happy path", () => {
		const original = { foo: 1, bar: 2 };
		const wrapped = readonly(original);

		expect(wrapped).not.toBe(original);
		expect(wrapped.bar).toBe(2);
		wrapped.foo = 2;
		expect(wrapped.foo).toBe(1);

		const observed = reactive(original);
		// 期望包装后和源对象不一样
		expect(observed).not.toBe(original);
		// 包装后某个属性值和源对象一样
		expect(observed.foo).toBe(original.foo);

		expect(isReactive(observed)).toBe(true);
		expect(isReactive(original)).toBe(false);

		expect(isReadonly(wrapped)).toBe(true);
		expect(isReadonly(original)).toBe(false);

		const original2 = { bar: { foo: 1 } };
		const shallow = shallowReadonly(original2);

		expect(isReadonly(shallow)).toBe(true);
		expect(isReadonly(shallow.bar)).toBe(false);

		const observed2 = shallowReactive(original2);

		expect(isReactive(observed2)).toBe(true);
		expect(isReactive(observed2.bar)).toBe(false);

		const reactiveOrigin = { key: "reactive" };
		expect(toRaw(reactive(reactiveOrigin))).toEqual(reactiveOrigin);

		const readonlyOrigin = { key: "readonly" };
		expect(toRaw(readonly(readonlyOrigin))).toEqual(readonlyOrigin);

		const shallowReadonlyOrigin = { key: "shallowReadonly" };
		expect(toRaw(shallowReadonly(shallowReadonlyOrigin))).toEqual(
			shallowReadonlyOrigin
		);

		const shallowReactiveOrigin = { key: "shallowReactive" };
		expect(toRaw(shallowReactive(shallowReactiveOrigin))).toEqual(
			shallowReactiveOrigin
		);

		const nestedWrapped = {
			foo: { bar: { baz: 1 } },
			foo2: { bar: { bza: 2 } },
		};
		expect(toRaw(reactive(nestedWrapped))).toEqual(nestedWrapped);
	});

	it("should warn when update readonly prop value", () => {
		console.warn = jest.fn();
		const readonlyObj = readonly({ foo: 1 });
		readonlyObj.foo = 2;
		expect(console.warn).toHaveBeenCalled();
	});

	it("nested reactive", () => {
		const original = {
			nested: { foo: 1 },
			array: [{ bar: 2 }],
		};
		const observed = reactive(original);

		expect(isReactive(observed.nested)).toBe(true);
		expect(isReactive(observed.array)).toBe(true);
		expect(isReactive(observed.array[0])).toBe(true);
	});

	it("should readonly nested object", () => {
		const nested = { foo: { innerFoo: 1 }, bar: [{ innerBar: 2 }] };
		const wrapped = readonly(nested);

		expect(isReadonly(wrapped.foo)).toBe(true);
		expect(isReadonly(wrapped.bar)).toBe(true);
		expect(isReadonly(wrapped.bar[0])).toBe(true);
	});
});

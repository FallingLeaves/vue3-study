import { createRenderer } from "../runtime-core/render";

export function createElement(type) {
	return document.createElement(type);
}

const isOn = (key: string) => /^on[A-Z]/.test(key);

export function patchProp(el, prop: string, props) {
	if (isOn(prop)) {
		const event = prop.slice(2).toLowerCase();
		el.addEventListener(event, props[prop]);
	} else {
		el.setAttribute(prop, props[prop]);
	}
}

export function insert(el, parent) {
	parent.appendChild(el);
}

export function selector(container) {
	return document.querySelector(container);
}

const renderer: any = createRenderer({
	createElement,
	patchProp,
	insert,
	selector,
});

export const createApp = (...args) => {
	return renderer.createApp(...args);
};

export * from "../runtime-core";
export * from "../reactivity";

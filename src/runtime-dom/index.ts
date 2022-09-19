import { createRenderer } from "../runtime-core/render";

export function createElement(type) {
	return document.createElement(type);
}

const isOn = (key: string) => /^on[A-Z]/.test(key);

export function patchProp(el, prop: string, val, oldVal) {
	if (isOn(prop)) {
		const event = prop.slice(2).toLowerCase();
		el.addEventListener(event, val);
	} else {
		if (val === undefined || null) {
			el.removeAttribute(prop);
		} else {
			el.setAttribute(prop, val);
		}
	}
}

export function insert(el, parent) {
	parent.appendChild(el);
}

export function selector(container) {
	return document.querySelector(container);
}

export function remove(child) {
	const parentElement = child.parentNode;
	if (parentElement) {
		parentElement.removeChild(child);
	}
}

export function setElementText(el, text) {
	el.textContent = text;
}

const renderer: any = createRenderer({
	createElement,
	patchProp,
	insert,
	selector,
	remove,
	setElementText,
});

export const createApp = (...args) => {
	return renderer.createApp(...args);
};

export * from "../runtime-core";
export * from "../reactivity";

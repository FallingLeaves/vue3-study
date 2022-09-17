import { h } from "../h";
import { Fragment } from "../vnode";

export function renderSlots(slots, name = "default", props) {
	const slot = slots[name];
	if (slot) {
		if (typeof slot === "function") {
			return h(Fragment, {}, slot(props));
		}
	}
}

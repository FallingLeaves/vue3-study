export function initSlots(instance, slots) {
	if (!slots) {
		return;
	}

	if (slots.vnode) {
		instance.slots.default = [slots];
		return;
	}

	if (Array.isArray(slots)) {
		instance.slots.default = slots;
		return;
	}

	for (const slotName of Object.keys(slots)) {
		instance.slots[slotName] = (props) =>
			normalizeSlots(slots[slotName](props));
	}
}

function normalizeSlots(slots) {
	return Array.isArray(slots) ? slots : [slots];
}

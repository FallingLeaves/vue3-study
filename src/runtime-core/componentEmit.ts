export function emit(instance, event, ...params) {
	const { props } = instance;
	// 在这里进行正则匹配，将 横杠和第一个字母 -> 不要横杠，第一个字母大写
	const camelize = (str: string) => {
		return str.replace(/-(\w)/, (_, str: string) => {
			return str.toUpperCase();
		});
	};
	const capitalize = (str: string) =>
		str ? str.charAt(0).toUpperCase() + str.slice(1) : "";
	// 在这里先处理横杠，在处理大小写
	const handler = props[`on${capitalize(camelize(event))}`];
	handler && handler(...params);
}

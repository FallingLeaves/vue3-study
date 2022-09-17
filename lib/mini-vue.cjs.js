'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

const extend = Object.assign;
function isObject(val) {
    return val !== null && typeof val === "object";
}
function hasOwn(target, key) {
    return Reflect.has(target, key);
}

//
const targetMap = new WeakMap();
function track(target, key) {
    // 可能创建多个 target，每个 target 可能有多个 key，每个 key 关联多个 effectFn
    let depsMap = targetMap.get(target);
    if (!depsMap) {
        depsMap = new Map();
        targetMap.set(target, depsMap);
    }
    let dep = depsMap.get(key);
    if (!dep) {
        dep = new Set();
        depsMap.set(key, dep);
    }
}
function trigger(target, key) {
    // 取出 deps 遍历执行 effect
    const depsMap = targetMap.get(target);
    const deps = depsMap.get(key);
    triggerEffect(deps);
}
function triggerEffect(deps) {
    for (const effect of deps) {
        if (effect.options.scheduler) {
            effect.options.scheduler();
        }
        else {
            effect.run();
        }
    }
}

const get = createGetter();
const readonlyGet = createGetter(true);
const set = createSetter();
const shallowReadonlyGet = createGetter(true, true);
const shallowMutableGet = createGetter(false, true);
function createGetter(isReadonly = false, shallow = false) {
    return function get(target, key, receiver) {
        if (key === "__v_isReactive" /* ReactiveFlags.IS_REACTIVE */) {
            return !isReadonly;
        }
        else if (key === "__v_isReadonly" /* ReactiveFlags.IS_READONLY */) {
            return isReadonly;
        }
        else if (key === "__v_raw" /* ReactiveFlags.RAW */) {
            return target;
        }
        const res = Reflect.get(target, key, receiver);
        if (shallow) {
            return res;
        }
        // 嵌套处理
        if (isObject(res)) {
            return isReadonly ? readonly(res) : reactive(res);
        }
        if (!isReadonly) {
            track(target, key);
        }
        return res;
    };
}
function createSetter() {
    return function set(target, key, value, receiver) {
        const res = Reflect.set(target, key, value, receiver);
        trigger(target, key);
        return res;
    };
}
const mutableHandlers = {
    get,
    set,
};
const readonlyHandlers = {
    get: readonlyGet,
    set(target, key, value) {
        console.warn(`key: ${key} set value: ${value} fail, because the target is readonly`, target);
        return true;
    },
};
const shallowReadonlyHandlers = extend({}, readonlyHandlers, {
    get: shallowReadonlyGet,
});
extend({}, mutableHandlers, {
    get: shallowMutableGet,
});

function createActiveObject(raw, baseHandlers) {
    return new Proxy(raw, baseHandlers);
}
function reactive(raw) {
    return createActiveObject(raw, mutableHandlers);
}
function readonly(raw) {
    return createActiveObject(raw, readonlyHandlers);
}
function shallowReadonly(raw) {
    return createActiveObject(raw, shallowReadonlyHandlers);
}

function emit(instance, event, ...params) {
    const { props } = instance;
    // 在这里进行正则匹配，将 横杠和第一个字母 -> 不要横杠，第一个字母大写
    const camelize = (str) => {
        return str.replace(/-(\w)/, (_, str) => {
            return str.toUpperCase();
        });
    };
    const capitalize = (str) => str ? str.charAt(0).toUpperCase() + str.slice(1) : "";
    // 在这里先处理横杠，在处理大小写
    const handler = props[`on${capitalize(camelize(event))}`];
    handler && handler(...params);
}

function initProps(instance, rawProps) {
    instance.props = rawProps || {};
}

function initSlots(instance, slots) {
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
        instance.slots[slotName] = (props) => normalizeSlots(slots[slotName](props));
    }
}
function normalizeSlots(slots) {
    return Array.isArray(slots) ? slots : [slots];
}

let currentInstance;
function getCurrentInstance() {
    return currentInstance;
}
function setCurrentInstance(instance) {
    currentInstance = instance;
}
function createComponentInstance(vnode, parent) {
    // 返回 component 数据结构
    const component = {
        vnode,
        type: vnode.type,
        setupState: {},
        props: {},
        emit: () => { },
        slots: {},
        // 初始化的 provides 指向父级的 provides
        provides: parent ? parent.provides : {},
        // 挂载parent
        parent,
    };
    // 传参
    component.emit = emit.bind(null, component);
    return component;
}
function setupComponent(instance, container) {
    // initProps
    initProps(instance, instance.vnode.props);
    // initSlots
    initSlots(instance, instance.vnode.children);
    // 处理 setup 返回值
    setupStatefulComponent(instance);
}
function setupStatefulComponent(instance, container) {
    // 获取 setup 返回值
    //
    const component = instance.vnode.type;
    instance.proxy = new Proxy({ _: instance }, componentPublicInstanceProxyHandlers);
    const { setup } = component;
    if (setup) {
        setCurrentInstance(instance);
        // 返回函数 作为组件的render  反之 是 setupState 注入到上下文中
        const setupResult = setup(shallowReadonly(instance.props), {
            emit: instance.emit,
        });
        setCurrentInstance(null);
        handleSetupResult(instance, setupResult);
    }
}
function handleSetupResult(instance, setupResult) {
    // 先处理 object
    if (typeof setupResult === "object") {
        instance.setupState = setupResult;
    }
    finishComponentSetup(instance);
}
function finishComponentSetup(instance) {
    const component = instance.type;
    if (!instance.render) {
        instance.render = component.render;
    }
}
const PublicProxyGetterMapping = {
    $el: (i) => i.vnode.el,
    $slots: (i) => i.slots,
    $props: (i) => i.props,
};
const componentPublicInstanceProxyHandlers = {
    get({ _: instance }, key) {
        const { setupState, props } = instance;
        if (hasOwn(setupState, key)) {
            return Reflect.get(setupState, key);
        }
        else if (hasOwn(props, key)) {
            return Reflect.get(props, key);
        }
        const publicGetter = PublicProxyGetterMapping[key];
        if (publicGetter) {
            return publicGetter(instance);
        }
    },
};

function createVNode(type, props, children) {
    const vnode = {
        type,
        props,
        children,
        el: null,
        shapeFlags: getShapeFlags(type),
    };
    if (typeof children === "string") {
        vnode.shapeFlags |= 4 /* ShapeFlags.TEXT_CHILDREN */;
    }
    else if (Array.isArray(children)) {
        vnode.shapeFlags |= 8 /* ShapeFlags.ARRAY_CHILDREN */;
    }
    return vnode;
}
function getShapeFlags(type) {
    return typeof type === "string"
        ? 1 /* ShapeFlags.ELEMENT */
        : 2 /* ShapeFlags.STATEFUL_COMPONENT */;
}
const Fragment = Symbol("Fragment");
const TextNode = Symbol("TextNode");
function createTextVNode(text) {
    return createVNode(TextNode, {}, text);
}

function createAppAPI(renderer, selector) {
    return function createApp(rootComponent) {
        return {
            mount(rootContainer) {
                const vnode = createVNode(rootComponent);
                // 如果传过来了 selector，我们就用 selector 方法来获取 rootContainer
                // 如果没有传 selector，就直接用 rootContainer
                renderer(vnode, selector ? selector(rootContainer) : rootContainer);
            },
        };
    };
}

function createRenderer(options) {
    const { createElement, insert, patchProp, selector } = options;
    function render(vnode, container, parent) {
        // 递归处理子节点
        patch(vnode, container, parent);
    }
    function patch(vnode, container, parent) {
        const { shapeFlags, type } = vnode;
        switch (type) {
            case Fragment:
                processFragment(vnode, container, parent);
                break;
            case TextNode:
                processTextNode(vnode, container);
                break;
            default:
                if (shapeFlags & 1 /* ShapeFlags.ELEMENT */) {
                    processElement(vnode, container, parent);
                }
                else if (shapeFlags & 2 /* ShapeFlags.STATEFUL_COMPONENT */) {
                    processComponent(vnode, container, parent);
                }
                break;
        }
    }
    function processFragment(vnode, container, parent) {
        // 因为 fragment 就是用来处理 children 的
        mountChildren(vnode, container, parent);
    }
    function processTextNode(vnode, container) {
        const element = (vnode.el = document.createTextNode(vnode.children));
        container.appendChild(element);
    }
    function processComponent(vnode, container, parent) {
        mountComponent(vnode, container, parent);
    }
    function processElement(vnode, container, parent) {
        // 分为 init 和 update 两种，这里先写 init
        mountElement(vnode, container, parent);
    }
    // vnode -> domEl
    function mountElement(vnode, container, parent) {
        const { type: domElType, props, children, shapeFlags } = vnode;
        const domEl = (vnode.el = createElement(domElType));
        for (const prop in props) {
            patchProp(domEl, prop, props);
        }
        if (shapeFlags & 4 /* ShapeFlags.TEXT_CHILDREN */) {
            domEl.textContent = children;
        }
        else if (shapeFlags & 8 /* ShapeFlags.ARRAY_CHILDREN */) {
            mountChildren(vnode, domEl, parent);
        }
        insert(domEl, container);
    }
    function mountChildren(vnode, container, parent) {
        vnode.children.forEach((child) => {
            // 如果 children 是一个 array，就递归 patch
            patch(child, container, parent);
        });
    }
    function mountComponent(vnode, container, parent) {
        // 通过 vnode 获取组件实例
        const instance = createComponentInstance(vnode, parent);
        setupComponent(instance);
        setupRenderEffect(instance, vnode, container);
    }
    function setupRenderEffect(instance, vnode, container) {
        const { setupState, proxy } = instance;
        const subTree = instance.render.call(proxy, proxy);
        patch(subTree, container, instance);
        vnode.el = subTree.el;
    }
    return {
        createApp: createAppAPI(render, selector),
    };
}

function h(type, props, children) {
    return createVNode(type, props, children);
}

function renderSlots(slots, name = "default", props) {
    const slot = slots[name];
    if (slot) {
        if (typeof slot === "function") {
            return h(Fragment, {}, slot(props));
        }
    }
}

function provide(key, value) {
    const currentInstance = getCurrentInstance();
    if (currentInstance) {
        let provides = currentInstance.provides;
        if (currentInstance.parent) {
            const parentProvides = currentInstance.parent.provides;
            // 如果 provides 和 parent.provides 一样，就是初始化阶段
            if (provides === parentProvides) {
                // 此时将 provides 的原型链设置为 parent.provides
                // 这样我们在设置的时候就不会五绕道 parent.provides
                // 在读取的时候因为原型链的特性，我们也能读取到 parent.provides
                provides = currentInstance.provides = Object.create(parentProvides);
            }
        }
        provides[key] = value;
    }
}
function inject(key, defaultValue) {
    const currentInstance = getCurrentInstance();
    if (currentInstance) {
        const { parent } = currentInstance;
        if (key in parent.provides) {
            return parent.provides[key];
        }
        else if (defaultValue) {
            if (typeof defaultValue === "function") {
                return defaultValue();
            }
            return defaultValue;
        }
    }
}

function createElement(type) {
    return document.createElement(type);
}
const isOn = (key) => /^on[A-Z]/.test(key);
function patchProp(el, prop, props) {
    if (isOn(prop)) {
        const event = prop.slice(2).toLowerCase();
        el.addEventListener(event, props[prop]);
    }
    else {
        el.setAttribute(prop, props[prop]);
    }
}
function insert(el, parent) {
    parent.appendChild(el);
}
function selector(container) {
    return document.querySelector(container);
}
const renderer = createRenderer({
    createElement,
    patchProp,
    insert,
    selector,
});
const createApp = (...args) => {
    return renderer.createApp(...args);
};

exports.createApp = createApp;
exports.createElement = createElement;
exports.createRenderer = createRenderer;
exports.createTextVNode = createTextVNode;
exports.getCurrentInstance = getCurrentInstance;
exports.h = h;
exports.inject = inject;
exports.insert = insert;
exports.patchProp = patchProp;
exports.provide = provide;
exports.renderSlots = renderSlots;
exports.selector = selector;

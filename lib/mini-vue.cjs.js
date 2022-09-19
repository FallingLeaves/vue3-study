'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

const extend = Object.assign;
function isObject(val) {
    return val !== null && typeof val === "object";
}
function hasChanged(val, newVal) {
    return !Object.is(val, newVal);
}
function hasOwn(target, key) {
    return Reflect.has(target, key);
}
const EMPTY_OBJ = {};

let activeEffect;
class ReactiveEffect {
    constructor(fn, options) {
        this.options = options;
        // 反向记录对应 dep
        this.deps = [];
        this.active = true;
        this._fn = fn;
    }
    run() {
        // 保存当前的 this
        activeEffect = this;
        const res = this._fn();
        return res;
    }
    // 根据 this.deps 删除 this 对应的effect
    stop() {
        cleanupEffect(this);
    }
}
function effect(fn, options = {}) {
    const _effect = new ReactiveEffect(fn, options);
    extend(_effect, options);
    _effect.run();
    const runner = _effect.run.bind(_effect);
    runner.effect = _effect;
    return runner;
    // this 指向
    // return _effect.run.bind(_effect);
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
    trackEffect(dep);
}
function trackEffect(dep) {
    if (activeEffect && activeEffect.active) {
        // 反向追踪 activeEffect 的 dep
        activeEffect.deps.push(dep);
        // 将 effect 加人到 dep
        dep.add(activeEffect);
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
function cleanupEffect(effect) {
    if (effect.active) {
        effect.deps.forEach((dep) => {
            dep.delete(effect);
        });
        if (effect.onStop) {
            effect.onStop();
        }
        effect.active = false;
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

class RefImpl {
    constructor(value) {
        // 存储依赖
        this.deps = new Set();
        // 判断是否是对象
        this._value = isObject(value) ? reactive(value) : value;
        this["__v_isRef" /* RefFlags.IS_REF */] = true;
    }
    get value() {
        trackEffect(this.deps);
        return this._value;
    }
    set value(newValue) {
        if (hasChanged(this._value, newValue)) {
            this._value = newValue;
            triggerEffect(this.deps);
        }
    }
}
function ref(value) {
    return new RefImpl(value);
}
function isRef(ref) {
    return !!ref["__v_isRef" /* RefFlags.IS_REF */];
}
function unRef(ref) {
    return ref["__v_isRef" /* RefFlags.IS_REF */] ? ref.value : ref;
}
function proxyRefs(objectWithRefs) {
    if (!isObject(objectWithRefs))
        return;
    return new Proxy(objectWithRefs, {
        get(target, key, receiver) {
            return unRef(Reflect.get(target, key, receiver));
        },
        set(target, key, value, receiver) {
            // 原有的值是 ref 新值不是 ref 更新原来的 ref.value = newValue
            // 原有的值是 ref 新值也是 直接替换
            if (isRef(target[key]) && !isRef(value)) {
                return (target[key].value = value);
            }
            else {
                return Reflect.set(target, key, value, receiver);
            }
        },
    });
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
        const setupResult = proxyRefs(setup(shallowReadonly(instance.props), {
            emit: instance.emit,
        }));
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
    const { createElement, insert, patchProp, selector, setElementText, remove } = options;
    function render(vnode, container, parent) {
        // 递归处理子节点
        patch(null, vnode, container, parent);
    }
    function patch(n1, n2, container, parent) {
        const { shapeFlags, type } = n2;
        switch (type) {
            case Fragment:
                processFragment(n2, container, parent);
                break;
            case TextNode:
                processTextNode(n2, container);
                break;
            default:
                if (shapeFlags & 1 /* ShapeFlags.ELEMENT */) {
                    processElement(n1, n2, container, parent);
                }
                else if (shapeFlags & 2 /* ShapeFlags.STATEFUL_COMPONENT */) {
                    processComponent(n1, n2, container, parent);
                }
                break;
        }
    }
    function processFragment(n2, container, parent) {
        // 因为 fragment 就是用来处理 children 的
        mountChildren(n2.children, container, parent);
    }
    function processTextNode(vnode, container) {
        const element = (vnode.el = document.createTextNode(vnode.children));
        container.appendChild(element);
    }
    function processComponent(n1, n2, container, parent) {
        mountComponent(n2, container, parent);
    }
    function processElement(n1, n2, container, parent) {
        // 分为 init 和 update 两种，这里先写 init
        if (n1) {
            // update 逻辑
            patchElement(n1, n2, container, parent);
        }
        else {
            // init 逻辑
            mountElement(n2, container, parent);
        }
    }
    function patchElement(n1, n2, container, parent) {
        console.log("更新");
        const oldProps = n1.props || EMPTY_OBJ;
        const newProps = n2.props || EMPTY_OBJ;
        const el = (n2.el = n1.el);
        patchProps(el, oldProps, newProps);
        patchChildren(n1, n2, container, parent);
    }
    function patchProps(el, oldProps, newProps) {
        // old !== new 更新
        // old 存在，new !== undefined 删除
        // old 存在，new 不存在 删除
        if (oldProps === newProps) {
            return;
        }
        // old !== new
        for (const propKey of Reflect.ownKeys(newProps)) {
            const oldProp = oldProps[propKey];
            const newProp = newProps[propKey];
            // 新旧属性对比
            if (oldProp !== newProp) {
                patchProp(el, propKey, newProp, oldProp);
            }
        }
        if (oldProps !== EMPTY_OBJ) {
            // old 存在 new 不存在
            for (const propKey of Reflect.ownKeys(oldProps)) {
                if (!(propKey in oldProps)) {
                    patchProp(el, propKey, undefined, oldProps[propKey]);
                }
            }
        }
    }
    function patchChildren(n1, n2, container, parent) {
        const prevShapeFlag = n1.shapeFlags;
        const shapeFlag = n2.shapeFlags;
        const c1 = n1.children;
        const c2 = n2.children;
        // 文本
        if (shapeFlag & 4 /* ShapeFlags.TEXT_CHILDREN */) {
            if (prevShapeFlag & 8 /* ShapeFlags.ARRAY_CHILDREN */) {
                // 清空原有 children
                unmountChildren(n1.children);
            }
            if (c1 !== c2) {
                setElementText(n2.el, c2);
            }
        }
        else {
            // 数组
            if (prevShapeFlag & 4 /* ShapeFlags.TEXT_CHILDREN */) {
                setElementText(n1.el, "");
                mountChildren(c2, container, parent);
            }
        }
    }
    function unmountChildren(children) {
        for (let index = 0; index < children.length; index++) {
            const child = children[index];
            remove(child.el);
        }
    }
    // vnode -> domEl
    function mountElement(n2, container, parent) {
        const { type: domElType, props, children, shapeFlags } = n2;
        const domEl = (n2.el = createElement(domElType));
        for (const prop in props) {
            patchProp(domEl, prop, props[prop]);
        }
        if (shapeFlags & 4 /* ShapeFlags.TEXT_CHILDREN */) {
            domEl.textContent = children;
        }
        else if (shapeFlags & 8 /* ShapeFlags.ARRAY_CHILDREN */) {
            mountChildren(n2.children, domEl, parent);
        }
        insert(domEl, container);
    }
    function mountChildren(children, container, parent) {
        children.forEach((child) => {
            // 如果 children 是一个 array，就递归 patch
            patch(null, child, container, parent);
        });
    }
    function mountComponent(n2, container, parent) {
        // 通过 vnode 获取组件实例
        const instance = createComponentInstance(n2, parent);
        setupComponent(instance);
        setupRenderEffect(instance, n2, container);
    }
    function setupRenderEffect(instance, vnode, container) {
        const { setupState, proxy } = instance;
        effect(() => {
            // 根据 instance.isMounted 状态判断
            if (instance.isMounted) {
                // update
                const subTree = instance.render.call(proxy, proxy);
                vnode.el = subTree.el;
                // 获取上一个 subTree
                const preSubTree = instance.subTree;
                instance.subTree = subTree;
                console.log({ subTree, preSubTree });
                patch(preSubTree, subTree, container, instance);
            }
            else {
                // init 逻辑
                const subTree = (instance.subTree = instance.render.call(proxy, proxy));
                patch(null, subTree, container, instance);
                vnode.el = subTree.el;
                instance.isMounted = true;
            }
        });
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

class ComputedRefImpl {
    constructor(getter) {
        // 是否需要更新
        this._dirty = true;
        this._getter = getter;
        // 维护 ReactiveEffect 实例
        this._effect = new ReactiveEffect(getter, {
            scheduler: () => {
                this._dirty = true;
            },
        });
    }
    get value() {
        if (this._dirty) {
            this._value = this._effect.run();
            this._dirty = false;
        }
        return this._value;
    }
}
function computed(getter) {
    return new ComputedRefImpl(getter);
}

function createElement(type) {
    return document.createElement(type);
}
const isOn = (key) => /^on[A-Z]/.test(key);
function patchProp(el, prop, val, oldVal) {
    if (isOn(prop)) {
        const event = prop.slice(2).toLowerCase();
        el.addEventListener(event, val);
    }
    else {
        if (val === undefined || null) {
            el.removeAttribute(prop);
        }
        else {
            el.setAttribute(prop, val);
        }
    }
}
function insert(el, parent) {
    parent.appendChild(el);
}
function selector(container) {
    return document.querySelector(container);
}
function remove(child) {
    const parentElement = child.parentNode;
    if (parentElement) {
        parentElement.removeChild(child);
    }
}
function setElementText(el, text) {
    el.textContent = text;
}
const renderer = createRenderer({
    createElement,
    patchProp,
    insert,
    selector,
    remove,
    setElementText,
});
const createApp = (...args) => {
    return renderer.createApp(...args);
};

exports.computed = computed;
exports.createApp = createApp;
exports.createElement = createElement;
exports.createRenderer = createRenderer;
exports.createTextVNode = createTextVNode;
exports.effect = effect;
exports.getCurrentInstance = getCurrentInstance;
exports.h = h;
exports.inject = inject;
exports.insert = insert;
exports.patchProp = patchProp;
exports.provide = provide;
exports.reactive = reactive;
exports.ref = ref;
exports.remove = remove;
exports.renderSlots = renderSlots;
exports.selector = selector;
exports.setElementText = setElementText;

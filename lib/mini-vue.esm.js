function toDisplayString(str) {
    return String(str);
}

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
function isString(val) {
    return typeof val === "string";
}
function isArray(val) {
    return Array.isArray(val);
}

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
    // 有 compiler 没提供 render
    if (!component.render && compiler) {
        if (component.template) {
            // 将 template 编译成 render
            component.render = compiler(component.template);
        }
    }
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
let compiler;
function registerCompiler(_compiler) {
    compiler = _compiler;
}

function createVNode(type, props, children) {
    const vnode = {
        type,
        props,
        children,
        el: null,
        // 初始化 component
        component: null,
        // 初始化 key
        key: props ? props.key : null,
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

const queue = [];
let isFlushPending = false;
let p = Promise.resolve();
function nextTick(fn) {
    return fn ? p.then(fn) : p;
}
function queueJobs(job) {
    if (!queue.includes(job)) {
        queue.push(job);
    }
    queueFlush();
}
function queueFlush() {
    if (isFlushPending) {
        return;
    }
    isFlushPending = true;
    nextTick(flushJobs);
}
function flushJobs() {
    isFlushPending = false;
    let job;
    while ((job = queue.shift())) {
        job && job();
    }
}

function createRenderer(options) {
    const { createElement, insert, patchProp, selector, setElementText, remove } = options;
    function render(vnode, container, parent) {
        // 递归处理子节点
        patch(null, vnode, container, parent, null);
    }
    function patch(n1, n2, container, parent, anchor) {
        const { shapeFlags, type } = n2;
        switch (type) {
            case Fragment:
                processFragment(n2, container, parent, anchor);
                break;
            case TextNode:
                processTextNode(n2, container);
                break;
            default:
                if (shapeFlags & 1 /* ShapeFlags.ELEMENT */) {
                    processElement(n1, n2, container, parent, anchor);
                }
                else if (shapeFlags & 2 /* ShapeFlags.STATEFUL_COMPONENT */) {
                    processComponent(n1, n2, container, parent, anchor);
                }
                break;
        }
    }
    function processFragment(n2, container, parent, anchor) {
        // 因为 fragment 就是用来处理 children 的
        mountChildren(n2.children, container, parent, anchor);
    }
    function processTextNode(vnode, container) {
        const element = (vnode.el = document.createTextNode(vnode.children));
        container.appendChild(element);
    }
    function shouldUpdateComponent(prevVNode, nextVNode) {
        const { props: prevProps } = prevVNode;
        const { props: nextProps } = nextVNode;
        for (const key in nextProps) {
            if (nextProps[key] !== prevProps[key]) {
                return true;
            }
        }
        return false;
    }
    function processComponent(n1, n2, container, parent, anchor) {
        if (n1) {
            // 更新
            updateComponent(n1, n2);
        }
        else {
            // init
            mountComponent(n2, container, parent, anchor);
        }
    }
    function updateComponent(n1, n2) {
        const instance = (n2.component = n1.component);
        if (shouldUpdateComponent(n1, n2)) {
            instance.next = n2;
            instance.update();
        }
        else {
            n2.el = n1.el;
            instance.vnode = n2;
        }
    }
    function processElement(n1, n2, container, parent, anchor) {
        // 分为 init 和 update 两种，这里先写 init
        if (n1) {
            // update 逻辑
            patchElement(n1, n2, parent, anchor);
        }
        else {
            // init 逻辑
            mountElement(n2, container, parent, anchor);
        }
    }
    function patchElement(n1, n2, parent, anchor) {
        console.log("更新");
        const oldProps = n1.props || EMPTY_OBJ;
        const newProps = n2.props || EMPTY_OBJ;
        // 这里需要传递 el，我们需要考虑一点，到这一层的时候
        // n2.el 是 undefined，所以我们需要把 n1.el 赋给 n2.el
        // 这是因为在下次 patch 的时候 n2 === n1, 此刻的新节点变成旧节点，el 就生效了
        const el = (n2.el = n1.el);
        patchProps(el, oldProps, newProps);
        patchChildren(n1, n2, el, parent, anchor);
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
    function patchChildren(n1, n2, container, parent, anchor) {
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
                mountChildren(c2, container, parent, anchor);
            }
            else {
                // 对比 array => array
                patchKeyChildren(c1, c2, container, parent, anchor);
            }
        }
    }
    function unmountChildren(children) {
        for (let index = 0; index < children.length; index++) {
            const child = children[index];
            remove(child.el);
        }
    }
    function patchKeyChildren(c1, c2, container, parent, anchor) {
        let l2 = c2.length;
        // 声明3个指针，e1 老节点最后一个 e2 新节点最后一个 i 当前对比元素
        let e1 = c1.length - 1;
        let e2 = l2 - 1;
        let i = 0;
        // 暂时通过 type 和 key 判断
        function isSameVNode(n1, n2) {
            return n1.type === n2.type && n1.key === n2.key;
        }
        // 新旧节点头部开始
        while (i <= e1 && i <= e2) {
            if (isSameVNode(c1[i], c2[i])) {
                patch(c1[i], c2[i], container, parent, anchor);
            }
            else {
                break;
            }
            i += 1;
        }
        // 比较尾部
        while (i <= e1 && i <= e2) {
            // 如果当前对比 vnode 相同 进入 patch
            if (isSameVNode(c1[e1], c2[e2])) {
                patch(c1[e1], c2[e2], container, parent, anchor);
            }
            else {
                break;
            }
            e1 -= 1;
            e2 -= 1;
        }
        console.log(i, e1, e2);
        // 新节点比旧节点长，添加新节点 - 尾部
        if (i > e1) {
            if (i <= e2) {
                const nextPos = e2 + 1;
                const anchor = nextPos < l2 ? c2[nextPos].el : null;
                while (i <= e2) {
                    patch(null, c2[i], container, parent, anchor);
                    i += 1;
                }
            }
        }
        else if (i > e2) {
            // 新节点比旧节点短 删除
            while (i <= e1) {
                remove(c1[i].el);
                i += 1;
            }
        }
        else {
            // 中间对比
            let s1 = i;
            let s2 = i;
            // 记录需要 patch 的节点，当前新节点的混乱部分个数
            const toBePatched = e2 - s2 + 1;
            // 当前 patch 的个数
            let patched = 0;
            // 混乱部分映射
            const keyToNewIndexMap = new Map();
            // 混乱元素的索引
            const newIndexToOldIndexMap = new Array(toBePatched);
            // 应该移动
            let shouldMove = false;
            // 目前最大索引
            let maxNewIndexSoFar = 0;
            for (let i = 0; i < toBePatched; i++) {
                newIndexToOldIndexMap[i] = 0;
            }
            // 添加映射
            for (let i = s2; i <= e2; i++) {
                const newChild = c2[i];
                keyToNewIndexMap.set(newChild.key, i);
            }
            // 循环老的，查找
            for (let i = s1; i <= e1; i++) {
                const prevChild = c1[i];
                if (patched >= toBePatched) {
                    remove(prevChild.el);
                    continue;
                }
                let newIndex;
                // 当前老的节点 key 不是空
                if (prevChild.key !== null) {
                    // 找新对应的
                    newIndex = keyToNewIndexMap.get(prevChild.key);
                }
                else {
                    // 老节点 key 为空，再次遍历新节点，找与当前老节点相同的 vnode
                    for (let j = s2; j <= e2; j++) {
                        if (isSameVNode(prevChild, c2[j])) {
                            newIndex = j;
                            break;
                        }
                    }
                }
                // 新节点不存在对应的老节点 删除
                if (newIndex === undefined) {
                    remove(prevChild.el);
                }
                else {
                    // 当前索引 >= 记录的最大索引
                    if (newIndex >= maxNewIndexSoFar) {
                        maxNewIndexSoFar = newIndex;
                    }
                    else {
                        // 不是一直递增，需移动
                        shouldMove = true;
                    }
                    newIndexToOldIndexMap[newIndex - s2] = i + 1;
                    // 继续 patch
                    patch(prevChild, c2[newIndex], container, parent, null);
                    patched += 1;
                }
            }
            // 获取最长递增子序列索引
            const increasingNewIndexSquence = shouldMove
                ? getSequence(newIndexToOldIndexMap)
                : [];
            // i 指向获取的最长递增子序列的索引
            // j 新节点
            // 倒序
            let j = increasingNewIndexSquence.length - 1;
            for (let i = toBePatched - 1; i >= 0; i--) {
                // 获取索引
                const nextIndex = i + s2;
                // 获取需要插入的元素
                const nextChild = c2[nextIndex];
                // 获取锚点
                const anchor = nextIndex + 1 < l2 ? c2[nextIndex + 1].el : null;
                // 如果某项是0，证明在旧节点中不存在，需创建
                if (newIndexToOldIndexMap[i] === 0) {
                    console.log("创建");
                    patch(null, nextChild, container, parent, anchor);
                }
                else if (shouldMove) {
                    if (j <= 0 || i !== increasingNewIndexSquence[j]) {
                        console.log("移动");
                        insert(nextChild.el, container, anchor);
                    }
                    else {
                        j -= 1;
                    }
                }
            }
        }
    }
    // vnode -> domEl
    function mountElement(n2, container, parent, anchor) {
        const { type: domElType, props, children, shapeFlags } = n2;
        const domEl = (n2.el = createElement(domElType));
        for (const prop in props) {
            patchProp(domEl, prop, props[prop]);
        }
        if (shapeFlags & 4 /* ShapeFlags.TEXT_CHILDREN */) {
            domEl.textContent = children;
        }
        else if (shapeFlags & 8 /* ShapeFlags.ARRAY_CHILDREN */) {
            mountChildren(n2.children, domEl, parent, anchor);
        }
        insert(domEl, container, anchor);
    }
    function mountChildren(children, container, parent, anchor) {
        children.forEach((child) => {
            // 如果 children 是一个 array，就递归 patch
            patch(null, child, container, parent, anchor);
        });
    }
    function mountComponent(n2, container, parent, anchor) {
        // 通过 vnode 获取组件实例
        const instance = (n2.component = createComponentInstance(n2, parent));
        setupComponent(instance);
        setupRenderEffect(instance, n2, container, anchor);
    }
    function updateComponentRenderer(instance, nextVNode) {
        instance.vnode = nextVNode;
        instance.props = nextVNode.props;
        nextVNode = null;
    }
    function setupRenderEffect(instance, vnode, container, anchor) {
        instance.update = effect(() => {
            const { setupState, proxy, next, vnode } = instance;
            // 根据 instance.isMounted 状态判断
            if (instance.isMounted) {
                if (next) {
                    // 更新组件 el props
                    next.el = vnode.el;
                    updateComponentRenderer(instance, next);
                }
                // update
                const subTree = instance.render.call(proxy, proxy);
                vnode.el = subTree.el;
                // 获取上一个 subTree
                const preSubTree = instance.subTree;
                instance.subTree = subTree;
                console.log({ subTree, preSubTree });
                patch(preSubTree, subTree, container, instance, anchor);
            }
            else {
                // init 逻辑
                const subTree = (instance.subTree = instance.render.call(proxy, proxy));
                patch(null, subTree, container, instance, anchor);
                vnode.el = subTree.el;
                instance.isMounted = true;
            }
        }, {
            scheduler() {
                queueJobs(instance.update);
            },
        });
    }
    return {
        createApp: createAppAPI(render, selector),
    };
}
function getSequence(arr) {
    // 浅拷贝
    const _arr = arr.slice();
    const len = _arr.length;
    // 存储最长递增子序列对应 arr 的下标
    const result = [0];
    for (let i = 0; i < len; i++) {
        const val = _arr[i];
        if (val !== 0) {
            // 获取当前 result 最大值下标
            const j = result[result.length - 1];
            // 如果 当前 val 大于 当前递增子序列的最大值 直接添加
            if (arr[j] < val) {
                // 保存上一次递增子序列最后一个值的索引
                _arr[i] = j;
                result.push(i);
                continue;
            }
            // 二分法
            let left = 0;
            let right = result.length - 1;
            while (left < right) {
                const mid = Math.floor((left + right) / 2);
                if (arr[result[mid]] < val) {
                    left = mid + 1;
                }
                else {
                    right = mid;
                }
            }
            // 当前递增子序列按顺序找到第一个大于 val 的值
            if (val < arr[result[left]]) {
                if (left > 0) {
                    // 保存上一次递增子序列最后一个值的索引
                    _arr[i] = result[left - 1];
                }
                result[left] = i;
            }
        }
        let len2 = result.length;
        let idx = result[len2 - 1];
        while (len2-- > 0) {
            result[len2] = idx;
            idx = _arr[idx];
        }
    }
    return result;
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
function insert(el, parent, anchor) {
    // parent.appendChild(el);
    parent.insertBefore(el, anchor || null);
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

var runtimeDom = /*#__PURE__*/Object.freeze({
    __proto__: null,
    createElement: createElement,
    patchProp: patchProp,
    insert: insert,
    selector: selector,
    remove: remove,
    setElementText: setElementText,
    createApp: createApp,
    createRenderer: createRenderer,
    h: h,
    renderSlots: renderSlots,
    createTextVNode: createTextVNode,
    createElementVNode: createVNode,
    getCurrentInstance: getCurrentInstance,
    registerCompiler: registerCompiler,
    provide: provide,
    inject: inject,
    nextTick: nextTick,
    toDisplayString: toDisplayString,
    ref: ref,
    reactive: reactive,
    computed: computed,
    effect: effect
});

const TO_DISPLAY_STRING = Symbol("toDisplayString");
const CREATE_ELEMENT_VNODE = Symbol("createElementVNode");
const HelperNameMapping = {
    [TO_DISPLAY_STRING]: "toDisplayString",
    [CREATE_ELEMENT_VNODE]: "createElementVNode",
};

function codegen(ast) {
    const context = createCodegenContent();
    const { push } = context;
    // 处理 code 头部
    if (ast.helpers.length) {
        genFunctionPreamble(ast, context);
    }
    const funcName = "render";
    push(`return `);
    const args = ["_ctx", "_cache"];
    const signature = args.join(", ");
    push(`function ${funcName}(${signature}) { `);
    push(`return `);
    genNode(ast.codegenNode, context);
    push(` }`);
    return context.code;
}
function genNode(node, context) {
    switch (node.type) {
        case 3 /* NodeType.TEXT */:
            genText(node, context);
            break;
        case 0 /* NodeType.INTERPOLATION */:
            genInterpolation(node, context);
            break;
        case 1 /* NodeType.SIMPLE_EXPRESSION */:
            genExpression(node, context);
            break;
        case 2 /* NodeType.ELEMENT */:
            genElement(node, context);
            break;
        case 5 /* NodeType.COMPOUND_EXPRESSION */:
            genCompoundExpression(node, context);
            break;
    }
}
function genCompoundExpression(node, context) {
    const { children } = node;
    const { push } = context;
    for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (isString(child)) {
            push(child);
        }
        else {
            genNode(child, context);
        }
    }
}
function createCodegenContent() {
    const context = {
        code: "",
        push(source) {
            context.code += source;
        },
        newLine() {
            context.code += "\n";
        },
        helper(name) {
            return `_${HelperNameMapping[name]}`;
        },
    };
    return context;
}
function genFunctionPreamble(ast, context) {
    const VueBinding = "Vue";
    const { push, newLine } = context;
    const aliasHelper = (s) => `${HelperNameMapping[s]}: _${HelperNameMapping[s]}`;
    push(`const { ${ast.helpers.map(aliasHelper).join(", ")} } = ${VueBinding}`);
    newLine();
}
function genText(node, context) {
    const { push } = context;
    push(`'${node.content}'`);
}
function genInterpolation(node, context) {
    const { push } = context;
    push(`${context.helper(TO_DISPLAY_STRING)}(`);
    genNode(node.content, context);
    push(`)`);
}
function genExpression(node, context) {
    const { push } = context;
    push(`${node.content}`);
}
function genElement(node, context) {
    const { push, helper } = context;
    const { tag, props } = node;
    push(`${helper(CREATE_ELEMENT_VNODE)}(`);
    // 处理 children
    const { children } = node;
    genNodeList(genNullable([tag, props, children]), context);
    push(")");
}
function genNodeList(nodes, context) {
    const { push } = context;
    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (isString(node)) {
            push(node);
        }
        else if (isArray(node)) {
            for (let j = 0; j < node.length; j++) {
                const n = node[j];
                genNode(n, context);
            }
        }
        else {
            genNode(node, context);
        }
        if (i < nodes.length - 1) {
            push(", ");
        }
    }
}
function genNullable(args) {
    return args.map((arg) => arg || "null");
}

function baseParse(content) {
    const context = createContext(content);
    return createRoot(parseChildren(context, []));
}
// 创建上下文
function createContext(content) {
    return {
        source: content,
    };
}
// 创建 ast 根节点
function createRoot(children) {
    return {
        children,
        type: 4 /* NodeType.ROOT */,
    };
}
// 结束条件 1. 遇到结束标签  2. context.source 没值了
function isEnd(context, ancestors) {
    const s = context.source;
    if (s.startsWith("</")) {
        for (let i = ancestors.length - 1; i >= 0; i--) {
            const tag = ancestors[i].tag;
            if (startsWidthEndTagOpen(context.source, tag)) {
                return true;
            }
        }
    }
    return !s;
}
function startsWidthEndTagOpen(source, tag) {
    const endTokenLength = "</".length;
    return source.slice(endTokenLength, tag.length + endTokenLength) === tag;
}
// 创建 children
function parseChildren(context, ancestors) {
    const nodes = [];
    while (!isEnd(context, ancestors)) {
        let node;
        const s = context.source;
        if (s.startsWith("{{")) {
            node = parseInterpolation(context);
        }
        else if (s.startsWith("<") && /[a-z]/i.test(s[1])) {
            // 第一位是 < 并且第二位是 a-z
            node = parseElement(context, ancestors);
        }
        // 如果上面两种无法解析，就是普通的 text 节点
        if (!node) {
            node = parseText(context);
        }
        nodes.push(node);
    }
    return nodes;
}
function parseText(context) {
    // 获取 content
    // 如果 context.source 包含 {{ ，就以 {{ 作为结束点
    const s = context.source;
    const endTokens = ["<", "{{"];
    let endIndex = s.length;
    for (let i = 0; i < endTokens.length; i++) {
        const index = s.indexOf(endTokens[i]);
        if (index !== -1 && endIndex > index) {
            endIndex = index;
        }
    }
    const content = parseTextData(context, endIndex);
    advanceBy(context, content.length);
    return {
        type: 3 /* NodeType.TEXT */,
        content,
    };
}
//
function parseElement(context, ancestors) {
    const element = parseTag(context, 0 /* TagType.START */);
    ancestors.push(element);
    element.children = parseChildren(context, ancestors);
    ancestors.pop();
    if (startsWidthEndTagOpen(context.source, element.tag)) {
        parseTag(context, 1 /* TagType.END */);
    }
    else {
        throw new Error(`不存在结束标签: ${element.tag}`);
    }
    return element;
}
//
function parseTag(context, type) {
    console.log(context);
    const match = /^<\/?([a-z]*)/i.exec(context.source);
    const tag = match[1];
    advanceBy(context, match[0].length + 1);
    if (type === 1 /* TagType.END */) {
        return;
    }
    return {
        type: 2 /* NodeType.ELEMENT */,
        tag,
    };
}
// 解析插值表达式 {{message}}
function parseInterpolation(context) {
    const openDelimiter = "{{";
    const closeDelimiter = "}}";
    // 将字符串截取
    const closeIndex = context.source.indexOf(closeDelimiter, openDelimiter.length);
    // 将字符串前面的 {{ 舍弃
    advanceBy(context, openDelimiter.length);
    // 获取 {{}} 中间值的长度
    const rawContentLength = closeIndex - closeDelimiter.length;
    // 获取
    const rawContent = parseTextData(context, rawContentLength);
    const content = rawContent.trim();
    advanceBy(context, rawContentLength + closeDelimiter.length);
    return {
        type: 0 /* NodeType.INTERPOLATION */,
        content: {
            type: 1 /* NodeType.SIMPLE_EXPRESSION */,
            content: content,
        },
    };
}
function advanceBy(context, length) {
    context.source = context.source.slice(length);
}
function parseTextData(context, length) {
    return context.source.slice(0, length);
}

function transform(root, options = {}) {
    // 创建 transform 上下文
    const context = createTransformContext(root, options);
    traverseNode(root, context);
    createRootCodegen(root);
    // 根节点挂载 helpers
    root.helpers = [...context.helpers.keys()];
}
function traverseNode(node, context) {
    const { nodeTransforms } = context;
    const exitFns = [];
    for (let i = 0; i < nodeTransforms.length; i++) {
        const transform = nodeTransforms[i];
        const exitFn = transform(node, context);
        if (exitFn) {
            exitFns.push(exitFn);
        }
    }
    // 遍历树根据不同 node 的类型存入不同的 helper
    switch (node.type) {
        case 0 /* NodeType.INTERPOLATION */:
            context.helper(TO_DISPLAY_STRING);
            break;
        case 4 /* NodeType.ROOT */:
        case 2 /* NodeType.ELEMENT */:
            // ROOT 和 ELEMENT 存在children
            traverseChildren(node, context);
            break;
    }
    let i = exitFns.length;
    while (i--) {
        exitFns[i]();
    }
}
function traverseChildren(node, context) {
    const children = node.children;
    if (children) {
        for (let i = 0; i < children.length; i++) {
            traverseNode(children[i], context);
        }
    }
}
function createTransformContext(root, options) {
    const context = {
        root,
        nodeTransforms: options.nodeTransforms || {},
        helpers: new Map(),
        helper(name) {
            context.helpers.set(name, 1);
        },
    };
    return context;
}
function createRootCodegen(root) {
    const child = root.children[0];
    if (child.type === 2 /* NodeType.ELEMENT */) {
        root.codegenNode = child.codegenNode;
    }
    else {
        root.codegenNode = root.children[0];
    }
}

function createVNodeCall(context, tag, props, children) {
    context.helper(CREATE_ELEMENT_VNODE);
    return {
        type: 2 /* NodeType.ELEMENT */,
        tag,
        props,
        children,
    };
}

function transformElement(node, context) {
    if (node.type === 2 /* NodeType.ELEMENT */) {
        return () => {
            // 处理 props 和 tag
            const vnodeTag = `'${node.tag}'`;
            const vnodeProps = node.props;
            const { children } = node;
            const vnodeChildren = children;
            node.codegenNode = createVNodeCall(context, vnodeTag, vnodeProps, vnodeChildren);
        };
    }
}

function transformExpression(node) {
    if (node.type === 0 /* NodeType.INTERPOLATION */) {
        node.content = processExpression(node.content);
    }
}
function processExpression(node) {
    node.content = `_ctx.${node.content}`;
    return node;
}

function transformText(node) {
    return () => {
        const { children } = node;
        if (children && children.length) {
            let currentContainer;
            for (let i = 0; i < children.length; i++) {
                const child = children[i];
                if (isText(child)) {
                    for (let j = i + 1; j < children.length; j++) {
                        const next = children[j];
                        if (isText(next)) {
                            // 相邻的是 text 或者 interpolation 就变成联合类型
                            if (!currentContainer) {
                                currentContainer = children[i] = {
                                    type: 5 /* NodeType.COMPOUND_EXPRESSION */,
                                    children: [child],
                                };
                            }
                            // 每个相邻的下一个之前加上 +
                            currentContainer.children.push(" + ");
                            currentContainer.children.push(next);
                            // 删除
                            children.splice(j, 1);
                            // 修正索引
                            j -= 1;
                        }
                        else {
                            currentContainer = undefined;
                            break;
                        }
                    }
                }
            }
        }
    };
}
function isText(node) {
    return node.type === 3 /* NodeType.TEXT */ || node.type === 0 /* NodeType.INTERPOLATION */;
}

function baseCompile(template) {
    const ast = baseParse(template);
    transform(ast, {
        nodeTransforms: [transformExpression, transformElement, transformText],
    });
    const code = codegen(ast);
    return {
        code,
    };
}

// export * from "./runtime-core";
function compileToFunction(template) {
    const { code } = baseCompile(template);
    const render = new Function("Vue", code)(runtimeDom);
    return render;
}
registerCompiler(compileToFunction);

export { baseCompile, computed, createApp, createElement, createVNode as createElementVNode, createRenderer, createTextVNode, effect, getCurrentInstance, h, inject, insert, nextTick, patchProp, provide, reactive, ref, registerCompiler, remove, renderSlots, selector, setElementText, toDisplayString };

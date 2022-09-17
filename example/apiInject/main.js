import {
  createApp,
  h,
  provide,
  inject
} from "../../lib/mini-vue.esm.js";

const Provider = {
  render() {
    return h('div', {}, [h('div', {}, 'Provider'), h(Provider2)])
  },
  setup() {
    provide('foo', 'foo')
  },
}

const Provider2 = {
  render() {
    return h('div', {}, [h('div', {}, 'Provider2'), h(Consumer)])
  },
  setup() {},
}

const Consumer = {
  render() {
    return h('div', {}, 'Consumer: ' + `inject foo: ${this.foo}`)
  },
  setup() {
    return {
      foo: inject('foo'),
    }
  },
}

createApp(Provider).mount('#app')
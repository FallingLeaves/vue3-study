import {
  h,
  renderSlots,
  getCurrentInstance
} from "../../lib/mini-vue.esm.js";

export const Foo = {
  setup() {
    console.log('instance', getCurrentInstance());
  },
  render() {
    const foo = h('p', {}, 'foo')
    // 我们可以在这里通过 `this.$slots` 进行接收到挂载的 $slots
    return h('div', {}, [renderSlots(this.$slots, 'header', {
      count: 1
    }), foo, renderSlots(this.$slots, 'footer')])
  },
}
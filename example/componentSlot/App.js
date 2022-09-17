import {
  h,
  renderSlots,
  createTextVNode,
  getCurrentInstance
} from "../../lib/mini-vue.esm.js";

import {
  Foo
} from "./Foo.js";

export default {
  render() {
    return h('div', {}, [
      // 可以传递一个数组
      h(Foo, {}, {
        header: ({
          count
        }) => h('div', {}, 'count: ' + count),
        footer: () => createTextVNode('hello TextNode')
      }),
    ])
  },
  setup() {
    console.log('instance', getCurrentInstance());
  },
}
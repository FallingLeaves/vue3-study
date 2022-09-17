import {
  h,
  renderSlots
} from '../../lib/mini-vue.esm.js'

import {
  Foo
} from "./foo.js";

export default {
  render() {
    return h(
      'div', {
        class: 'red',
        // onClick() {
        //   console.log('click');
        // },
        // onMousedown() {
        //   console.log('mousedown');
        // }
      },
      [
        // 挂载组件
        h(Foo, {
          count: 1,
          onAddCount: this.onAdd
        }),
      ])
  },
  setup() {
    const onAdd = (params) => {
      console.log('onAdd', params);
    }
    return {
      title: 'mini-vue',
      onAdd
    }
  },
}
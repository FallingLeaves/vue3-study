import {
  h,
  ref,
  getCurrentInstance,
  nextTick
} from "../../lib/mini-vue.esm.js";

export default {
  setup() {
    const count = ref(1)
    const instance = getCurrentInstance()

    function onClick() {
      for (let index = 0; index < 10; index++) {
        count.value = index
        // console.log('update');
      }
      console.log(instance);
      nextTick(() => {
        console.log(instance);
      })
    }

    return {
      onClick,
      count
    }
  },
  render() {
    const button = h('button', {
      onClick: this.onClick
    }, 'update')
    const p = h('p', {}, 'count: ' + this.count)
    return h('div', {}, [button, p])
  }
}
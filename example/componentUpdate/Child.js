import {
  h
} from "../../lib/mini-vue.esm.js";

export default {
  setup() {
    return {}
  },
  render(props) {
    console.log(props);
    return h('div', {}, [
      h('div', {}, 'child - props - msg: ' + this.$props.msg)
    ])
  }
}
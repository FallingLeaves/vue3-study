import {
  h
} from "../../lib/mini-vue.esm.js";
import ArrayToText from "./ArrayToText.js"
import TextToNewText from './TextToNewText.js'
import TextToArray from './TextToArray.js'
import ArrayToArray from './ArrayToArray.js'

export default {
  setup() {},
  render() {
    return h('div', {}, [
      h('div', {}, 'main page'),
      // h(ArrayToText),
      // h(TextToNewText),
      h(ArrayToArray),
    ])
  }
}
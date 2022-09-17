import {
  h,
  renderSlots
} from '../../lib/mini-vue.esm.js'

export const Foo = {
  setup(props, {
    emit
  }) {
    console.log(props);
    props.count++
    console.log(props);

    const handleClick = () => {
      emit('add-count', 2)
    }

    return {
      handleClick
    }
  },
  render() {
    return h('div', {
      class: 'blue',
      onClick: this.handleClick
    }, 'couner: ' + this.count)
  }
}
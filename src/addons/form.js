import { createClass, createElement, PropTypes } from 'react'
import serialize from 'form-serialize'
import { Action, merge } from '../microcosm'

const Form = createClass({

  contextTypes: {
    send : PropTypes.func.isRequired
  },

  propTypes: {
    intent     : PropTypes.oneOfType([ PropTypes.string, PropTypes.func]),
    serializer : PropTypes.func,
    prepare    : PropTypes.func,
    onSubmit   : PropTypes.func,
    onDone     : PropTypes.func,
    onUpdate   : PropTypes.func,
    onError    : PropTypes.func,
    onCancel   : PropTypes.func
  },

  getDefaultProps() {
    return {
      intent     : null,
      serializer : form => serialize(form, { hash: true, empty: true }),
      prepare  : n => n,
      onSubmit   : () => {}
    }
  },

  render() {
    const props = merge({}, this.props, { ref: 'form', onSubmit: this.onSubmit })

    // Remove invalid props to prevent React warnings
    delete props.intent
    delete props.prepare
    delete props.serializer
    delete props.onDone
    delete props.onUpdate
    delete props.onCancel
    delete props.onError

    return createElement('form', props)
  },

  onSubmit(event) {
    event.preventDefault()
    this.submit(event)
  },

  submit(event) {
    const form   = this.refs.form
    const params = this.props.prepare(this.props.serializer(form))
    const action = this.context.send(this.props.intent, params)

    if (action && action instanceof Action) {
      action.onDone(this.props.onDone)
            .onUpdate(this.props.onUpdate)
            .onCancel(this.props.onCancel)
            .onError(this.props.onError)
    }

    this.props.onSubmit(event, action)
  }

})

export default Form

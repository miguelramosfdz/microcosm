import Emitter from './emitter'
import States, {getType} from './action/states'
import coroutine from './action/coroutine'
import merge from './merge'
import tag from './tag'

/**
 * Actions encapsulate the course of resolving an action creator
 * (internally called behaviors). For most purposes, they should never
 * be created on their own. Use `push()` within a Microcosm instance
 * so that it can be tracked within its internal state.
 *
 * @extends {Emitter}
 */
export default function Action (behavior, history) {
  console.assert(typeof behavior === 'string' || typeof behavior === 'function',
                 'Action expected string or function, instead got: %s', behavior)

  this.type = null
  this.behavior = tag(behavior)
  this.state = States.disabled
  this.payload = null

  this.history = history
  this.parent = null
  this.sibling = null
}

merge(Action.prototype, Emitter.prototype, {

  /**
   * Given a string or State constant, determine if the `state` bitmask for
   * the action includes the provided type.
   *
   * @private
   * @param {String|Number} type - Either a string key or numeric type
   * @return {Boolean} does the action match the given types?
   */
  is (type) {
    let code = States[type]

    return (this.state & code) === code
  },

  /**
   * Evaluate the action by invoking the action's behavior with
   * provided parameters. Then pass that value into the `coroutine`
   * function, which will update the state of the action as it
   * processes.
   *
   * @private
   * @return {Action} self
   */
  execute (params) {
    coroutine(this, this.behavior.apply(this, params))

    return this
  },

  /**
   * Trigger history reconciliation if associated with a history
   * @private
   */
  reconcile() {
    if (this.history) {
      this.history.reconcile(this)
    }

    return this
  },

  /**
   * If defined, sets the payload for the action and triggers a
   * "change" event.
   *
   * @api private
   * @return {Action} self
   */
  set (state, payload) {
    // Ignore set if the action is already disposable. Rejected
    // actions can't be resolved. Resolved actions can't be
    // cancelled...
    if (this.is('disposable')) {
      return this
    }

    this.state = state
    this.type = getType(this)

    if (payload != undefined) {
      this.payload = payload
    }

    return this.reconcile()
  },

  /**
   * Set the action state to "open", then set a payload if
   * provided. Triggers the "open" event.
   * @return {Action} self
   */
  open (payload) {
    this.set(States.open, payload)

    this._emit('open', this.payload)

    return this
  },

  /**
   * Set the action state to "loading", then set a payload if
   * provided. Triggers the "update" event.
   * @return {Action} self
   */
  send (payload) {
    this.set(States.loading, payload)

    this._emit('update', payload)

    return this
  },

  /**
   * Set the action state to "error" and marks the action for clean
   * up, then set a payload if provided. Triggers the "error" event.
   * @return {Action} self
   */
  reject (payload) {
    this.set(States.error | States.disposable, payload)

    this._emit('error', payload)

    return this
  },

  /**
   * Set the action state to "done" and marks the action for clean
   * up, then set a payload if provided. Triggers the "done" event.
   * @return {Action} self
   */
  resolve (payload) {
    this.set(States.done | States.disposable, payload)

    this._emit('done', this.payload)

    return this
  },

  /**
   * Set the action state to "cancelled" and marks the action for clean
   * up, then set a payload if provided. Triggers the "cancel" event.
   *
   * @return {Action} self
   */
  cancel () {
    this.set(States.cancelled | States.disposable, null)

    this._emit('cancel', this.payload)

    return this
  },

  /**
   * Toggles the disabled state, where the action will not
   * dispatch. This is useful in the Microcosm debugger to quickly
   * enable/disable actions. Triggers the "change" event.
   * @private
   */
  toggle () {
    this.state ^= States.disabled
    this.type = getType(this)

    return this.reconcile()
  },

  /**
   * Listen to failure. If the action has already failed, it will
   * execute the provided callback, otherwise it will wait and trigger
   * upon the "error" event.
   *
   * @param {Function} callback
   * @param {any} scope
   * @return {Action} self
   */
  onError (callback, scope) {
    if (typeof callback !== 'function') {
      return this
    }

    if (this.is('error')) {
      callback.call(scope, this.payload)
    } else {
      this.once('error', callback, scope)
    }

    return this
  },

  /**
   * Listen to progress. Wait and trigger a provided callback on the "update" event.
   *
   * @param {Function} callback
   * @param {any} scope
   * @return {Action} self
   */
  onUpdate (callback, scope) {
    if (typeof callback !== 'function') {
      return this
    }

    this.on('update', callback, scope)

    return this
  },

  /**
   * Listen for completion. If the action has already completed, it will
   * execute the provided callback, otherwise it will wait and trigger
   * upon the "done" event.
   *
   * @param {Function} callback
   * @param {any} scope
   * @return {Action} self
   */
  onDone (callback, scope) {
    if (typeof callback !== 'function') {
      return this
    }

    if (this.is('done')) {
      callback.call(scope, this.payload)
    } else {
      this.once('done', callback, scope)
    }

    return this
  },

  /**
   * Listen for cancel. If the action has already cancelled, it will
   * execute the provided callback, otherwise it will wait and trigger
   * upon the "cancel" event.
   *
   * @param {Function} callback
   * @param {any} scope
   * @return {Action} self
   */
  onCancel (callback, scope) {
    if (typeof callback !== 'function') {
      return this
    }

    if (this.is('cancelled')) {
      callback.call(scope, this.payload)
    } else {
      this.once('cancel', callback, scope)
    }

    return this
  },

  /**
   * For interop with promises. Returns a promise that
   * resolves or rejects based on the action's resolution.
   * @return {Promise}
   */
  then (pass, fail) {
    return new Promise((resolve, reject) => {
      this.onDone(resolve)
      this.onError(reject)
    }).then(pass, fail)
  },

  /**
   * Cleanup an action that has been disconnected from its history
   */
  teardown() {
    // Disconnect some pointers to help GC clean up
    this.parent = null
    this.sibling = null
    this.history = null

    if (this.next) {
      this.next.parent = null
    }

    this.next = null
  }

})

/**
 * Get all child actions, those dispatched after this one within
 * history. This is used by the Microcosm debugger to visualize
 * action history as a DAG.
 *
 * @private
 * @return {Array} children list of actions
 */
Object.defineProperty(Action.prototype, 'children', {
  get () {
    let start = this.next
    let nodes = []

    while (start) {
      nodes.push(start)
      start = start.sibling
    }

    return nodes
  }
})

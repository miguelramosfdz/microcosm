# ImmutableJS Integration

1. [Immutable Everywhere](#immutable-everywhere)
2. [Immutable in, Vanilla out](#immutable-in-vanilla-out)

## Immutable Everywhere

The most basic integration method is to simply use ImmutableJS:

```javascript
import Immutable from 'immutable'
import actions from 'actions'

const Domain = {
  getInitialState() {
    return Immutable.Map()
  },

  add(state, record) {
    return state.set(record.id, record)
  },

  remove(state, id) {
    return state.remove(id)
  },

  register() {
    return {
      [actions.create]: this.add,
      [actions.destroy]: this.remove
    }
  }
}
```

## Immutable in, Vanilla out

We've found it can be much simpler to expose vanilla JavaScript data to our
presentation layer. Unfortunately, this tends to mitigate much of the benefit
of immutable data. It also can impose serious performance penalties marshalling
between the two formats.

It is worth walking through the phases of state a Microcosm works through in order
to better understand how Microcosm accommodates this use case:

1. **archive** - For performance, Microcosm purges old actions and writes their
final result to a cache.
2. **staging** - State before a making change. This is a preparatory state allowing
domains the ability to transform data one last time before assigning it publicly.
3. **state** - Publicaly available state. This is what is exposed via `repo.state`,

Essentially, Microcosm can maintain ImmutableJS data structures internally, exposing
plain JavaScript for public consumption. There are two key methods responsible for this:

1. **commit** - A middleware function that dictates how a domain assigns to `repo.state`.
2. **shouldCommit** - A predicate function that controls invocation of `commit`.

In practice, this results in a small adjustment to the domain described earlier:

```javascript
import Immutable from 'immutable'
import actions from 'actions'

const Domain = {
  getInitialState() {
    return Immutable.Map()
  },

  shouldCommit(last, next) {
    return Immutable.is(last, next) === false
  },

  commit(next) {
    return Array.from(next.values())
  },

  add(state, record) {
    return state.set(record.id, record)
  },

  remove(state, id) {
    return state.remove(id)
  },

  register() {
    return {
      [actions.create]: this.add,
      [actions.destroy]: this.remove
    }
  }
}
```

Here we've added a `shouldCommit` that utilizes the `Immutable.is` equality check.
Additionally, `commit` describes how `Immutable` should convert into a regular form.
In this case, it will convert into an Array.

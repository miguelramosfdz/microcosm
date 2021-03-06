import React     from 'react'
import DOM       from 'react-dom'
import Debugger  from 'microcosm-debugger'
import Repo      from './repo'
import Workspace from './presenters/workspace'

const repo = new Repo({ maxHistory: Infinity })

Debugger(repo)

DOM.render(<Workspace repo={ repo } />, document.querySelector('#app'))

const manifetch = require('manifetch')

const { getCurrentInstance, reactive } = require('vue')
const { assign } = Object

const kData = Symbol.for('kData')
const kPayload = Symbol.for('kPayload')
const kStaticPayload = Symbol.for('kStaticPayload')
const kGlobal = Symbol.for('kGlobal')
const kAPI = Symbol.for('kAPI')
const kFirstRender = Symbol('kFirstRender')

const isServer = typeof window === 'undefined'
const fetch = isServer ? () => {} : window.fetch

if (!isServer) {
  let firstRender = true
  Object.defineProperty(window, kFirstRender, {
    get () {
      return firstRender
    },
    set (v) {
      firstRender = v
      return firstRender
    },
  })
}

if (!isServer) {
  window.requestIdleCallback(() => {
    window[kFirstRender] = false
  })
}

function useHydration ({ getData, getPayload } = {}) {
  const globalProps = useGlobalProperties()
  const hydration = {
    $static: globalProps.$static,
    $global: globalProps.$global,
    $data: globalProps.$data,
    $payload: globalProps.$payload,
    $payloadPath: globalProps.$payloadPath,
    $api: globalProps.$api,
  }
  globalProps.$data = undefined
  globalProps.$payload = undefined

  if (isServer) {
    return hydration
  } else {
    const state = reactive(hydration)
    if (window[kFirstRender]) {
      return state
    }
    if (getPayload || getData) {
      let promise
      if (getPayload) {
        const getPayloadFromClient = async () => {
          const response = await fetch(hydration.$payloadPath(hydration.$static))
          const json = await response.json()
          return json
        }
        state.$loading = true
        promise = getPayloadFromClient(hydration).then(($payload) => {
          state.$payload = $payload
          state.$loading = false
          return state
        })
      } else if (getData) {
        state.$loading = true
        promise = getData(hydration).then(($data) => {
          state.$data = $data
          state.$loading = false
          return state
        })
      }
      for (const key in hydration) {
        Object.defineProperty(promise, key, {
          enumerable: true,
          get: () => state[key],
          set: (value) => {
            state[key] = value
            return state[key]
          },
        })
      }
      return promise
    }
    return state
  }
}

async function hydrate (app) {
  let $payload 
  if (window[kStaticPayload]) {
    const staticPayloadResponse = await fetch(window[kStaticPayload])
    $payload = await staticPayloadResponse.json()
  } else {
    $payload = window[kPayload]
  }
  const hydration = {
    $payload,
    $payloadPath: (staticPayload) => {
      if (staticPayload) {
        let { pathname } = Object.assign({}, document.location)
        if (pathname.endsWith('/')) {
          pathname = `${pathname}index`
        }
        return `${pathname.replace('.html', '')}/index.json`
      } else {
        return `/-/payload${document.location.pathname}`
      }
    },
    $static: !!window[kStaticPayload],
    $global: window[kGlobal],
    $data: window[kData],
    $api: new Proxy({ ...window[kAPI] }, {
      get: manifetch({
        prefix: '',
        fetch: (...args) => fetch(...args),
      }),
    }),
  }
  assign(app.config.globalProperties, hydration)
  delete window[kGlobal]
  delete window[kData]
  delete window[kAPI]
  delete window[kPayload]
  delete window[kStaticPayload]
}

function useGlobalProperties () {
  return getCurrentInstance().appContext.app.config.globalProperties
}

module.exports = {
  useGlobalProperties,
  useHydration,
  hydrate,
  isServer,
}

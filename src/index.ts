import {
  VNode,
  Component,
  ConcreteComponent,
  h,
  defineComponent,
  defineAsyncComponent,
  App,
  shallowReactive
} from 'vue'
import { RouteRecord, RouteLocationNormalized } from 'vue-router'

/**
 * Find which layout the component should render.
 * If the component is not specified layout name, `default` is used.
 * Otherwise return undefined.
 */
function resolveLayoutName(matched: RouteRecord[]): string | undefined {
  const defaultName = 'default'
  const last = matched[matched.length - 1]
  if (!last) {
    return
  }

  const Component: any = last.components.default
  if (!Component) {
    return
  }

  const isAsync = typeof Component === 'function' && !Component.options
  if (isAsync) {
    return
  }

  return getLayoutName(Component) || defaultName
}

function getLayoutName(
  Component: any /* ComponentOptions | VueConstructor */
): string | undefined {
  const isCtor = typeof Component === 'function' && Component.options
  const options = isCtor ? Component.options : Component

  if (options.layout) {
    return options.layout
  } else {
    // Retrieve super component and mixins
    const mixins: any[] = (options.mixins || []).slice().reverse()
    const extend: any = options.extends || []

    return mixins.concat(extend).reduce<string | undefined>((acc, c) => {
      return acc || getLayoutName(c)
    }, undefined)
  }
}

function loadAsyncComponents(route: RouteLocationNormalized): Promise<unknown> {
  const promises: Promise<unknown>[] = []

  route.matched.forEach((record) => {
    Object.keys(record.components).forEach((key) => {
      const component: any = record.components[key]
      const isAsync = typeof component === 'function' && !component.options

      if (isAsync) {
        promises.push(
          component().then((loaded: any) => {
            const isEsModule =
              loaded.__esModule ||
              (typeof Symbol !== 'undefined' &&
                loaded[Symbol.toStringTag] === 'Module')
            record.components[key] = isEsModule ? loaded.default : loaded
          })
        )
      }
    })
  })

  return Promise.all(promises)
}

function install(app: App) {
  app.mixin({
    beforeCreate() {
      (this as any).$_routerLayout_installed = true
    },

    inject: {
      $_routerLayout_notifyRouteUpdate: {
        default: null,
      },
    },

    async beforeRouteUpdate(to, _from, next) {
      const notify: ((route: RouteLocationNormalized) => Promise<unknown>) | null = (this as any)
        .$_routerLayout_notifyRouteUpdate
      if (notify) {
        await notify(to)
      }
      next()
    },
  })
}

export function createRouterLayout(
  resolve: (layoutName: string) => Promise<Component | { default: Component }>
) {
  return defineComponent({
    name: 'RouterLayout',

    data() {
      return {
        layoutName: undefined as string | undefined,
        layouts: shallowReactive(Object.create(null) as Record<string, ConcreteComponent>),
      }
    },

    watch: {
      layoutName(name: string | undefined) {
        if (name && !this.layouts[name]) {
          this.layouts[name] = defineAsyncComponent(() => resolve(name)) as ConcreteComponent
        }
      },
    },

    provide() {
      return {
        $_routerLayout_notifyRouteUpdate: async (to: RouteLocationNormalized) => {
          await loadAsyncComponents(to)
          this.layoutName = resolveLayoutName(to.matched) || this.layoutName
        },
      }
    },

    beforeCreate() {
      if (process.env.NODE_ENV !== 'production' && !(this as any).$_routerLayout_installed) {
        console.error('[vue-router-layout] Call app.use(VueRouterLayout) before using the layout component.')
      }
    },

    async beforeRouteEnter(to, _from, next) {
      await loadAsyncComponents(to)
      next((vm: any) => {
        vm.layoutName = resolveLayoutName(to.matched) || vm.layoutName
      })
    },

    async beforeRouteUpdate(to, _from, next) {
      await loadAsyncComponents(to)
      this.layoutName = resolveLayoutName(to.matched) || this.layoutName
      next()
    },

    render(): VNode {
      const layout = this.layoutName && this.layouts[this.layoutName]
      if (!layout) {
        return h('span')
      }
      return h(layout, {
        key: this.layoutName,
      })
    },
  })
}

export default {
  install
}

declare module '@vue/runtime-core' {
  interface ComponentCustomOptions {
    layout?: string
  }
}

import Vue, { VueConstructor, VNode, ComponentOptions } from 'vue'
import { RouteRecord, Route } from 'vue-router'

type Component = ComponentOptions<any> | VueConstructor

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

function loadAsyncComponents(route: Route): Promise<unknown> {
  const promises: Promise<unknown>[] = []

  route.matched.forEach((record) => {
    Object.keys(record.components).forEach((key) => {
      const component: any = record.components[key]
      const isAsync = typeof component === 'function' && !component.options

      if (isAsync) {
        promises.push(
          component().then((loaded: any) => {
            record.components[key] = normalizeEsModuleComponent(loaded)
          })
        )
      }
    })
  })

  return Promise.all(promises)
}

function normalizeEsModuleComponent(
  comp: Component | { default: Component }
): Component {
  const c: any = comp
  const isEsModule =
    c.__esModule ||
    (typeof Symbol !== 'undefined' && c[Symbol.toStringTag] === 'Module')
  return isEsModule ? c.default : c
}

let isAppliedMixin = false

const mixinOptions: ComponentOptions<Vue> = {
  inject: {
    $_routerLayout_notifyRouteUpdate: {
      default: null,
    },
  },

  async beforeRouteUpdate(to, _from, next) {
    const notify: ((route: Route) => Promise<unknown>) | null = (this as any)
      .$_routerLayout_notifyRouteUpdate
    if (notify) {
      await notify(to)
    }
    next()
  },
}

export function createRouterLayout(
  resolve: (layoutName: string) => Promise<Component | { default: Component }>
): VueConstructor {
  if (!isAppliedMixin) {
    isAppliedMixin = true
    Vue.mixin(mixinOptions)
  }

  return Vue.extend({
    name: 'RouterLayout',

    data() {
      return {
        layoutName: undefined as string | undefined,
        layouts: Object.create(null) as Record<string, Component>,
      }
    },

    async beforeRouteEnter(to, _from, next) {
      await loadAsyncComponents(to)

      const name = resolveLayoutName(to.matched)
      const layoutComp = name
        ? normalizeEsModuleComponent(await resolve(name))
        : undefined

      next((vm: any) => {
        vm.layoutName = name
        if (name && layoutComp) {
          vm.layouts[name] = layoutComp
        }
      })
    },

    async beforeRouteUpdate(to, _from, next) {
      try {
        await loadAsyncComponents(to)

        const name = resolveLayoutName(to.matched) || this.layoutName
        if (name && !this.layouts[name]) {
          this.layouts[name] = normalizeEsModuleComponent(await resolve(name))
        }

        this.layoutName = name
        next()
      } catch (error) {
        next(error)
      }
    },

    render(h): VNode {
      const layout = this.layoutName && this.layouts[this.layoutName]
      if (!layout) {
        return h()
      }
      return h(layout, {
        key: this.layoutName,
      })
    },
  })
}

declare module 'vue/types/options' {
  interface ComponentOptions<V extends Vue> {
    layout?: string
  }
}

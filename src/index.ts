import Vue, { VueConstructor, VNode, Component, AsyncComponent } from 'vue'
import { RouteRecord } from 'vue-router'

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

export function createRouterLayout(
  resolve: (layoutName: string) => Promise<Component | { default: Component }>
): VueConstructor {
  return Vue.extend({
    name: 'RouterLayout',

    data() {
      return {
        layoutName: undefined as string | undefined,
        layouts: Object.create(null) as Record<string, AsyncComponent>
      }
    },

    watch: {
      layoutName(name) {
        if (!this.layouts[name]) {
          this.$set(this.layouts, name, () => resolve(name))
        }
      }
    },

    provide() {
      return {
        $_routerLayout_notifyUpdate: () => {
          const matched = this.$route.matched
          this.layoutName = resolveLayoutName(matched) || this.layoutName
        }
      }
    },

    beforeRouteEnter(to, _from, next) {
      next((vm: any) => {
        vm.layoutName = resolveLayoutName(to.matched) || vm.layoutName
      })
    },

    beforeRouteUpdate(to, _from, next) {
      this.layoutName = resolveLayoutName(to.matched) || this.layoutName
      next()
    },

    render(h): VNode {
      const layout = this.layoutName && this.layouts[this.layoutName]
      if (!layout) {
        return h()
      }
      return h(layout, {
        key: this.layoutName
      })
    }
  })
}

Vue.mixin({
  inject: {
    $_routerLayout_notifyUpdate: {
      default: null
    }
  },

  beforeUpdate() {
    const notify = (this as any).$_routerLayout_notifyUpdate
    if (notify) {
      notify()
    }
  }
})

declare module 'vue/types/options' {
  interface ComponentOptions<V extends Vue> {
    layout?: string
  }
}

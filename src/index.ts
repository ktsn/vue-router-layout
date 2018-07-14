import Vue, { VueConstructor, VNode, Component, AsyncComponent } from 'vue'
import { RouteRecord } from 'vue-router'

function findLayoutName(matched: RouteRecord[]): string {
  const reversed = matched.slice().reverse()

  let layoutName = 'default'
  for (const record of reversed) {
    const Component: any = record.components.default
    if (Component) {
      const name =
        typeof Component === 'function'
          ? Component.options.layout
          : Component.layout

      if (name) {
        layoutName = name
        break
      }
    }
  }

  return layoutName
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

    beforeRouteEnter(to, _from, next) {
      next((vm: any) => {
        vm.layoutName = findLayoutName(to.matched)
      })
    },

    beforeRouteUpdate(to, _from, next) {
      this.layoutName = findLayoutName(to.matched)
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

declare module 'vue/types/options' {
  interface ComponentOptions<V extends Vue> {
    layout?: string
  }
}

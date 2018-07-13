import Vue, { VueConstructor, VNode, Component, AsyncComponent } from 'vue'

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

    beforeRouteEnter(to, _from, next) {
      const reversed = to.matched.slice().reverse()

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

      next((vm: any) => {
        vm.layoutName = layoutName

        if (!vm.layouts[layoutName]) {
          vm.$set(vm.layouts, layoutName, () => resolve(layoutName))
        }
      })
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

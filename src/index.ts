import {
  VNode,
  Component,
  ConcreteComponent,
  h,
  defineComponent,
  shallowReactive,
} from 'vue'
import { RouteRecord, RouteLocationNormalized } from 'vue-router'

type Layout = { name: string; props: Record<string, unknown> }
type Optional<Object, Key extends keyof Object> = Omit<Object, Key> &
  Partial<Pick<Object, Key>>

function normalizeLayout(layout: any): Layout {
  if (typeof layout === 'string') {
    return {
      name: layout,
      props: {},
    }
  }

  if (layout && typeof layout === 'object' && 'name' in layout) {
    return {
      name: layout.name,
      props: layout?.props || {},
    }
  }

  throw new Error(
    `[vue-router-layout] Incorrect value for the 'layout' property.`
  )
}

/**
 * Find which layout the component should render.
 * If the component is not specified layout name, `default` is used.
 * Otherwise return undefined.
 */
function resolveLayout(matched: RouteRecord[]): Layout | undefined {
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

  const defaultLayout: Layout = { name: 'default', props: {} }

  return getLayout(Component) || defaultLayout
}

function getLayout(
  Component: any /* ComponentOptions | VueConstructor */
): Layout | undefined {
  const isCtor = typeof Component === 'function' && Component.options
  const options = isCtor ? Component.options : Component

  if (options.layout) {
    return normalizeLayout(options.layout)
  }

  // Retrieve super component and mixins
  const mixins: any[] = (options.mixins || []).slice().reverse()
  const extend: any = options.extends || []

  for (const c of mixins.concat(extend)) {
    const layout = getLayout(c)
    if (layout) {
      return layout
    }
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

function install() {
  console.info(
    '[vue-router-layout] app.use(VueRouterLayout) is no longer needed. You can safely remove it.'
  )
}

export function createRouterLayout(
  resolve: (layoutName: string) => Promise<Component | { default: Component }>
) {
  return defineComponent({
    name: 'RouterLayout',

    data() {
      return {
        layout: undefined as Layout | undefined,
        layouts: shallowReactive(
          Object.create(null) as Record<string, Component>
        ),
      }
    },

    async beforeRouteEnter(to, _from, next) {
      await loadAsyncComponents(to)

      const layout = resolveLayout(to.matched)
      const layoutComp = layout
        ? normalizeEsModuleComponent(await resolve(layout.name))
        : undefined

      next((vm: any) => {
        vm.layout = layout
        if (layout && layoutComp) {
          vm.layouts[layout.name] = layoutComp
        }
      })
    },

    async beforeRouteUpdate(to, _from, next) {
      try {
        await loadAsyncComponents(to)

        const layout = resolveLayout(to.matched) || this.layout
        if (layout && !this.layouts[layout.name]) {
          this.layouts[layout.name] = normalizeEsModuleComponent(
            await resolve(layout.name)
          )
        }

        this.layout = layout
        next()
      } catch (error) {
        next(error)
      }
    },

    render(): VNode | null {
      const layoutComponent = this.layout && this.layouts[this.layout.name]
      if (!layoutComponent) {
        return null
      }

      return h(layoutComponent as ConcreteComponent, {
        key: this.layout!.name,
        ...this.layout!.props,
      })
    },
  })
}

export default {
  install,
}

declare module '@vue/runtime-core' {
  interface ComponentCustomOptions {
    layout?: string | Optional<Layout, 'props'>
  }
}

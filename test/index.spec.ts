import { mount as _mount } from '@vue/test-utils'
import { defineComponent, Component, ComponentOptions } from 'vue'
import { createRouter, createMemoryHistory, RouteRecordRaw } from 'vue-router'
import { createRouterLayout } from '../src/index'

const layouts: Record<string, Component> = {
  default: {
    template: '<div>Default <router-view/></div>',
  },

  foo: {
    template: '<div>Foo <router-view/></div>',
  },

  bar: {
    template: '<div>Bar {{ title }}<router-view/></div>',
    props: {
      title: {
        type: String,
        default: '',
      },
    },
  },
}

const RouterLayout = createRouterLayout((layout) => {
  if (layouts[layout]) {
    return Promise.resolve(layouts[layout])
  } else {
    return Promise.reject(new Error('Not found layout: ' + layout))
  }
})

async function mount(children: RouteRecordRaw[]) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/',
        component: RouterLayout,
        children,
      },
    ],
  })

  const Root = defineComponent({
    template: '<router-view/>',
  })

  const wrapper = _mount(Root, {
    global: {
      plugins: [router],
    },
  })

  await router.push('/')

  return wrapper
}

describe('RouterLayout component', () => {
  it('shows default layout', async () => {
    const Comp = {
      template: '<p>component</p>',
    }

    const wrapper = await mount([
      {
        path: '',
        component: Comp,
      },
    ])
    expect(wrapper.html()).toMatchSnapshot()
  })

  it('shows named layout', async () => {
    const Comp = {
      layout: 'foo',
      template: '<p>component</p>',
    }

    const wrapper = await mount([
      {
        path: '',
        component: Comp,
      },
    ])
    expect(wrapper.html()).toMatchSnapshot()
  })

  it("uses the leaf component's layout option", async () => {
    const Test1 = {
      layout: 'foo',
      template: '<div>Test1 <router-view/></div>',
    }

    const Test2 = {
      layout: 'bar',
      template: '<p>Test2</p>',
    }

    const wrapper = await mount([
      {
        path: '',
        component: Test1,
        children: [
          {
            path: '',
            component: Test2,
          },
        ],
      },
    ])
    expect(wrapper.html()).toMatchSnapshot()
  })

  it('updates layout when route is changed', async () => {
    const Test1 = {
      layout: 'foo',
      template: '<p>Test1</p>',
    }

    const Test2 = {
      layout: 'bar',
      template: '<p>Test2</p>',
    }

    const wrapper = await mount([
      {
        path: '',
        component: Test1,
      },
      {
        path: 'test',
        component: Test2,
      },
    ])
    await wrapper.vm.$router.push('/test')
    await wrapper.vm.$nextTick()
    expect(wrapper.html()).toMatchSnapshot()
  })

  it('works with component constructor', async () => {
    const Test1 = defineComponent({
      layout: 'foo',
      template: '<p>Test1</p>',
    })

    const Test2 = defineComponent({
      template: '<p>Test2</p>',
    })

    const wrapper = await mount([
      {
        path: '',
        component: Test1,
      },
      {
        path: 'test',
        component: Test2,
      },
    ])
    expect(wrapper.html()).toMatchSnapshot()
    await wrapper.vm.$router.push('/test')
    await wrapper.vm.$nextTick()
    expect(wrapper.html()).toMatchSnapshot()
  })

  it('works with async component', async (done) => {
    const Test1 = () => {
      return Promise.resolve({
        layout: 'foo',
        template: '<p>Test1</p>',
      })
    }

    const Test2 = () => {
      return new Promise<ComponentOptions>((resolve) => {
        setTimeout(() => {
          resolve({
            layout: 'bar',
            template: '<p>Test2</p>',
          })
        }, 100)
      })
    }

    const wrapper = await mount([
      {
        path: '',
        component: Test1,
      },
      {
        path: 'test',
        component: Test2,
      },
    ])

    await wrapper.vm.$nextTick()

    // Foo - Test1
    expect(wrapper.html()).toMatchSnapshot()

    wrapper.vm.$router.push('/test')

    // Foo - Test1 (Should not change layout until the async component is resolved)
    await wrapper.vm.$nextTick()
    expect(wrapper.html()).toMatchSnapshot()

    setTimeout(() => {
      // Bar - Test2 (Should update layout after async component is resolved)
      expect(wrapper.html()).toMatchSnapshot()
      done()
    }, 200)
  })

  it('works with async component with default export', async (done) => {
    const Test1 = () => {
      return Promise.resolve({
        layout: 'foo',
        template: '<p>Test1</p>',
      })
    }

    const Test2 = () => {
      return new Promise<any>((resolve) => {
        setTimeout(() => {
          import('./dummy').then(resolve)
        }, 100)
      })
    }

    const wrapper = await mount([
      {
        path: '',
        component: Test1,
      },
      {
        path: 'test',
        component: Test2,
      },
    ])

    await wrapper.vm.$nextTick()

    // Foo - Test1
    expect(wrapper.html()).toMatchSnapshot()

    wrapper.vm.$router.push('/test')

    // Foo - Test1 (Should not change layout until the async component is resolved)
    await wrapper.vm.$nextTick()
    expect(wrapper.html()).toMatchSnapshot()

    setTimeout(() => {
      // Bar - Test2 (Should update layout after async component is resolved)
      expect(wrapper.html()).toMatchSnapshot()
      done()
    }, 200)
  })

  it('should not instantiate destination page until layout is rendered', async (done) => {
    const created = jest.fn()

    const Test1 = () => {
      return Promise.resolve({
        layout: 'foo',
        template: '<p>Test1</p>',
      })
    }

    const Test2 = () => {
      return new Promise<any>((resolve) => {
        setTimeout(() => {
          resolve({
            layout: 'bar',
            template: '<p>Test2</p>',
            created,
          })
        }, 100)
      })
    }

    const wrapper = await mount([
      {
        path: '',
        component: Test1,
      },
      {
        path: 'test',
        component: Test2,
      },
    ])

    wrapper.vm.$router.push('/test')

    setTimeout(() => {
      expect(created).toHaveBeenCalledTimes(1)
      done()
    }, 200)
  })

  it('pulls layout value from extends', async () => {
    const Super = {
      layout: 'foo',
    }

    const Comp = {
      extends: Super,
      template: '<p>component</p>',
    }

    const wrapper = await mount([
      {
        path: '',
        component: Comp,
      },
    ])
    expect(wrapper.html()).toMatchSnapshot()
  })

  it('prioritizes mixins option than extends', async () => {
    const Mixin = {
      layout: 'bar',
    }

    const Super = {
      layout: 'foo',
    }

    const Comp = {
      mixins: [Mixin],
      extends: Super,
      template: '<p>component</p>',
    }

    const wrapper = await mount([
      {
        path: '',
        component: Comp,
      },
    ])
    expect(wrapper.html()).toMatchSnapshot()
  })

  it('hooks errors while loading a lazy component', async () => {
    const Test1 = {
      layout: 'foo',
      template: '<p>Test1</p>',
    }

    const Test2 = () => {
      return new Promise((_, reject) => {
        reject(new Error('Test'))
      })
    }

    const wrapper = await mount([
      {
        path: '',
        component: Test1,
      },
      {
        path: 'test',
        component: Test2,
      },
    ])

    const onError = jest.fn()
    wrapper.vm.$router.onError(onError)

    await wrapper.vm.$nextTick()
    await expect(wrapper.vm.$router.push('/test')).rejects.toEqual(
      new Error('Test')
    )

    expect(wrapper.html()).toMatchSnapshot()
    expect(onError).toHaveBeenCalledWith(new Error('Test'))
  })

  it('hooks errors while loading a layout', async () => {
    const Test1 = {
      layout: 'foo',
      template: '<p>Test1</p>',
    }

    const Test2 = {
      layout: 'error',
      template: '<p>Test2</p>',
    }

    const wrapper = await mount([
      {
        path: '',
        component: Test1,
      },
      {
        path: 'error',
        component: Test2,
      },
    ])

    const onError = jest.fn()
    wrapper.vm.$router.onError(onError)

    await wrapper.vm.$nextTick()
    await expect(wrapper.vm.$router.push('/error')).rejects.toEqual(
      new Error('Not found layout: error')
    )

    expect(wrapper.html()).toMatchSnapshot()
    expect(onError).toHaveBeenCalledWith(new Error('Not found layout: error'))
  })

  it('passes props to layout component', async () => {
    const TestComponent = {
      template: `<p>Test</p>`,
      layout: {
        name: 'bar',
        props: {
          title: 'hello',
        },
      },
    }

    const wrapper = await mount([
      {
        path: '',
        component: TestComponent,
      },
    ])

    expect(wrapper.html()).toMatchSnapshot()
  })

  it('Created hook in page component should not be called when layout changes', async (done) => {
    const created = jest.fn()

    const Test1 = {
      layout: 'foo',
      template: '<p>Test1</p>',
      created,
    }

    const Test2 = {
      layout: 'bar',
      template: '<p>Test2</p>',
    }

    const wrapper = await mount([
      {
        path: '',
        component: Test1,
      },
      {
        path: 'test',
        component: Test2,
      },
    ])

    wrapper.vm.$router.push('/test')

    setTimeout(() => {
      // Should be called only once when initiating.
      expect(created).toHaveBeenCalledTimes(1)
      done()
    }, 200)
  })
})

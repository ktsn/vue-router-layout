# vue-router-layout

Lightweight layout resolver for Vue Router.

You may want to use [vue-cli-plugin-auto-routing](https://github.com/ktsn/vue-cli-plugin-auto-routing) which includes all useful features on routing.

## Installation

```bash
$ npm install vue-router-layout
```

## Supported Vue Version

0.2.0 or newer only supports Vue >= 3.0.0. If you want to use vue-router-layout with Vue v2, try 0.1.x.

## Overview

Create `<RouterLayout>` component by passing a callback which resolves layout component to `createRouterLayout`. The callback will receives a string of layout type and expect returning a promise resolves a layout component.

```js
import { createRouterLayout } from 'vue-router-layout'

// Create <RouterLayout> component.
const RouterLayout = createRouterLayout(layout => {
  // Resolves a layout component with layout type string.
  return import('@/layouts/' + layout + '.vue')
})
```

Pass `<RouterLayout>` to Vue Router's `routes` option with some children components.

```js

import { createRouter, createWebHistory } from 'vue-router'
import { createRouterLayout } from 'vue-router-layout'

// Create <RouterLayout> component.
const RouterLayout = createRouterLayout(layout => {
  // Resolves a layout component with layout type string.
  return import('@/layouts/' + layout + '.vue')
})

export default createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',

      // Pass <RouterLayout> as the route component
      component: RouterLayout,

      // All child components will be applied with corresponding layout component
      children: [
        {
          path: '',
          component: () => import('@/pages/index.vue')
        }
      ]
    }
  ]
})
```

With the above router, if you have `layouts/foo.vue` and `pages/index.vue` like the following:

```vue
<!-- layouts/foo.vue -->
<template>
  <div>
    <h1>{{ title }} Foo Layout</h1>
    <router-view/>
  </div>
</template>

<script>
export default {
  props: {
    type: String,
    default: 'Hello',
  }
}
</script>
```

```vue
<!-- pages/index.vue -->
<template>
  <p>index.vue</p>
</template>

<script>
export default {
  // Specify the layout by either an object or a string. 
  // The default value is 'default'.
  layout: {
    name: 'foo',
    props: {
      title: 'Hi'
    }
  }
  // or just `layout: 'foo'` if the layout component doesn't have any props.
}
</script>
```

The following html will be rendered when you access `/` route:

```html
<div>
  <h1>Hi Foo Layout</h1>
  <p>index.vue</p>
</div>
```

## Related Projects

* [vue-cli-plugin-auto-routing](https://github.com/ktsn/vue-cli-plugin-auto-routing): Vue CLI plugin including auto pages and layouts resolution.
* [vue-auto-routing](https://github.com/ktsn/vue-auto-routing): Generate Vue Router routing automatically.
* [vue-route-generator](https://github.com/ktsn/vue-route-generator): Low-level utility generating routing (used by vue-auto-routing under the hood).


## License

MIT

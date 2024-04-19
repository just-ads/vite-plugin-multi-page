# vite-plugin-mpg
> multi-page-application for vite

## Usage

```shell
npm install vite-plugin-mpg -D
```

```js
// vite.config.js
import vitePluginMultiPage from "vite-plugin-mpg";

// @see https://vitejs.dev/config/
export default defineConfig({
    // ...
    plugins: [
        // ...other plugins
        vitePluginMultiPage(/* options */),
    ],
})
```

## Options

```ts
type MultiPageItem = {
    /**
     * path accessed from url
     */
    path: string
    
    /**
     * page entry
     * it doesn t have to be .html
     */
    file: string
    
    /**
     * When the `file` is not an html file, override the `template` configured by the root
     */
    template?: string
}

type MultiPagesOptions = {
    /**
     * When the `file` in MultiPageItem is not html, provide template html
     * @default 'index.html'
     */
    template?: string
    
    /**
     * pages
     */
    pages: MultiPageItem[]
}

```
You can also write the above configuration by creating a `pages.config.json` file in the project root directory

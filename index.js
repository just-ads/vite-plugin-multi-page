import $path from 'node:path';
import $fs from 'node:fs';
import {normalizePath} from "vite";
import {parse, serialize} from "parse5";

import {getOptions} from "./utils/options.js";
import {checkPages, createRuleList} from "./utils/utils.js";
import {deleteEmptyFoldersRecursively, getSource, writeFile} from "./utils/file.js";

function traverseNodes(node, visitor) {
    visitor(node);
    if (node.nodeName[0] !== '#' ||
        node.nodeName === '#document' ||
        node.nodeName === '#document-fragment') {
        node.childNodes.forEach((childNode) => traverseNodes(childNode, visitor));
    }
}

function transformHtml(html, filepath, newFilepath) {
    const ast = parse(html);
    const dir = normalizePath($path.dirname(filepath));
    const newDir = normalizePath($path.dirname(newFilepath));
    traverseNodes(ast, node => {
        let url;
        if (node.nodeName === 'script') {
            url = node.attrs.find(p => p.name === 'src');
        }
        if (node.nodeName === 'link') {
            url = node.attrs.find(p => p.name === 'href');
        }
        if (url) {
            const absolutePath = normalizePath($path.resolve(dir, url.value));
            url.value = normalizePath($path.relative(newDir, absolutePath));
        }
    });
    return serialize(ast);
}

function injectToHtml(html, tags) {
    return html.replace(/<\/html>/i, (match, p1) => `${tags}\n${match}`)
}


export default function vitePluginMultiPage(userOptions) {
    const root = normalizePath(process.cwd());
    let configFile;
    if (!userOptions) {
        const {file, options} = getOptions(root);
        userOptions = options;
        configFile = file;
    }
    checkPages(userOptions.pages);
    let {template, pages} = userOptions;
    if (!template) {
        template = '/index.html';
    }

    let resolveConfig;


    const getPage = (filename) => {
        filename = filename.startsWith('/') ? filename.substring(1) : filename;
        filename = normalizePath(filename);
        return pages.find(page => {
            const file = page.file.startsWith('/') ? page.file.substring(1) : page.file;
            return normalizePath(file) === filename
        });
    }

    const getPagePath = page => {
        const path = (page.path === '/' ? '/index' : page.path) + '.html';
        return normalizePath($path.relative('/', path))
    }

    const getProjectFiles = id => normalizePath($path.join(resolveConfig.root, id))

    const ruleList = createRuleList(pages, template);
    const processedHtml = new Map();


    return {
        name: 'vite-plugin-multi-page',
        enforce: 'pre',
        config(config) {
            config.build = config.build || {};
            config.build.rollupOptions = config.build.rollupOptions || {};
            config.build.rollupOptions.input = pages.map(page => page.file);
            config.server = config.server || {};
        },
        configResolved(config) {
            configFile && config.configFileDependencies.push(normalizePath(configFile));
            resolveConfig = config;
        },
        resolveId(source, importer, options) {
            // 处理入口不是html的配置
            if (!source.endsWith('.html') && !importer && options.isEntry) {
                const page = getPage(source);
                if (!page) return;
                const temp = page.template || template;
                if (!temp) {
                    throw Error(`${page.path}: template is required when if the entry of the page is not html, you maybe should configure the template in configuration`);
                }
                const id = getProjectFiles(getPagePath(page));
                const folder = $path.dirname(id);

                processedHtml.set(id, {
                    template: temp,
                    entry: $path.relative(folder, getProjectFiles(source))
                });
                return id;
            }
        },
        load(id) {
            if (processedHtml.has(id)) {
                const info = processedHtml.get(id);
                const template = getSource(getProjectFiles(info.template));
                // 把入口注入到模板文件中
                return injectToHtml(template, `<script type="module" src="${info.entry}"></script>`);
            }
        },
        configureServer(server) {
            server.middlewares.use((req, res, next) => {
                let url = req.url.split('.')[0];
                url = url.split('?')[0];
                let to, template;
                for (let i = 0; i < ruleList.length; i++) {
                    const rule = ruleList[i];
                    if (url.match(rule.from)) {
                        to = rule.to;
                        template = rule.template
                        break;
                    }
                }
                if (to && !to.endsWith('.html') && template) {
                    const html = getSource(getProjectFiles(template));
                    res.write(injectToHtml(html, `<script type="module" src="${to}"></script>`), 'utf-8');
                    res.end()
                    return;
                } else if (to) {
                    req.url = to;
                }
                next();
            })
        },
        transformIndexHtml: {
            order: 'post',
            handler(html, ctx) {
                // 构建时在writeBundle处理
                if (!ctx.server) return html
                const filepath = ctx.path;
                return transformHtml(html, filepath, ctx.server.middlewares.route)
            }
        },
        writeBundle(options, bundle) {
            const chunks = Object.values(bundle).filter(chunk => chunk.fileName.endsWith('.html'));
            const outPath = options.dir;
            chunks.forEach(({fileName, source}) => {
                const page = getPage(fileName);
                if (!page) return;
                const filepath = getProjectFiles(fileName);
                const path = getPagePath(page);
                const newFilepath = normalizePath($path.join(outPath, path));
                if (filepath === newFilepath) return;
                const html = transformHtml(source, filepath, newFilepath);
                writeFile(newFilepath, html);
                $fs.unlinkSync(filepath);
            });
            deleteEmptyFoldersRecursively(outPath);
        }
    }
}

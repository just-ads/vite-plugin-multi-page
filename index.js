import $path from 'node:path';
import $fs from 'node:fs';
import {getOptions} from "./utils/options.js";
import {checkPages, createRuleList, getSource} from "./utils/index.js";
import {normalizePath} from "vite";
import {parse, serialize} from "parse5";

function writeFile(name, content) {
    if ($fs.existsSync(name)) {
        $fs.unlinkSync(name)
    }
    $fs.writeFileSync(name, content)
}

function deleteEmptyFoldersRecursively(folderPath) {
    if (!$fs.existsSync(folderPath)) {
        return;
    }
    const files = $fs.readdirSync(folderPath);
    if (files.length === 0) {
        $fs.rmdirSync(folderPath);
        return;
    }

    files.forEach((file) => {
        const filePath = $path.join(folderPath, file);
        if ($fs.statSync(filePath).isDirectory()) {
            deleteEmptyFoldersRecursively(filePath);
        }
    });

    // Check if the folder is empty after deleting its subfolders
    const remainingFiles = $fs.readdirSync(folderPath);
    if (remainingFiles.length === 0) {
        $fs.rmdirSync(folderPath);
    }
}

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
    if (!userOptions) {
        userOptions = getOptions(root)
    }
    checkPages(userOptions.pages);
    let {template, pages} = userOptions;
    if (!template) {
        template = '/index.html';
    }


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

    const ruleList = createRuleList(pages);
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
        resolveId(source, importer, options) {
            if (!source.endsWith('.html') && !importer && options.isEntry) {
                const page = getPage(source);
                if (!page) return;
                const temp = page.template || template;
                const id = normalizePath($path.join(root, getPagePath(page)));
                const folder = $path.dirname(id);

                processedHtml.set(id, {
                    template: temp,
                    entry: normalizePath($path.relative(folder, $path.join(root, source)))
                });
                return id;
            }
        },
        load(id) {
            if (processedHtml.has(id)) {
                const info = processedHtml.get(id);
                const template = getSource($path.join(root, info.template));
                return injectToHtml(template, `<script type="module" src="${info.entry}"></script>`);
            }
        },
        configureServer(server) {
            server.middlewares.use((req, res, next) => {
                let url = req.url.split('.')[0];
                url = url.split('?')[0];
                for (let i = 0; i < ruleList.length; i++) {
                    const rule = ruleList[i];
                    if (url.match(rule.from)) {
                        req.url = rule.to;
                        break;
                    }
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
                const filepath = normalizePath($path.join(outPath, fileName));
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

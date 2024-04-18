import path from "node:path";
import fs from 'node:fs'

export function getOptions(root) {
    const p = path.join(root, 'pages.config.json');
    if(fs.existsSync(p)) {
        try {
            return JSON.parse(fs.readFileSync(p, 'utf-8'))
        } catch (e) {
            throw new Error(`p not found`)
        }
    }
    return {}
}

import $path from "node:path";
import $fs from 'node:fs'

const supportedProfiles = ['pages.config.json']


export function getOptions(root) {
    const file = getOptionsFile(root);
    if(!file){
        throw Error(`not found configuration file, support ${supportedProfiles.join(',')}`)
    }
    let options;
    try {
        options = JSON.parse($fs.readFileSync(file, 'utf-8'))
    } catch (e) {
        throw Error(`invalid configuration file`)
    }
    return {
        file,
        options
    }
}

export function getOptionsFile(root) {
    for (const f of supportedProfiles) {
        if ($fs.existsSync($path.join(root, f))) {
            return f
        }
    }
}

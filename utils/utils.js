export function exclude(object, properties) {
    const result = {};
    for (const key in object) {
        if (!properties.includes(key)) {
            result[key] = object[key];
        }
    }
    return result;
}

export function isValidPage(page) {
    return page.path && typeof page.path === 'string' &&
        page.file && typeof page.file === 'string'
}

export function checkPages(pages) {
    if (Array.isArray(pages)) {
        pages.forEach(page => {
            if (!isValidPage(page)) {
                throw new Error(`${JSON.stringify(page)} is invalid page; page must hava path,name,file property`)
            }
        });
    } else {
        throw new Error('invalid options.pages')
    }
}

export function createRuleList(pages, template) {
    const ruleList = [];
    pages.forEach(page => {
        const p = page.path.startsWith('/') ? page.path.substring(1) : page.path;
        ruleList.push({
            from: `^/${p}$`,
            to: page.file,
            template: page.template || template
        });
    });
    return ruleList
}


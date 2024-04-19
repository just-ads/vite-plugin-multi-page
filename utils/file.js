import $path from 'node:path';
import $fs from 'node:fs';

export function getSource(filename) {
    if (!$fs.existsSync(filename)) {
        throw Error(`not found ${filename}`)
    }
    return $fs.readFileSync(filename, 'utf-8');
}

export function writeFile(name, content) {
    if ($fs.existsSync(name)) {
        $fs.unlinkSync(name)
    }
    $fs.writeFileSync(name, content)
}

export function deleteEmptyFoldersRecursively(folderPath) {
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

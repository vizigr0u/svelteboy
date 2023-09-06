import fs from 'fs';
import path from 'path'
import crypto from 'crypto'
import { argv0 } from 'process'

function computeSHA1(file) {
    const data = fs.readFileSync(file);
    const sha1 = crypto.createHash('sha1').update(data).digest('hex');
    return sha1;
}

function generateFileList(directory) {
    let fileList = [];

    function walk(dir, relativePath) {
        let files = fs.readdirSync(dir);
        for (let i in files) {
            let name = dir + '/' + files[i];
            if (fs.statSync(name).isDirectory()) {
                walk(name, relativePath + '/' + files[i]);
            } else {
                fileList.push({
                    filename: path.basename(name),
                    location: relativePath,
                    sha1: computeSHA1(name)
                });
            }
        }
    }

    walk(directory, '');

    return fileList;
}

if (process.argv.length < 4) {
    console.error('Usage: ' + argv0 + ' DIR BASE-URI');
    process.exit(1);
}

const directory = process.argv[2];
const baseuri = process.argv[3];
const roms = generateFileList(directory);
const result = { baseuri, roms };
console.log(JSON.stringify(result, null, 2));

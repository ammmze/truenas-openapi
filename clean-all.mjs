#!/usr/bin/env zx
import { argv, glob, path, $ } from 'zx'
import { cleanFile } from './lib/clean.mjs'

const defaultSchemaDir = path.join(process.cwd(), 'schemas')
const [_, originalDir = path.join(defaultSchemaDir, 'original'), cleanedDir = path.join(defaultSchemaDir, 'clean')] = argv._

const originals = await glob(['**/*.yml', '**/*.yaml'], { cwd: originalDir })

for (const original of originals) {
    const paths = { input: path.join(originalDir, original), output: path.join(cleanedDir, original) }
    console.log('Cleaning', paths)
    await cleanFile(paths)
}

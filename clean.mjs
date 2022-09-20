#!/usr/bin/env zx
import { argv, YAML, fs } from 'zx'
import { cleanFile } from './lib/clean.mjs'

await cleanFile({ input: argv._[1], output: argv.output ?? argv.o })

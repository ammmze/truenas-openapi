#!/usr/bin/env zx
import { argv, YAML, fs } from 'zx'

export default function clean(input) {
    if (typeof input !== 'object' || input === null) {
        return input
    }

    if (Array.isArray(input)) {
        return input.map(clean)
    }

    if (Array.isArray(input.type)) {
        const { type, ...result } = input
        if (type.includes('null')) {
            result.nullable = true
        }
        const types = type.filter(t => t !== 'null')
        if (types.length === 1) {
            result.type = types[0]
        } else if (types.length > 1) {
            result.oneOf = types.map(type => ({ type }))
        } else {
            throw new Error('No types were left after processing input', input)
        }
        return clean(result)
    }

    if (isArraySchemaType(input) && (Array.isArray(input.items) || typeof input.items === 'undefined')) {
        const { items = [], ...result } = input
        if (items.length === 1) {
            result.items = items[0]
        } else if (items.length > 1) {
            result.items = { anyOf: items }
        } else {
            result.items = {}
        }
        return clean(result)
    }

    if (isObjectSchemaType(input) && (isEmptyObject(input.default) || input.default === null)) {
        const result = { ...input }
        delete result.default
        return clean(result)
    }

    const deny = ['_name_', '_required_', '_attrs_order_']
    return Object.entries(input).reduce((prev, [key, value]) => {

        // reject things in the deny list
        if (deny.includes(key)) {
            return prev
        }

        // return our existing object with the specific field cleaned
        return {
            ...prev,
            [key]: clean(value),
        }
    }, {})
}

function isObjectSchemaType(input) {
    return (input?.type === 'object') || (input?.anyOf || []).includes('object')  || (input?.oneOf || []).includes('object') || (Array.isArray(input?.type) && input.type.includes('object'))
}

function isArraySchemaType(input) {
    return (input?.type === 'array') || (input?.anyOf || []).includes('array')  || (input?.oneOf || []).includes('array') || (Array.isArray(input?.type) && input.type.includes('array'))
}

function isEmptyObject(input) {
    return typeof input === 'object' && !!input && !Array.isArray(input) && Object.keys(input).length === 0
}

async function main() {
    const input = argv._[1]
    const parsedInput = YAML.parse((await fs.readFile(input)).toString())
    const output = argv.output ?? argv.o

    const cleaned = YAML.stringify(clean(parsedInput))

    if (typeof output === 'string' && output.length > 0) {
        await fs.writeFile(output, cleaned)
    } else {
        console.log(cleaned)
    }
}

await main()

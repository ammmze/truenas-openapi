export function clean(input) {
    let output = input
    if (typeof output !== 'object' || output === null) {
        return output
    }

    if (Array.isArray(output)) {
        return output.reduce((prev, current) => {
            const cleaned = clean(current)
            return typeof cleaned === 'undefined' ? prev : [...prev, cleaned]
        }, [])
    }

    // remove if the type is an object with no defined properties and doesn't accept additional properties
    if (output.type === 'object' && isEmptyObject(output.properties) && output?.additionalProperties === false) {
        return undefined
    }

    output = normalizeTypeArray(output)
    output = normalizeItems(output)
    output = normalizeDefault(output)
    output = combineAnyOfEnums(output)

    const deny = ['_name_', '_required_', '_attrs_order_']
    return Object.entries(output).reduce((prev, [key, value]) => {

        // reject things in the deny list
        if (deny.includes(key)) {
            return prev
        }

        // return our existing object with the specific field cleaned
        const cleaned = clean(value)
        return typeof cleaned === 'undefined' ? prev :  {
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

/**
 * Normalizes the object when the "type" is an array (which is valid in JSON schema, but not OpenAPI).
 * If the "type" array includes "null", we will populate `nullable: true`.
 * If there is only one type remaining after removing the "null", we will set the `type` to that remaining type.
 * If there are multiple remaining types, we will remove `type` and populate `oneOf` with the remaining types.
 */
function normalizeTypeArray(input) {
    if (!Array.isArray(input.type)) {
        return input
    }
    const { type, ...output } = input
    if (type.includes('null')) {
        output.nullable = true
    }
    const types = type.filter(t => t !== 'null')
    if (types.length === 1) {
        output.type = types[0]
    } else if (types.length > 1) {
        output.oneOf = types.map(type => ({ type }))
    } else {
        throw new Error('No types were left after processing input', input)
    }
    return output
}

function normalizeItems(input) {
    let output = input
    if (isArraySchemaType(output) && (Array.isArray(output.items) || typeof output.items === 'undefined')) {
        const { items = [], ...result } = output
        if (items.length === 1) {
            result.items = items[0]
        } else if (items.length > 1) {
            result.items = { anyOf: items }
        } else {
            result.items = {}
        }
        return result
    }
    return output
}

function normalizeDefault(input) {
    let output = input
    if (isObjectSchemaType(output) && (isEmptyObject(output.default) || output.default === null)) {
        const result = { ...output }
        delete result.default
        return result
    }
    return output
}

/**
 * Normalizes where the object has an enum and uses an anyOf that is a string and another enum.
 * These can be reduced to a single enum list and remove the anyOf. For example, transforms:
 * ```yaml
 * aclmode:
 *   title: aclmode
 *   enum:
 *     - PASSTHROUGH
 *     - RESTRICTED
 *     - DISCARD
 *   nullable: false
 *   anyOf:
 *     - type: string
 *     - type: string
 *       enum:
 *         - INHERIT
 * ```
 * Into the following:
 * ```yaml
 * aclmode:
 *   title: aclmode
 *   type: string
 *   enum:
 *     - PASSTHROUGH
 *     - RESTRICTED
 *     - DISCARD
 *     - INHERIT
 *   nullable: false
 * ```
 */
function combineAnyOfEnums(input) {
    if (!input?.enum || !input?.anyOf) {
        return input
    }
    const enums = [...input.enum]
    const types = []
    for (const typeObj of input.anyOf) {
        const { type, enum: addlEnums, ...remainingType } = typeObj
        // if the type is not string, or if it has properties other than type and enum, leave it intact
        if (type !== 'string' || Object.keys(remainingType).length > 0) {
            types.push(typeObj)
            continue
        } else if (addlEnums) {
            enums.push(...addlEnums)
        }
    }
    if (types.length === 0) {
        const { anyOf, ...output } = input
        output.enum = enums
        output.type = 'string'
        return output
    } else {
        const { anyOf, ...output } = input
        delete output.enum
        delete output.type
        output.anyOf = [{ type: 'string', enum: enums }, ...anyOf]
        return output
    }
}

export async function cleanFile({ input, output }) {
    const parsedInput = YAML.parse((await fs.readFile(input)).toString())

    const cleaned = YAML.stringify(clean(parsedInput))

    if (typeof output === 'string' && output.length > 0) {
        await fs.writeFile(output, cleaned)
    } else {
        console.log(cleaned)
    }
}
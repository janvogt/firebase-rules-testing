class Auth {
    constructor (uid) {
        this.uid = uid ? uid : null
    }
}

class Snapshot {
    constructor (data) {
        this.data = data
        this.path = []
    }

    child (path) {
        const segments = pathSegments(path)
        const childSnapshot = this._copy()
        childSnapshot.path = this.path.concat(segments)
        // console.log(JSON.stringify(childSnapshot));
        return childSnapshot
    }

    parent() {
        const parentSnapshot = this._copy()
        parentSnapshot.path = this.path.slice(0, -1)
        return parentSnapshot
    }

    val() {
        return this._val()
    }

    isString() {
        return typeof this._val() === 'string'
    }

    isNumber() {
        return typeof this._val() === 'number'
    }

    exists() {
        const val = this._val()
        return val != null && val != undefined
    }

    isBoolean() {
        return typeof this._val() === 'boolean'
    }

    hasChild(path) {
        return this.child(path).exists()
    }

    hasChildren(children) {
        if (Array.isArray(children)) {
            return children.every(c => this.child(c).exists())
        } else {
            var val = this._val()
            return typeof val === 'object' ? Object.keys(val).length > 0 : false
        }
    }

    _val() {
        return this.path.reduce((prev, next) => typeof prev === 'object' ? prev[next] : null, this.data)
    }

    _copy() {
        return new Snapshot(deepAssign({}, this.data))
    }
}

function deepAssign () {
    var base = typeof arguments[0] === 'object' ? arguments[0] : {}
    Array.prototype.slice.call(arguments, 1).forEach(arg => {
        if (typeof arg !== 'object') { return }
        Object.keys(arg).forEach(key => {
            if (typeof arg[key] === 'object') {
                base[key] = deepAssign(base[key], arg[key])
            } else {
                base[key] = arg[key]
            }
        })
    })
    return base
}

function readResults(rules, path, auth, dataSnapshot) {
    var segments = pathSegments(path)
    const pathTree = segments.reverse().reduce((prev, next) => {
        return {
            [next]: prev
        }
    }, {})
    const results = recurseEval(rules, '.read', pathTree, path => {
        return {
            auth: auth,
            root: dataSnapshot,
            data: dataSnapshot.child(path)
        }
    })
    return {
        allowed: results.some(res => res.result),
        details: results,
        method: 'read'
    }
}

function pathSegments(path) {
    var segments = path.split('/')
    if (segments[segments.length-1] == '') {
        segments.splice(-1)
    }
    if (segments[0] == '') {
        segments.splice(0, 1)
    }
    return segments
}

function recurseEval(rules, ruleType, pathTree, contextFn, path = '') {
    // console.log("Recurse call", rules, ruleType, pathTree, contextFn, path);
    var results = []
    if (rules[ruleType]) {
        results.push({
            type: ruleType,
            path: '',
            variables: {},
            result: executeRule(rules[ruleType], contextFn(path))
        })
    }
    const wildcards = Object.keys(rules).filter(r => r.startsWith('$'))
    if (wildcards.length > 1) {
        throw new Error(`Sibling wildcard rules: ${JSON.stringify(wildcards)}`)
    }
    const wildcard = wildcards.length > 0 ? wildcards[0] : null
    Object.keys(pathTree).forEach(k => {
        if (rules[k]) {
            results = results.concat(recurseEval(rules[k], ruleType, pathTree[k], contextFn, `${path}/${k}`).map(res => {
                res.path = `${k}/${res.path}`
                return res
            }))
        } else if (wildcard) {
            // console.log("WIldcard", wildcard);
            results = results.concat(recurseEval(rules[wildcard], ruleType, pathTree[k], path => Object.assign({
                [wildcard]: k
            }, contextFn(path)), `${path}/${k}`).map(res => {
                // console.log("result", res);
                res.path = `${wildcard}/${res.path}`
                res.variables = Object.assign({
                    [wildcard]: k
                }, res.variables)
                return res
            }))
            // console.log(results);;
        }
    })
    return results
}

function executeRule (rule, context) {
    const body = `return (${rule})`
    const varNames = Object.keys(context)
    const vars = varNames.map(k => context[k])
    const ruleFn = (new (Function.prototype.bind.apply(Function, [null].concat(varNames).concat([body]))))
    return ruleFn.apply(null, vars)
}

// function prefixObject(prefix, obj) {
//     return mapObject(obj, (k, v) => [`${prefix}/${k}`, v])
// }

// function mapObject (obj, transform) {
//     return Object.keys(obj).map(k => transform(k, obj[k])).reduce((prev, next) => {
//         prev[next[0]] = next[1]
//     }, {})
// }

class FirebaseRulesTest {
    constructor (rules) {
        this.rules = rules.rules
        this.auth = new Auth()
        this.data = new Snapshot({})
        this.state = null
        this.results = []
    }

    authenticate (uid) {
        this.auth = new Auth(uid)
        return this
    }

    fixture (data) {
        this.data = new Snapshot(data || {})
        return this
    }

    read (path) {
        this.state = readResults(this.rules, path, this.auth, this.data)
        // console.log(this.state);
        return this
    }

    allow (msg) {
        this._ensureResult()
        return this._check(this.state.allowed, 'allowed', msg)
    }

    deny (msg) {
        this._ensureResult()
        return this._check(!this.state.allowed, 'denied', msg)
    }

    _check (success, verb, msg) {
        if (!success) {
            this.results.push(`ERROR: Expected ${this.state.method} to be ${verb}. ${msg}\n${JSON.stringify(this.state)}`)
        } else {
            this.results.push(true)
        }
        this.result == null
        return this
    }

    stats () {
        const successCount = this.results.filter(s => s === true).length
        if (successCount < this.results.length) {
            this.results.filter(s => typeof s === 'string').forEach(stat => {
                console.log(`${stat}\n`)
            })
            console.log(`FAILED: ${this.results.length - successCount}/${this.results.length} tests failed.`)
        } else {
            console.log(`SUCCESS: ran ${this.results.length}/${this.results.length} tests successfully.`)
        }

    }

    _ensureResult () {
        if (!this.state) {
            throw new Error("No current result.")
        }
    }

    _evalRead (path, rules, vars = {}) {
        var context = new Context(this.auth, vars)
        if (path.length == 0) {
            const result = context.evalRule(rules['.read']) || false
            return [result, {'': result}]
        } else {
            var result = {}
            if (rules['.read']) {
                if (context.evalRule(rules['.read'])) {
                    return [true, {'': true}]
                } else {
                    result[''] = false
                }
            }
            var subRules
            if (rules[path[0]]) {
                subRules = rules[path[0]]
            } else {
                var pathVars = Object.keys(rules).filter(r => r.startsWith('$'))
                if (pathVars.length > 0) {
                    if (pathVars.length > 1) {
                        throw new Error("Rules with sibling variables.")
                    }
                    subRules = rules[pathVars[0]]
                    vars[pathVars[0]] = path[0]
                } else {
                    subRules = {}
                }
            }
            const [overallResult, subResult] = this._evalRead(path.slice(1), subRules, vars)
            Object.keys(subResult).forEach(k => result[`${path[0]}/${k}`] = subResult[k])
            return [overallResult, result]
        }
    }
}

module.exports = FirebaseRulesTest
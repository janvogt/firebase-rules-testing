String.prototype.contains = function(str) { return this.includes(str) }
String.prototype.beginsWith = function(str) { return this.startsWith(str) }
// String.prototype.endsWith
// String.prototype.replace
// String.prototype.toLowerCase
// String.prototype.toUpperCase
String.prototype.matches = function(expr) { return expr.test(this) }

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
        const childSnapshot = this.copy()
        childSnapshot.path = this.path.concat(segments)
        // console.log(JSON.stringify(childSnapshot));
        return childSnapshot
    }

    parent() {
        const parentSnapshot = this.copy()
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
        // console.log(this);
        // console.log(this.path.reduce((prev, next) => typeof prev === 'object' && prev ? prev[next] : null, this.data));
        return this.path.reduce((prev, next) => typeof prev === 'object' && prev ? prev[next] : null, this.data)
    }

    copy(changes = []) {
        return new Snapshot(deepAssign.apply(null, [{}, this.data].concat(changes)))
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
    const now = Date.now()
    var segments = pathSegments(path)
    const tree = pathTree(segments)
    const results = recurseEval(rules, '.read', tree, path => {
        return {
            auth: auth,
            root: dataSnapshot,
            data: dataSnapshot.child(path),
            now: now
        }
    })
    return {
        allowed: results.some(res => res.result),
        details: results,
        method: 'read'
    }
}

function pathTree(segments, value = {}) {
    const s = segments.concat([])
    // console.log(s)
    return s.reverse().reduce((prev, next) => {
        return {
            [next]: prev
        }
    }, value)
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

function writeResults(rules, auth, dataSnapshot, changes) {
    const now = Date.now()
    // console.log('IN');
    const changePaths = Object.keys(changes)
    // console.log(changes);
    const writePathTrees = mapObject(changes, (k, v) => [k, pathTree(pathSegments(k))])
    // console.log(writePathTrees);
    const fullTree = serverValues(deepAssign.apply(null, changePaths.map(p => pathTree(pathSegments(p), changes[p]))), now)
    const newDataSnapshot = dataSnapshot.copy(fullTree)
    const contextFn = path => {
        return {
            auth: auth,
            root: dataSnapshot,
            data: dataSnapshot.child(path),
            newData: newDataSnapshot.child(path),
            now: now
        }
    }
    // console.log(changePaths, writePathTrees, fullTree, newDataSnapshot);
    const writeResults = mapObject(writePathTrees, (k, tree) => [k, recurseEval(rules, '.write', tree, contextFn)])
    const validateResults = recurseEval(rules, '.validate', fullTree, contextFn)
    return {
        allowed: Object.keys(writeResults).every(p => writeResults[p].some(res => res.result)) && validateResults.every(res => res.result),
        details: {
            write: writeResults,
            validate: validateResults
        },
        method: 'write'
    }
}

function serverValues (data, timestamp) {
    return mapObject(data, (k, v) => [k, typeof v === 'object' ? v['.sv'] === 'timestamp' ? timestamp : serverValues(v, timestamp) : v])
}

function recurseEval(rules, ruleType, tree, contextFn, path = '') {
    // console.log("Recurse call", rules, ruleType, tree, contextFn, path);
    var results = []
    const context = contextFn(path)
    var err, result
    try {
        result = executeRule(rules[ruleType], context)
    } catch (e) {
        err = `${e.toString()}\n${e.stack}`
        result = false
    }
    if (rules[ruleType]) {
        results.push({
            type: ruleType,
            path: '',
            data: context.data.val(),
            newData: (context.newData || { val: () => undefined }).val(),
            variables: {},
            result: result,
            error: err
        })
    }
    const wildcards = Object.keys(rules).filter(r => r.startsWith('$'))
    if (wildcards.length > 1) {
        throw new Error(`Sibling wildcard rules: ${JSON.stringify(wildcards)}`)
    }
    const wildcard = wildcards.length > 0 ? wildcards[0] : null
    Object.keys(tree).forEach(k => {
        // console.log(k);
        // console.log(rules, tree);
        if (rules[k]) {
            // console.log(rules[k]);;
            results = results.concat(recurseEval(rules[k], ruleType, tree[k], contextFn, `${path}/${k}`).map(res => {
                // console.log(res);
                res.path = `${k}/${res.path}`
                return res
            }))
        } else if (wildcard) {
            // console.log("WIldcard", wildcard);
            results = results.concat(recurseEval(rules[wildcard], ruleType, tree[k], path => Object.assign({
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

function mapObject (obj, transform) {
    return Object.keys(obj).map(k => transform(k, obj[k])).reduce((prev, next) => {
        prev[next[0]] = next[1]
        return prev
    }, {})
}

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

    updateFixture (modifications) {
        this.data = this.data.copy(modifications)
        return this
    }

    read (path) {
        this.state = readResults(this.rules, path, this.auth, this.data)
        // console.log(this.state);
        return this
    }

    set (path, value) {
        this.state = writeResults(this.rules, this.auth, this.data, {
            [path]: value
        })
        return this
    }

    update (path, changes) {
        const segments = pathSegments(path)
        this.state = writeResults(this.rules, this.auth, this.data, mapObject(changes, (k, v) => [segments.concat(pathSegments(k)).join('/'), v]))
        return this
    }

    allow (msg, filterRelevant = true) {
        this._ensureResult()
        return this._check(this.state.allowed, 'allowed', msg, filterRelevant)
    }

    deny (msg, filterRelevant = true) {
        this._ensureResult()
        return this._check(!this.state.allowed, 'denied', msg, filterRelevant)
    }

    _check (success, verb, msg, filterRelevant) {
        if (!success) {
            if (filterRelevant) {
                const ws = this.state.details.write
                if (ws) {
                    const newWs = {}
                    Object.keys(ws).filter(p => this.state.allowed ? ws[p].any(r => r.result) : ws[p].every(r => !r.result) ).forEach(p => newWs[p] = ws[p])
                    this.state.details.write = newWs
                }
                const vs = this.state.details.validate
                if (vs) {
                    this.state.details.validate = vs.filter(o => this.state.allowed ? false : !o.result)
                }
                const rs = this.state.details
                if (Array.isArray(rs)) {
                    this.state.details.read = rs.filter(o => this.state.allowed == o.result)
                }
            }
            const errorMessage = `ERROR: Expected ${this.state.method} to be ${verb}. ${msg}`;
            this.results.push(Object.assign({error: true, errorMessage}, this.state))
        } else {
            this.results.push({error: false})
        }
        this.state = null
        return this
    }

    stats () {
        const successCount = this.results.filter(s => s.error === false).length
        if (successCount < this.results.length) {
            this.results.filter(s => typeof s === 'string').forEach(stat => {
                console.log(`${stat}\n`)
            })
            console.log(`FAILED: ${this.results.length - successCount}/${this.results.length} tests failed.`)
        } else {
            console.log(`SUCCESS: ran ${this.results.length}/${this.results.length} tests successfully.`)
        }
        return this.results.length - successCount
    }

    _ensureResult () {
        if (!this.state) {
            throw new Error("No current result.")
        }
    }
}

module.exports = FirebaseRulesTest

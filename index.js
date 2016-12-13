class Auth {
    constructor (uid) {
        this.uid = uid
    }
}

class Snapshot {
    constructor (data) {
        this.data = data
        this.path = []
    }
}

class FirebaseRulesTest {
    constructor (rules) {
        this.rules = rules.rules
        this.auth = null
        this.data = new Snapshot({})
        this.state = null
        this.results = []
    }

    auth (uid) {
        this.auth = uid ? new Auth(uid) : null
        return this
    }

    read (path) {
        var pathComponents = path.split('/').filter(c => c.length > 0)
        var [result, details] = this._evalRead (pathComponents, this.rules)
        this.state = {
            success: result,
            method: 'read',
            details: details
        }
        return this
    }

    allow (msg) {
        return this._check(this.state.success, 'allowed', msg)
    }

    deny (msg) {
        return this._check(!this.state.success, 'denied', msg)
    }

    _check (success, verb, msg) {
        this._ensureResult()
        if (!success) {
            this.results.push(`ERROR: Expected ${this.state.method} to be ${verb}. ${msg}\n${JSON.stringify(this.state.details)}`)
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
        if (path.length == 0) {
            const result = eval(rules['.read'] || 'false')
            return [result, {'': result}]
        } else {
            var result = {}
            if (rules['.read']) {
                if (eval(rules['.read'])) {
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
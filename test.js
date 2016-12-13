const Rules = require('./index.js')

try {
    new Rules({
        'rules': {
            'a': {
                '.read': 'true'
            },
            'c': {
                'd': {
                    '.read': 'true'
                }
            },
            'variable': {
                '$var': {
                    '.read': 'auth.uid === $var',
                    'a': {
                        '.read': 'true'
                    }
                }
            }
        }
    })
    .read('a')
    .allow('everyone should be able to read a')
    .read('b')
    .deny('noone should be able to read b')
    .read('a/b')
    .allow('children of readable nodes should be readable')
    .read('/c')
    .deny('parents of readable nodes should not be readable')
    .read('c/d')
    .allow('deeper paths should be readable if allowed')
    .read('variable/value/a')
    .allow('paths with variables should be handled')
    .authenticate('useruid')
    .read('/variable/useruid/')
    .allow('should be able to read as correct user')
    .read('/variable/otheruid')
    .deny('other node should not be readable')
    .stats()
} catch (e) {
    console.log(`ERROR: Test throws error: '${e}'`)
}

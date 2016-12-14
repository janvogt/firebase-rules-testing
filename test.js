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
            },
            'd': {
                'str': {
                    '.read': 'data.isString()'
                },
                'num': {
                    '.read': 'data.isNumber()'
                },
                'notExists': {
                    '.read': 'data.exists()'
                },
                'bool': {
                    '.read': 'data.isBoolean()'
                },
                'obj': {
                    '.read': 'data.hasChild(\'a/b\')',
                    'a': {
                        '.read': 'data.parent().hasChildren([\'a\', \'b\'])'
                    },
                    'b': {
                        '.read': 'root.child(\'d\').child(\'obj/b\').val() === false'
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
    .fixture({
        'd': {
            'str': 'string',
            'num': 2,
            'bool': true,
            'obj': {
                'a': true,
                'b': false
            }
        }
    })
    .read('d/str')
    .allow('should be able to read string')
    .read('d/num')
    .allow('should be able to read number')
    .read('/d/notExists')
    .deny('should not be able to read not existing data')
    .read('/d/bool/')
    .allow('should be able to read bool')
    .read('d/obj')
    .deny('should not be able to read data with missing child')
    .read('d/obj/a')
    .allow('should be able to read data with existing siblings')
    .read('d/obj/b')
    .allow('should be able to read data with correct value')
    .stats()
} catch (e) {
    console.log(`ERROR: Test throws error: '${e}'`)
}

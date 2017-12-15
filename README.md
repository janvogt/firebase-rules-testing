# Firebase Rules Testing

**Easy testing** of **compiled** firebase rules with **descriptive feedback** on failures.

## Instalation

    npm install firebase-rules-testing

## Motivation

[Firebase](https://firebase.google.com) is a great Tool for easily getting your project up and running. But when you grow security gets more important. Firebase rules are flexible and allow a great extent of custom control. But they get quite fast very complex and difficult to understand. The [Bolt Language and Compiler](https://github.com/firebase/bolt) goes a long way to simplify this complexity and make it manageable.

That's fine until somthing you think should work doesn't. Do debug we still have to check the compiled rules:

Their manual states:
>We welcome experimentation, but ask that you hand-verify the resulting JSON output before using with production applications.
https://github.com/firebase/bolt#-bolt-compiler

So we're back to that complexity. We can use the firebase simulator for simple read and set requests. In real life multilocation updates are often used and enforced by rules. These can't be tested easily.

This package aims to take **all your requests as they** are and test them automatically against **every rule set you generate**. Also you can test requests you don't want to work. In case of failure to meet your assumptions you get **detailed feedback** which **rule** (.read, .write or .validate), on which **path** suceeded and failed with which **environment** (like path variables). Don't spend time seraching for your mistakes use it for fixing them.

### What it is:

- Detailed information for where a request fails.
- Use it for Bolt compiled (syntactically valid) rules.
- Tester for logical mistakes.

### What it is not:

- Syntax checker (typos in rules, illeagal/unsupported functionality in rules)
- Request checker (invalid requests => undefined behavior)

## Project status

We use it in production for a small start-up app. It woks for us, but can be certainly improved - collaboration is more then welcome!

### What's there?
- The environment is complete (root, data, newData, now, auth). That is except for details on the auth-object (everything except auth.uid).
- Server timestamp is supported in request as {'.sv': 'timestamp'}
- Set data from JSON export of your database.
- Get detailed information if test fails: currently as JSON object.
- Every suported feature is used/tested in test.js. This is currently the only documentation as well. I hope the api is quite small and self explanatory.

### What's missing?
- API-documentation
- Nice readable feedback of failed test information (instead of JSON printout)
- coplete auth-object implementation
- althoug it's quite fast (thanks modern JS engines), there are a lots of oportunities for performance improvements.
- your idea?

## Contributors

Thanks goes to these wonderful people ([emoji key](https://github.com/kentcdodds/all-contributors#emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
| [<img src="https://avatars.githubusercontent.com/u/160785?v=3" width="100px;"/><br /><sub>Maik Buchmeyer</sub>](http://www.mediavrog.net/)<br />[💻](https://github.com/janvogt/firebase-rules-testing/commits?author=mediavrog)|
| :---: |
<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/kentcdodds/all-contributors) specification.
Contributions of any kind are welcome!


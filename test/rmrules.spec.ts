import { expect } from 'chai';
import {} from 'jest';
import { Options, Action, rmrules } from '../src/ts/rmrules';
import {} from 'node';
const rework = require('rework');

describe('rmrules', () => {
    function msg(msg) {
        return 'rmrule(\'' + msg + '\')';
    }

    describe('remove dead rules', () => {
        function rmrule(input: string, options: Partial<Options> = { assumeSelectorsNotUsed: [ ".x" ], actOnDeadRules: Action.REMOVE }) {
            return rework(input).use(rmrules(options)).toString({ compress: true });
        }

        it('should remove simple use of x', () => {
            let input = '.x { color: red; }';
            let output = '';
            expect(rmrule(input)).to.equal(output, msg(input));
        });

        it('should keep other class names', () => {
            let input = '.x { color: red; } .other { color: blue; }';
            let output = '.other{color:blue;}';
            expect(rmrule(input)).to.equal(output, msg(input));
        });

        it('should remove rules where X is a parent selector', () => {
            let input = '.x .abc { color: red; } .other { color: blue; }';
            let output = '.other{color:blue;}';
            expect(rmrule(input)).to.equal(output, msg(input));
        });

        it('should remove rules where X has a parent selector', () => {
            let input = '.abc .x { color: red; } .other { color: blue; }';
            let output = '.other{color:blue;}';
            expect(rmrule(input)).to.equal(output, msg(input));
        });

        it('should remove rules where X and Y are classes on the same element, X is first', () => {
            let input = '.abc .x.y { color: red; } .other { color: blue; }';
            let output = '.other{color:blue;}';
            expect(rmrule(input)).to.equal(output, msg(input));
        });

        it('should remove rules where X and Y are classes on the same element, Y is first', () => {
            let input = '.abc .y.x { color: red; } .other { color: blue; }';
            let output = '.other{color:blue;}';
            expect(rmrule(input)).to.equal(output, msg(input));
        });

        it('should keep rules where X is part of a :not clause', () => {
            let input = '.y:not(.x) { color: blue; }';
            let output = '.y:not(.x){color:blue;}';
            expect(rmrule(input)).to.equal(output, msg(input));
        });

        it('should handle tag only selectors', () => {
            let input = 'div { color: blue; }';
            let output = 'div{color:blue;}';
            expect(rmrule(input)).to.equal(output, msg(input));
        });

        it('should handle id only selectors', () => {
            let input = '#other { color: blue; }';
            let output = '#other{color:blue;}';
            expect(rmrule(input)).to.equal(output, msg(input));
        });

        it('should not remove id with same name', () => {
            let input = '#t { color: blue; }';
            let output = '#t{color:blue;}';
            expect(rmrule(input)).to.equal(output, msg(input));
        });
    });

    describe('overridden rules', () => {
        function rmrule(input: string, options: Partial<Options> = { assumeSelectorsSet: [ ".x", "#t", "x" ], actOnOverriddenRules: Action.REMOVE }) {
            return rework(input).use(rmrules(options)).toString({ compress: true });
        }

        it('should remove overridden rule with same selectors', () => {
            let input = '.y { color: red; } .y { color: blue; }';
            let output = '.y{color:blue;}';
            expect(rmrule(input)).to.equal(output, msg(input));
        });

        it('should remove overridden rule with same selectors, classes in different order', () => {
            let input = '.y.z { color: red; } .z.y { color: blue; }';
            let output = '.z.y{color:blue;}';
            expect(rmrule(input)).to.equal(output, msg(input));
        });

        it('should remove overridden rule, more specific with parent selector before', () => {
            let input = '.x .y { color: red; } .y { color: blue; }';
            let output = '.x .y{color:red;}';
            expect(rmrule(input)).to.equal(output, msg(input));
        });

        it('should remove overridden rule, more specific with parent selector after', () => {
            let input = '.y { color: red; } .x .y { color: blue; }';
            let output = '.x .y{color:blue;}';
            expect(rmrule(input)).to.equal(output, msg(input));
        });

        it('should remove overridden rule, more specific with child selector', () => {
            let input = '.y .x { color: red; } .y { color: blue; }';
            let output = '.y .x{color:red;}';
            expect(rmrule(input)).to.equal(output, msg(input));
        });

        it('should remove overridden rule, more specific with extra class', () => {
            let input = '.y.x { color: red; } .y { color: blue; }';
            let output = '.y.x{color:red;}';
            expect(rmrule(input)).to.equal(output, msg(input));
        });

        it('should remove overridden rule, more specific with extra class, classes in different order', () => {
            let input = '.y.z.x { color: red; } .z.y { color: blue; }';
            let output = '.y.z.x{color:red;}';
            expect(rmrule(input)).to.equal(output, msg(input));
        });

        it('should not remove overridden rule if more specific but not always set', () => {
            let input = '.y { color: red; } .y .z { color: blue; }';
            let output = '.y{color:red;}.y .z{color:blue;}';
            expect(rmrule(input)).to.equal(output, msg(input));
        });

        describe('with id', () => {
            it('should remove overridden rule', () => {
                let input = '#y { color: red; } #y { color: blue; }';
                let output = '#y{color:blue;}';
                expect(rmrule(input)).to.equal(output, msg(input));
            });

            it('should not remove rule with different id', () => {
                let input = '#y { color: red; } #z { color: blue; }';
                let output = '#y{color:red;}#z{color:blue;}';
                expect(rmrule(input)).to.equal(output, msg(input));
            });

            it('should not remove rule without id', () => {
                let input = '#y .y { color: red; } .y { color: blue; }';
                let output = '#y .y{color:red;}.y{color:blue;}';
                expect(rmrule(input)).to.equal(output, msg(input));
            });

            it('should not remove rule without id when having class on same element', () => {
                let input = '#y.y { color: red; } .y { color: blue; }';
                let output = '#y.y{color:red;}.y{color:blue;}';
                expect(rmrule(input)).to.equal(output, msg(input));
            });

            it('should remove rule with id assumed always set', () => {
                let input = '#t .y { color: red; } .y { color: blue; }';
                let output = '#t .y{color:red;}';
                expect(rmrule(input)).to.equal(output, msg(input));
            });

            it('should remove rule with id assumed always set having class on same element', () => {
                let input = '#t.y { color: red; } .y { color: blue; }';
                let output = '#t.y{color:red;}';
                expect(rmrule(input)).to.equal(output, msg(input));
            });
        });

        describe('!important', () => {
            it('should not remove overridden rule with !important', () => {
                let input = '.x .y { color: red; } .y { color: blue !important; }';
                let output = '.x .y{color:red;}.y{color:blue !important;}';
                expect(rmrule(input)).to.equal(output, msg(input));
            });
    
            it('should remove overridden rule with !important if overriding also with !important', () => {
                let input = '.x .y { color: red !important; } .y { color: blue !important; }';
                let output = '.x .y{color:red !important;}';
                expect(rmrule(input)).to.equal(output, msg(input));
            });

            it('should remove rule if overriden by !important even if more specific', () => {
                let input = '.y .z { color: red; } .y { color: blue !important; }';
                let output = '.y{color:blue !important;}';
                expect(rmrule(input)).to.equal(output, msg(input));
            });

            it('should not remove rule if overriden by !important but has other classes', () => {
                let input = '.y .z { color: red; } .y .a { color: blue !important; }';
                let output = '.y{color:blue !important;}';
                expect(rmrule(input)).to.equal(output, msg(input));
            });
        });

        describe('multiple occurances of same property', () => {
            it('should remove properties overridden in the same rule', () => {
                let input = '.y { color: red; color: blue; }';
                let output = '.y{color:blue;}';
                expect(rmrule(input)).to.equal(output, msg(input));
            });
        });

        describe('with tag', () => {
            it('should remove overridden rule', () => {
                let input = 'y { color: red; } y { color: blue; }';
                let output = 'y{color:blue;}';
                expect(rmrule(input)).to.equal(output, msg(input));
            });

            it('should not remove rule with different tag', () => {
                let input = 'y { color: red; } z { color: blue; }';
                let output = 'y{color:red;}z{color:blue;}';
                expect(rmrule(input)).to.equal(output, msg(input));
            });

            it('should not remove rule without tag', () => {
                let input = 'y .y { color: red; } .y { color: blue; }';
                let output = 'y .y{color:red;}.y{color:blue;}';
                expect(rmrule(input)).to.equal(output, msg(input));
            });

            it('should not remove rule without tag when having class on same element', () => {
                let input = 'y.y { color: red; } .y { color: blue; }';
                let output = 'y.y{color:red;}.y{color:blue;}';
                expect(rmrule(input)).to.equal(output, msg(input));
            });

            it('should remove rule with tag assumed always set', () => {
                let input = 'x .y { color: red; } .y { color: blue; }';
                let output = 'x .y{color:red;}';
                expect(rmrule(input)).to.equal(output, msg(input));
            });

            it('should remove rule with tag assumed always set having class on same element', () => {
                let input = 'x.y { color: red; } .y { color: blue; }';
                let output = 'x.y{color:red;}';
                expect(rmrule(input)).to.equal(output, msg(input));
            });
        });

        describe('with nesting operator', () => {
            it('empty overrides empty', () => {
                let input = '.y .z { color: red; } .y .z { color: blue; }';
                let output = '.y .z{color:blue;}';
                expect(rmrule(input)).to.equal(output, msg(input));
            });

            it('> overrides >', () => {
                let input = '.y > .z { color: red; } .y > .z { color: blue; }';
                let output = '.y > .z{color:blue;}';
                expect(rmrule(input)).to.equal(output, msg(input));
            });

            it('~ overrides ~', () => {
                let input = '.y ~ .z { color: red; } .y ~ .z { color: blue; }';
                let output = '.y ~ .z{color:blue;}';
                expect(rmrule(input)).to.equal(output, msg(input));
            });

            it('+ overrides +', () => {
                let input = '.y + .z { color: red; } .y + .z { color: blue; }';
                let output = '.y + .z{color:blue;}';
                expect(rmrule(input)).to.equal(output, msg(input));
            });

            it('empty overrides >', () => {
                let input = '.y > .z { color: red; } .y .z { color: blue; }';
                let output = '.y .z{color:blue;}';
                expect(rmrule(input)).to.equal(output, msg(input));
            });

            it('> does not override empty', () => {
                let input = '.y .z { color: red; } .y > .z { color: blue; }';
                let output = '.y .z{color:red;}.y > .z{color:blue;}';
                expect(rmrule(input)).to.equal(output, msg(input));
            });

            it('~ overrides +', () => {
                let input = '.y + .z { color: red; } .y ~ .z { color: blue; }';
                let output = '.y ~ .z{color:blue;}';
                expect(rmrule(input)).to.equal(output, msg(input));
            });

            it('+ does not override ~', () => {
                let input = '.y ~ .z { color: red; } .y + .z { color: blue; }';
                let output = '.y ~ .z{color:red;}.y + .z{color:blue;}';
                expect(rmrule(input)).to.equal(output, msg(input));
            });

            it('+ does not override empty', () => {
                let input = '.y .z { color: red; } .y + .z { color: blue; }';
                let output = '.y .z{color:red;}.y + .z{color:blue;}';
                expect(rmrule(input)).to.equal(output, msg(input));
            });

            it('+ does not override >', () => {
                let input = '.y > .z { color: red; } .y + .z { color: blue; }';
                let output = '.y > .z{color:red;}.y + .z{color:blue;}';
                expect(rmrule(input)).to.equal(output, msg(input));
            });

            it('~ does not override empty', () => {
                let input = '.y .z { color: red; } .y ~ .z { color: blue; }';
                let output = '.y .z{color:red;}.y ~ .z{color:blue;}';
                expect(rmrule(input)).to.equal(output, msg(input));
            });

            it('~ does not override >', () => {
                let input = '.y > .z { color: red; } .y ~ .z { color: blue; }';
                let output = '.y > .z{color:red;}.y ~ .z{color:blue;}';
                expect(rmrule(input)).to.equal(output, msg(input));
            });

            it('> does not override +', () => {
                let input = '.y + .z { color: red; } .y > .z { color: blue; }';
                let output = '.y + .z{color:red;}.y > .z{color:blue;}';
                expect(rmrule(input)).to.equal(output, msg(input));
            });

            it('> does not override ~', () => {
                let input = '.y ~ .z { color: red; } .y > .z { color: blue; }';
                let output = '.y ~ .z{color:red;}.y > .z{color:blue;}';
                expect(rmrule(input)).to.equal(output, msg(input));
            });

            it('empty does not override +', () => {
                let input = '.y + .z { color: red; } .y .z { color: blue; }';
                let output = '.y + .z{color:red;}.y .z{color:blue;}';
                expect(rmrule(input)).to.equal(output, msg(input));
            });

            it('empty does not override ~', () => {
                let input = '.y ~ .z { color: red; } .y .z { color: blue; }';
                let output = '.y ~ .z{color:red;}.y .z{color:blue;}';
                expect(rmrule(input)).to.equal(output, msg(input));
            });

            it('x > y should not override y', () => {
                let input = 'x > y { color: red; } y { color: blue; }';
                let output = 'x > y{color:red;}y{color:blue;}';
                expect(rmrule(input)).to.equal(output, msg(input));
            });

            it('x + y should not override y', () => {
                let input = 'x + y { color: red; } y { color: blue; }';
                let output = 'x + y{color:red;}y{color:blue;}';
                expect(rmrule(input)).to.equal(output, msg(input));
            });

            it('x ~ y should not override y', () => {
                let input = 'x ~ y { color: red; } y { color: blue; }';
                let output = 'x ~ y{color:red;}y{color:blue;}';
                expect(rmrule(input)).to.equal(output, msg(input));
            });

            it('x y should override x > y', () => {
                let input = 'x > y { color: red; } x y { color: blue; }';
                let output = 'x y{color:blue;}';
                expect(rmrule(input)).to.equal(output, msg(input));
            });

            it('x y should not override x + y', () => {
                let input = 'x + y { color: red; } x y { color: blue; }';
                let output = 'x + y{color:red;}x y{color:blue;}';
                expect(rmrule(input)).to.equal(output, msg(input));
            });

            it('x y should not override x ~ y', () => {
                let input = 'x ~ y { color: red; } x y { color: blue; }';
                let output = 'x ~ y{color:red;}x y{color:blue;}';
                expect(rmrule(input)).to.equal(output, msg(input));
            });
        });

        describe('attributes', () => {
            it('should remove overridden rule', () => {
                let input = '[target="_blank"] { color: red; } [target="_blank"] { color: blue; }';
                let output = '[target="_blank"]{color:blue;}';
                expect(rmrule(input)).to.equal(output, msg(input));
            });

            it('should not remove rule with different attribute', () => {
                let input = '[target="_blank"] { color: red; } [target="_top"] { color: blue; }';
                let output = '[target="_blank"]{color:red;}[target="_top"]{color:blue;}';
                expect(rmrule(input)).to.equal(output, msg(input));
            });

            it('should not remove rule without attribute', () => {
                let input = 'a { color: red; } a[target="_blank"] { color: blue; }';
                let output = 'a{color:red;}a[target="_blank"]{color:blue;}';
                expect(rmrule(input)).to.equal(output, msg(input));
            });

            it('should not remove rule with less attributes', () => {
                let input = 'a[target="_blank"] { color: red; } a[data="a"][data="a"] { color: blue; }';
                let output = 'a[target="_blank"]{color:red;}a[data="a"][data="a"]{color:blue;}';
                expect(rmrule(input)).to.equal(output, msg(input));
            });
        });


        describe('pseudos', () => {
            it('should remove overridden rule', () => {
                let input = ':before { color: red; } :before { color: blue; }';
                let output = ':before{color:blue;}';
                expect(rmrule(input)).to.equal(output, msg(input));
            });

            it('should not remove rule with different pseudo element', () => {
                let input = ':before { color: red; } :after { color: blue; }';
                let output = ':before{color:red;}:after{color:blue;}';
                expect(rmrule(input)).to.equal(output, msg(input));
            });

            it('should not remove rule without pseudo element', () => {
                let input = 'div { color: red; } div:before { color: blue; }';
                let output = 'div{color:red;}div:before{color:blue;}';
                expect(rmrule(input)).to.equal(output, msg(input));
            });

            it('should not remove rule with less pseudo elements', () => {
                let input = 'a:before { color: red; } a:before:hover { color: blue; }';
                let output = 'a:before{color:red;}a:before:hover{color:blue;}';
                expect(rmrule(input)).to.equal(output, msg(input));
            });
        });

        it('should only remove overridden declarations of a rule', () => {
            let input = '.y { color: red; background: green; } .y { color: blue; }';
            let output = '.y{background:green;}.y{color:blue;}';
            expect(rmrule(input)).to.equal(output, msg(input));
        });

        it ('should only remove the affeted rule when several rules have the same declaration', () => {
            let input = '.y, .z { color: red; } .y { color: blue; }';
            let output = '.z{color:red;}.y{color:blue;}';
            expect(rmrule(input)).to.equal(output, msg(input));
        });

        it ('should not remove a rule if all declarations are not overridden', () => {
            let input = '.y, .z { color: red; background: green; } .y { color: blue; }';
            let output = '.y,.z{color:red;background:green;}.y{color:blue;}';
            expect(rmrule(input)).to.equal(output, msg(input));
        });

        it ('should remove a rule if all declarations are overridden', () => {
            let input = '.y, .z { color: red; background: green; } .y { color: blue; } .z { color: blue; }';
            let output = '.y,.z{background:green;}.y{color:blue;}.z{color:blue;}';
            expect(rmrule(input)).to.equal(output, msg(input));
        });

        it ('should not remove a rule if all declarations are not overridden', () => {
            let input = '.y, .z { color: red; background: green; } .y { color: blue; }';
            let output = '.y,.z{color:red;background:green;}.y{color:blue;}';
            expect(rmrule(input)).to.equal(output, msg(input));
        });
    });

    describe('body', () => {
        function rmrule(input: string, options: Partial<Options> = { actOnInvalidBodyRules: Action.REMOVE }) {
            return rework(input).use(rmrules(options)).toString({ compress: true });
        }

        it('should remove rules where body is not the first part of a selector', () => {
            let input = '.y body { color: red; background: green; } .z { color: blue; }';
            let output = '.z{color:blue;}';
            expect(rmrule(input)).to.equal(output, msg(input));
        });

        it('should remove rules where body with class is not the first part of a selector', () => {
            let input = '.y body.x { color: red; background: green; } .z { color: blue; }';
            let output = '.z{color:blue;}';
            expect(rmrule(input)).to.equal(output, msg(input));
        });

        it('should not remove rules where body is the first part of a selector', () => {
            let input = 'body .y { color: red; background: green; } .z { color: blue; }';
            let output = 'body .y{color:red;background:green;}.z{color:blue;}';
            expect(rmrule(input)).to.equal(output, msg(input));
        });

        it('should not remove rules where body with a class is the first part of a selector', () => {
            let input = 'body.x .y { color: red; background: green; } .z { color: blue; }';
            let output = 'body.x .y{color:red;background:green;}.z{color:blue;}';
            expect(rmrule(input)).to.equal(output, msg(input));
        });
    });

    describe('error', () => {
        function rmrule(input: string, options: Partial<Options> = { assumeSelectorsNotUsed: [ ".x" ], actOnDeadRules: Action.ERROR, actOnOverriddenRules: Action.ERROR, maxReported: 1 }) {
            return () => rework(input).use(rmrules(options)).toString({ compress: true });
        }

        it('should error about simple use of x', () => {
            let input = '.x { color: red; }';
            expect(rmrule(input)).to.throw();
        });

        it('should error about overridden rule with same selectors', () => {
            let input = '.y { color: red; } .y { color: blue; }';
            expect(rmrule(input)).to.throw();
        });

        it('should only error about the first error encountered', () => {
            let input = '.x { color: red; } .x { background: blue; }';
            expect(rmrule(input)).to.throw();
        });
    });

    describe('warn', () => {
        function rmrule(input: string, options: Partial<Options> = { assumeSelectorsNotUsed: [ ".x" ], actOnDeadRules: Action.WARN, actOnOverriddenRules: Action.WARN, maxReported: 1 }) {
            return () => rework(input).use(rmrules(options)).toString({ compress: true });
        }

        it('should warn about simple use of x', () => {
            let input = '.x{color:red;}';
            expect(rmrule(input)()).to.equal(input, msg(input));
        });

        it('should warn about overridden rule with same selectors', () => {
            let input = '.y{color:red;}.y{color:blue;}';
            expect(rmrule(input)()).to.equal(input, msg(input));
        });

        it('should only warn about the first warning encountered', () => {
            let input = '.x{color:red;}.x{background:blue;}';
            expect(rmrule(input)()).to.equal(input, msg(input));
        });
    });

    describe('ignore', () => {
        function rmrule(input: string, options: Partial<Options> = { assumeSelectorsNotUsed: [ ".x" ], actOnDeadRules: Action.IGNORE, actOnOverriddenRules: Action.IGNORE, maxReported: 1 }) {
            return () => rework(input).use(rmrules(options)).toString({ compress: true });
        }

        it('should ignore simple use of x', () => {
            let input = '.x{color:red;}';
            expect(rmrule(input)()).to.equal(input, msg(input));
        });

        it('should ignore overridden rule with same selectors', () => {
            let input = '.y{color:red;}.y{color:blue;}';
            expect(rmrule(input)()).to.equal(input, msg(input));
        });
    });

    describe('can parse', () => {
        function rmrule(input: string) {
            return rework(input).use(rmrules()).toString({ compress: true });
        }

        it('can parse @charset rules', () => {
            let input = '@charset "utf-8";';
            let output = '@charset "utf-8";';
            expect(rmrule(input)).to.equal(output, msg(input));
        });

        it('can parse @custom-media rules', () => {
            let input = '@custom-media --breakpoint-sm (min-width: 40em);';
            let output = '@custom-media --breakpoint-sm (min-width: 40em);';
            expect(rmrule(input)).to.equal(output, msg(input));
        });

        it('can parse @document rules', () => {
            let input = '@document url("https://www.example.com/") { .other { color: blue; } }';
            let output = '@document url("https://www.example.com/"){.other{color:blue;}}';
            expect(rmrule(input)).to.equal(output, msg(input));
        });

        it('can parse @font-face rules', () => {
            let input = '@font-face { font-family: font; src: url(font.tff); }';
            let output = '@font-face{font-family:font;src:url(font.tff);}';
            expect(rmrule(input)).to.equal(output, msg(input));
        });

        it('can parse @host rules', () => {
            let input = '@host { .other { color: blue; } }';
            let output = '@host{.other{color:blue;}}';
            expect(rmrule(input)).to.equal(output, msg(input));
        });

        it('can parse @import rules', () => {
            let input = '@import url("other.css") print;';
            let output = '@import url("other.css") print;';
            expect(rmrule(input)).to.equal(output, msg(input));
        });

        it('can parse @keyframes rules', () => {
            let input = '@keyframes move { from { color: red; } to { color: blue; } }';
            let output = '@keyframes move{from{color:red;}to{color:blue;}}';
            expect(rmrule(input)).to.equal(output, msg(input));
        });

        it('can parse @media rules', () => {
            let input = '@media screen and (min-width: 100px) { .other { color: blue; } }';
            let output = '@media screen and (min-width: 100px){.other{color:blue;}}';
            expect(rmrule(input)).to.equal(output, msg(input));
        });

        it('can parse @namespace rules', () => {
            let input = '@namespace url(http://www.w3.org/1999/xhtml);';
            let output = '@namespace url(http://www.w3.org/1999/xhtml);';
            expect(rmrule(input)).to.equal(output, msg(input));
        });

        it('can parse @page rules', () => {
            let input = '@page { margin: 1cm; }';
            let output = '@page {margin:1cm;}';
            expect(rmrule(input)).to.equal(output, msg(input));
        });

        it('can parse @supports rules', () => {
            let input = '@supports (display: flex) { .other { display: flex; } }';
            let output = '@supports (display: flex){.other{display:flex;}}';
            expect(rmrule(input)).to.equal(output, msg(input));
        });

        it('can parse empty document', () => {
            let input = '';
            let output = '';
            expect(rmrule(input)).to.equal(output, msg(input));
        });
    });
});

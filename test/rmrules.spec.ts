import { expect } from 'chai';
import {} from 'jest';
import { Options, Action, rmrules } from '../src/ts/rmrules';
import {} from 'node';
const rework = require('rework');

describe('rmrules', () => {

    describe('remove dead rules', () => {
        function rmrule(input: string, options: Options = { assumeSelectorsNotUsed: [ ".x" ], deadRules: Action.REMOVE }) {
            return rework(input).use(rmrules(options)).toString({ compress: true });
        }

        it('should remove simple use of x', () => {
            let input = '.x { color: red; }';
            let output = '';
            expect(rmrule(input)).to.equal(output);
        });

        it('should keep other class names', () => {
            let input = '.x { color: red; } .other { color: blue; }';
            let output = '.other{color:blue;}';
            expect(rmrule(input)).to.equal(output);
        });

        it('should remove rules where X is a parent selector', () => {
            let input = '.x .abc { color: red; } .other { color: blue; }';
            let output = '.other{color:blue;}';
            expect(rmrule(input)).to.equal(output);
        });

        it('should remove rules where X has a parent selector', () => {
            let input = '.abc .x { color: red; } .other { color: blue; }';
            let output = '.other{color:blue;}';
            expect(rmrule(input)).to.equal(output);
        });

        it('should remove rules where X and Y are classes on the same element, X is first', () => {
            let input = '.abc .x.y { color: red; } .other { color: blue; }';
            let output = '.other{color:blue;}';
            expect(rmrule(input)).to.equal(output);
        });

        it('should remove rules where X and Y are classes on the same element, Y is first', () => {
            let input = '.abc .y.x { color: red; } .other { color: blue; }';
            let output = '.other{color:blue;}';
            expect(rmrule(input)).to.equal(output);
        });

        it('should keep rules where X is part of a :not clause', () => {
            let input = '.y:not(.x) { color: blue; }';
            let output = '.y:not(.x){color:blue;}';
            expect(rmrule(input)).to.equal(output);
        });

        it('should handle tag only selectors', () => {
            let input = 'div { color: blue; }';
            let output = 'div{color:blue;}';
            expect(rmrule(input)).to.equal(output);
        });

        it('should handle id only selectors', () => {
            let input = '#other { color: blue; }';
            let output = '#other{color:blue;}';
            expect(rmrule(input)).to.equal(output);
        });

        it('should not remove id with same name', () => {
            let input = '#x { color: blue; }';
            let output = '#x{color:blue;}';
            expect(rmrule(input)).to.equal(output);
        });
    });

    describe('overridden rules', () => {
        function rmrule(input: string, options: Options = { assumeSelectorsSet: [ ".x", "#x", "x" ], overriddenRules: Action.REMOVE }) {
            return rework(input).use(rmrules(options)).toString({ compress: true });
        }

        it('should remove overridden rule with same selectors', () => {
            let input = '.y { color: red; } .y { color: blue; }';
            let output = '.y{color:blue;}';
            expect(rmrule(input)).to.equal(output);
        });

        it('should remove overridden rule with same selectors, classes in different order', () => {
            let input = '.y.z { color: red; } .z.y { color: blue; }';
            let output = '.z.y{color:blue;}';
            expect(rmrule(input)).to.equal(output);
        });

        it('should remove overridden rule, more specific with parent selector before', () => {
            let input = '.x .y { color: red; } .y { color: blue; }';
            let output = '.x .y{color:red;}';
            expect(rmrule(input)).to.equal(output);
        });

        it('should remove overridden rule, more specific with parent selector after', () => {
            let input = '.y { color: red; } .x .y { color: blue; }';
            let output = '.x .y{color:blue;}';
            expect(rmrule(input)).to.equal(output);
        });

        it('should remove overridden rule, more specific with child selector', () => {
            let input = '.y .x { color: red; } .y { color: blue; }';
            let output = '.y .x{color:red;}';
            expect(rmrule(input)).to.equal(output);
        });

        it('should remove overridden rule, more specific with extra class', () => {
            let input = '.y.x { color: red; } .y { color: blue; }';
            let output = '.y.x{color:red;}';
            expect(rmrule(input)).to.equal(output);
        });

        it('should remove overridden rule, more specific with extra class, classes in different order', () => {
            let input = '.y.z.x { color: red; } .z.y { color: blue; }';
            let output = '.y.z.x{color:red;}';
            expect(rmrule(input)).to.equal(output);
        });

        it('should not remove overridden rule if more specific but not always set', () => {
            let input = '.y { color: red; } .y .z { color: blue; }';
            let output = '.y{color:red;}.y .z{color:blue;}';
            expect(rmrule(input)).to.equal(output);
        });

        describe('with id', () => {
            it('should remove overridden rule', () => {
                let input = '#y { color: red; } #y { color: blue; }';
                let output = '#y{color:blue;}';
                expect(rmrule(input)).to.equal(output);
            });

            it('should not remove rule with different id', () => {
                let input = '#y { color: red; } #z { color: blue; }';
                let output = '#y{color:red;}#z{color:blue;}';
                expect(rmrule(input)).to.equal(output);
            });

            it('should not remove rule without id', () => {
                let input = '#y .y { color: red; } .y { color: blue; }';
                let output = '#y .y{color:red;}.y{color:blue;}';
                expect(rmrule(input)).to.equal(output);
            });

            it('should not remove rule without id when having class on same element', () => {
                let input = '#y.y { color: red; } .y { color: blue; }';
                let output = '#y.y{color:red;}.y{color:blue;}';
                expect(rmrule(input)).to.equal(output);
            });

            it('should remove rule with id assumed always set', () => {
                let input = '#x .y { color: red; } .y { color: blue; }';
                let output = '#x .y{color:red;}';
                expect(rmrule(input)).to.equal(output);
            });

            it('should remove rule with id assumed always set having class on same element', () => {
                let input = '#x.y { color: red; } .y { color: blue; }';
                let output = '#x.y{color:red;}';
                expect(rmrule(input)).to.equal(output);
            });
        });

        describe('with tag', () => {
            it('should remove overridden rule', () => {
                let input = 'y { color: red; } y { color: blue; }';
                let output = 'y{color:blue;}';
                expect(rmrule(input)).to.equal(output);
            });

            it('should not remove rule with different tag', () => {
                let input = 'y { color: red; } z { color: blue; }';
                let output = 'y{color:red;}z{color:blue;}';
                expect(rmrule(input)).to.equal(output);
            });

            it('should not remove rule without tag', () => {
                let input = 'y .y { color: red; } .y { color: blue; }';
                let output = 'y .y{color:red;}.y{color:blue;}';
                expect(rmrule(input)).to.equal(output);
            });

            it('should not remove rule without tag when having class on same element', () => {
                let input = 'y.y { color: red; } .y { color: blue; }';
                let output = 'y.y{color:red;}.y{color:blue;}';
                expect(rmrule(input)).to.equal(output);
            });

            it('should remove rule with tag assumed always set', () => {
                let input = 'x .y { color: red; } .y { color: blue; }';
                let output = 'x .y{color:red;}';
                expect(rmrule(input)).to.equal(output);
            });

            it('should remove rule with tag assumed always set having class on same element', () => {
                let input = 'x.y { color: red; } .y { color: blue; }';
                let output = 'x.y{color:red;}';
                expect(rmrule(input)).to.equal(output);
            });
        });

        describe('with nesting operator', () => {
            it('empty overrides empty', () => {
                let input = '.y .z { color: red; } .y .z { color: blue; }';
                let output = '.y .z{color:blue;}';
                expect(rmrule(input)).to.equal(output);
            });

            it('> overrides >', () => {
                let input = '.y > .z { color: red; } .y > .z { color: blue; }';
                let output = '.y > .z{color:blue;}';
                expect(rmrule(input)).to.equal(output);
            });

            it('~ overrides ~', () => {
                let input = '.y ~ .z { color: red; } .y ~ .z { color: blue; }';
                let output = '.y ~ .z{color:blue;}';
                expect(rmrule(input)).to.equal(output);
            });

            it('+ overrides +', () => {
                let input = '.y + .z { color: red; } .y + .z { color: blue; }';
                let output = '.y + .z{color:blue;}';
                expect(rmrule(input)).to.equal(output);
            });

            it('empty overrides >', () => {
                let input = '.y > .z { color: red; } .y .z { color: blue; }';
                let output = '.y .z{color:blue;}';
                expect(rmrule(input)).to.equal(output);
            });

            it('> does not override empty', () => {
                let input = '.y .z { color: red; } .y > .z { color: blue; }';
                let output = '.y .z{color:red;}.y > .z{color:blue;}';
                expect(rmrule(input)).to.equal(output);
            });

            it('~ overrides +', () => {
                let input = '.y + .z { color: red; } .y ~ .z { color: blue; }';
                let output = '.y ~ .z{color:blue;}';
                expect(rmrule(input)).to.equal(output);
            });

            it('+ does not override ~', () => {
                let input = '.y ~ .z { color: red; } .y + .z { color: blue; }';
                let output = '.y ~ .z{color:red;}.y + .z{color:blue;}';
                expect(rmrule(input)).to.equal(output);
            });

            it('+ does not override empty', () => {
                let input = '.y .z { color: red; } .y + .z { color: blue; }';
                let output = '.y .z{color:red;}.y + .z{color:blue;}';
                expect(rmrule(input)).to.equal(output);
            });

            it('+ does not override >', () => {
                let input = '.y > .z { color: red; } .y + .z { color: blue; }';
                let output = '.y > .z{color:red;}.y + .z{color:blue;}';
                expect(rmrule(input)).to.equal(output);
            });

            it('~ does not override empty', () => {
                let input = '.y .z { color: red; } .y ~ .z { color: blue; }';
                let output = '.y .z{color:red;}.y ~ .z{color:blue;}';
                expect(rmrule(input)).to.equal(output);
            });

            it('~ does not override >', () => {
                let input = '.y > .z { color: red; } .y ~ .z { color: blue; }';
                let output = '.y > .z{color:red;}.y ~ .z{color:blue;}';
                expect(rmrule(input)).to.equal(output);
            });

            it('> does not override +', () => {
                let input = '.y + .z { color: red; } .y > .z { color: blue; }';
                let output = '.y + .z{color:red;}.y > .z{color:blue;}';
                expect(rmrule(input)).to.equal(output);
            });

            it('> does not override ~', () => {
                let input = '.y ~ .z { color: red; } .y > .z { color: blue; }';
                let output = '.y ~ .z{color:red;}.y > .z{color:blue;}';
                expect(rmrule(input)).to.equal(output);
            });

            it('empty does not override +', () => {
                let input = '.y + .z { color: red; } .y .z { color: blue; }';
                let output = '.y + .z{color:red;}.y .z{color:blue;}';
                expect(rmrule(input)).to.equal(output);
            });

            it('empty does not override ~', () => {
                let input = '.y ~ .z { color: red; } .y .z { color: blue; }';
                let output = '.y ~ .z{color:red;}.y .z{color:blue;}';
                expect(rmrule(input)).to.equal(output);
            });

            it('x > y should not override y', () => {
                let input = 'x > y { color: red; } y { color: blue; }';
                let output = 'x > y{color:red;}y{color:blue;}';
                expect(rmrule(input)).to.equal(output);
            });

            it('x + y should not override y', () => {
                let input = 'x + y { color: red; } y { color: blue; }';
                let output = 'x + y{color:red;}y{color:blue;}';
                expect(rmrule(input)).to.equal(output);
            });

            it('x ~ y should not override y', () => {
                let input = 'x ~ y { color: red; } y { color: blue; }';
                let output = 'x ~ y{color:red;}y{color:blue;}';
                expect(rmrule(input)).to.equal(output);
            });

            it('x y should override x > y', () => {
                let input = 'x > y { color: red; } x y { color: blue; }';
                let output = 'x y{color:blue;}';
                expect(rmrule(input)).to.equal(output);
            });

            it('x y should not override x + y', () => {
                let input = 'x + y { color: red; } x y { color: blue; }';
                let output = 'x + y{color:red;}x y{color:blue;}';
                expect(rmrule(input)).to.equal(output);
            });

            it('x y should not override x ~ y', () => {
                let input = 'x ~ y { color: red; } x y { color: blue; }';
                let output = 'x ~ y{color:red;}x y{color:blue;}';
                expect(rmrule(input)).to.equal(output);
            });
        });

        describe('attributes', () => {
            it('should remove overridden rule', () => {
                let input = '[target="_blank"] { color: red; } [target="_blank"] { color: blue; }';
                let output = '[target="_blank"]{color:blue;}';
                expect(rmrule(input)).to.equal(output);
            });

            it('should not remove rule with different attribute', () => {
                let input = '[target="_blank"] { color: red; } [target="_top"] { color: blue; }';
                let output = '[target="_blank"]{color:red;}[target="_top"]{color:blue;}';
                expect(rmrule(input)).to.equal(output);
            });

            it('should not remove rule without attribute', () => {
                let input = 'a[target="_blank"] { color: red; } a { color: blue; }';
                let output = 'a[target="_blank"]{color:red;}a{color:blue;}';
                expect(rmrule(input)).to.equal(output);
            });
        });

        it('should only remove overridden declarations of a rule', () => {
            let input = '.y { color: red; background: green; } .y { color: blue; }';
            let output = '.y{background:green;}.y{color:blue;}';
            expect(rmrule(input)).to.equal(output);
        });

        it ('should only remove the affeted rule when several rules have the same declaration', () => {
            let input = '.y, .z { color: red; } .y { color: blue; }';
            let output = '.z{color:red;}.y{color:blue;}';
            expect(rmrule(input)).to.equal(output);
        });

        it ('should not remove a rule if all declarations are not overridden', () => {
            let input = '.y, .z { color: red; background: green; } .y { color: blue; }';
            let output = '.y,.z{color:red;background:green;}.y{color:blue;}';
            expect(rmrule(input)).to.equal(output);
        });

        /* TODO: leave for later, it's a tricky corner case
        it ('should not remove a rule if all declarations are not overridden', () => {
            let input = '.y, .z { color: red; background: green; } .y { color: blue; } .z { color: blue; }';
            let output = '.y,.z{background:green;}.y{color:blue;},.z{color:blue;}';
            expect(rmrule(input)).to.equal(output);
        });
        */
    });

    describe('can parse', () => {
        function rmrule(input: string) {
            return rework(input).use(rmrules()).toString({ compress: true });
        }

        it('can parse @charset rules', () => {
            let input = '@charset "utf-8";';
            let output = '@charset "utf-8";';
            expect(rmrule(input)).to.equal(output);
        });

        it('can parse @custom-media rules', () => {
            let input = '@custom-media --breakpoint-sm (min-width: 40em);';
            let output = '@custom-media --breakpoint-sm (min-width: 40em);';
            expect(rmrule(input)).to.equal(output);
        });

        it('can parse @document rules', () => {
            let input = '@document url("https://www.example.com/") { .other { color: blue; } }';
            let output = '@document url("https://www.example.com/"){.other{color:blue;}}';
            expect(rmrule(input)).to.equal(output);
        });

        it('can parse @font-face rules', () => {
            let input = '@font-face { font-family: font; src: url(font.tff); }';
            let output = '@font-face{font-family:font;src:url(font.tff);}';
            expect(rmrule(input)).to.equal(output);
        });

        it('can parse @host rules', () => {
            let input = '@host { .other { color: blue; } }';
            let output = '@host{.other{color:blue;}}';
            expect(rmrule(input)).to.equal(output);
        });

        it('can parse @import rules', () => {
            let input = '@import url("other.css") print;';
            let output = '@import url("other.css") print;';
            expect(rmrule(input)).to.equal(output);
        });

        it('can parse @keyframes rules', () => {
            let input = '@keyframes move { from { color: red; } to { color: blue; } }';
            let output = '@keyframes move{from{color:red;}to{color:blue;}}';
            expect(rmrule(input)).to.equal(output);
        });

        it('can parse @media rules', () => {
            let input = '@media screen and (min-width: 100px) { .other { color: blue; } }';
            let output = '@media screen and (min-width: 100px){.other{color:blue;}}';
            expect(rmrule(input)).to.equal(output);
        });

        it('can parse @namespace rules', () => {
            let input = '@namespace url(http://www.w3.org/1999/xhtml);';
            let output = '@namespace url(http://www.w3.org/1999/xhtml);';
            expect(rmrule(input)).to.equal(output);
        });

        it('can parse @page rules', () => {
            let input = '@page { margin: 1cm; }';
            let output = '@page {margin:1cm;}';
            expect(rmrule(input)).to.equal(output);
        });

        it('can parse @supports rules', () => {
            let input = '@supports (display: flex) { .other { display: flex; } }';
            let output = '@supports (display: flex){.other{display:flex;}}';
            expect(rmrule(input)).to.equal(output);
        });

        it('can parse empty document', () => {
            let input = '';
            let output = '';
            expect(rmrule(input)).to.equal(output);
        });
    });
});

import { expect } from 'chai';
import {} from 'jest';
import { Options, rmrules } from '../src/ts/rmrules';
import {} from 'node';
const rework = require('rework');

describe('rmrules', () => {

    function rmrule(input: string, options?: Options) {
        return rework(input).use(rmrules(options)).toString({ compress: true });
    }

    it('should remove simple use of x', () => {
        let input = '.x { color: red; }';
        let output = '';
        expect(rmrule(input, { assumeSelectorsNotUsed: [ '.x' ]})).to.equal(output);
    });

    it('should keep other class names', () => {
        let input = '.x { color: red; } .other { color: blue; }';
        let output = '.other{color:blue;}';
        expect(rmrule(input, { assumeSelectorsNotUsed: [ '.x' ]})).to.equal(output);
    });

    it('should remove rules where X is a parent selector', () => {
        let input = '.x .abc { color: red; } .other { color: blue; }';
        let output = '.other{color:blue;}';
        expect(rmrule(input, { assumeSelectorsNotUsed: [ '.x' ]})).to.equal(output);
    });

    it('should remove rules where X has a parent selector', () => {
        let input = '.abc .x { color: red; } .other { color: blue; }';
        let output = '.other{color:blue;}';
        expect(rmrule(input, { assumeSelectorsNotUsed: [ '.x' ]})).to.equal(output);
    });

    it('should remove rules where X and Y are classes on the same element, X is first', () => {
        let input = '.abc .x.y { color: red; } .other { color: blue; }';
        let output = '.other{color:blue;}';
        expect(rmrule(input, { assumeSelectorsNotUsed: [ '.x' ]})).to.equal(output);
    });

    it('should remove rules where X and Y are classes on the same element, Y is first', () => {
        let input = '.abc .y.x { color: red; } .other { color: blue; }';
        let output = '.other{color:blue;}';
        expect(rmrule(input, { assumeSelectorsNotUsed: [ '.x' ]})).to.equal(output);
    });

    it('should keep rules where X is part of a :not clause', () => {
        let input = '.y:not(.x) { color: blue; }';
        let output = '.y:not(.x){color:blue;}';
        expect(rmrule(input, { assumeSelectorsNotUsed: [ '.x' ]})).to.equal(output);
    });

    it('should handle tag only selectors', () => {
        let input = 'div { color: blue; }';
        let output = 'div{color:blue;}';
        expect(rmrule(input, { assumeSelectorsNotUsed: [ '.x' ]})).to.equal(output);
    });

    it('should handle id only selectors', () => {
        let input = '#other { color: blue; }';
        let output = '#other{color:blue;}';
        expect(rmrule(input, { assumeSelectorsNotUsed: [ '.x' ]})).to.equal(output);
    });

    it('should not remove id with same name', () => {
        let input = '#x { color: blue; }';
        let output = '#x{color:blue;}';
        expect(rmrule(input, { assumeSelectorsNotUsed: [ '.x' ]})).to.equal(output);
    });

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

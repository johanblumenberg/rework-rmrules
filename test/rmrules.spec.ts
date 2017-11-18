import { expect } from 'chai';
import {} from 'jest';
import rmrules from '../src/ts/rmrules';
import {} from 'node';
const rework = require('rework');

describe('rmrules', () => {
    it('should remove simple use of x', () => {
        let input = '.x { color: red; }'
        let output = '';
        expect(rework(input).use(rmrules({ assumeSelectorsNotUsed: [ '.x' ]})).toString({ compress: true })).to.equal(output);
    });

    it('should keep other class names', () => {
        let input = '.x { color: red; } .other { color: blue; }'
        let output = '.other{color:blue;}';
        expect(rework(input).use(rmrules({ assumeSelectorsNotUsed: [ '.x' ]})).toString({ compress: true })).to.equal(output);
    });

    it('should remove rules where X is a parent selector', () => {
        let input = '.x .abc { color: red; } .other { color: blue; }'
        let output = '.other{color:blue;}';
        expect(rework(input).use(rmrules({ assumeSelectorsNotUsed: [ '.x' ]})).toString({ compress: true })).to.equal(output);
    });

    it('should remove rules where X has a parent selector', () => {
        let input = '.abc .x { color: red; } .other { color: blue; }'
        let output = '.other{color:blue;}';
        expect(rework(input).use(rmrules({ assumeSelectorsNotUsed: [ '.x' ]})).toString({ compress: true })).to.equal(output);
    });

    it('should remove rules where X and Y are classes on the same element, X is first', () => {
        let input = '.abc .x.y { color: red; } .other { color: blue; }'
        let output = '.other{color:blue;}';
        expect(rework(input).use(rmrules({ assumeSelectorsNotUsed: [ '.x' ]})).toString({ compress: true })).to.equal(output);
    });

    it('should remove rules where X and Y are classes on the same element, Y is first', () => {
        let input = '.abc .y.x { color: red; } .other { color: blue; }'
        let output = '.other{color:blue;}';
        expect(rework(input).use(rmrules({ assumeSelectorsNotUsed: [ '.x' ]})).toString({ compress: true })).to.equal(output);
    });

    it('should keep rules where X is part of a :not clause', () => {
        let input = '.y:not(.x) { color: blue; }'
        let output = '.y:not(.x){color:blue;}';
        expect(rework(input).use(rmrules({ assumeSelectorsNotUsed: [ '.x' ]})).toString({ compress: true })).to.equal(output);
    });

    it('should handle tag only selectors', () => {
        let input = 'div { color: blue; }'
        let output = 'div{color:blue;}';
        expect(rework(input).use(rmrules({ assumeSelectorsNotUsed: [ '.x' ]})).toString({ compress: true })).to.equal(output);
    });

    it('should handle id only selectors', () => {
        let input = '#other { color: blue; }'
        let output = '#other{color:blue;}';
        expect(rework(input).use(rmrules({ assumeSelectorsNotUsed: [ '.x' ]})).toString({ compress: true })).to.equal(output);
    });

    it('should not remove id with same name', () => {
        let input = '#x { color: blue; }'
        let output = '#x{color:blue;}';
        expect(rework(input).use(rmrules({ assumeSelectorsNotUsed: [ '.x' ]})).toString({ compress: true })).to.equal(output);
    });
});

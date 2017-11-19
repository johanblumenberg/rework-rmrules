import { Stylesheet, StyleRules, Rule, Node } from 'css';
const CssSelectorParser = require('css-selector-parser').CssSelectorParser;

const parser = new CssSelectorParser();
parser.registerNestingOperators('>', '+', '~');

export interface Options {
    assumeSelectorsNotUsed?: string[];
}

function ruleUsesAnyOf(rule: any, anyOf: string[]): boolean {
    if (rule.classNames) {
        let anyOfClasses = anyOf.filter(sel => sel[0] === '.').map(sel => sel.substr(1));
        if(rule.classNames.some((className: string) => anyOfClasses.indexOf(className) >= 0)) {
            return true;
        } else if (rule.rule) {
            return ruleUsesAnyOf(rule.rule, anyOf);
        }
    }
    return false;
}

function selectorUsesAnyOf(selector: any, anyOf: string[]): boolean {
    if (selector.type === 'ruleSet') {
        return ruleUsesAnyOf(selector.rule, anyOf);
    }
    return false;
}

function toRule<T extends Node>(rule: T): Rule | undefined {
    if (rule.type === 'rule') {
        return <Rule>rule;
    }
}

export function rmrules(options: Options = {}): (style: StyleRules) => void {
    let removeSelectors = options.assumeSelectorsNotUsed || [];

    return (styles: StyleRules) => {
        styles.rules = styles.rules.filter(rule => {
            let _rule = toRule(rule);
            if (_rule && _rule.selectors) {
                _rule.selectors = _rule.selectors.filter((selector: string) => !selectorUsesAnyOf(parser.parse(selector), removeSelectors));
                return _rule.selectors.length > 0;
            } else {
                return true;
            }
        });
    }
}

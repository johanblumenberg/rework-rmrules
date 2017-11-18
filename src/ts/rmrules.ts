import { Stylesheet, Rule } from 'css';
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

export let stylesheet: Stylesheet;
export type Style = typeof stylesheet.stylesheet;

function toRule<T>(rule: T): Rule | undefined {
    if ((<any>rule).type === 'rule') {
        return <Rule>rule;
    }
}

export default function rmrules(options: Options): (style: Style) => void {
    let removeSelectors = options.assumeSelectorsNotUsed || [];

    return (styles: Style) => {
        if (styles && styles.rules) {
            styles.rules = styles.rules.filter(rule => {
                let _rule: Rule | undefined;
                if ((_rule = toRule(rule)) && _rule.selectors) {
                    _rule.selectors = _rule.selectors.filter((selector: string) => !selectorUsesAnyOf(parser.parse(selector), removeSelectors));
                    return _rule.selectors.length > 0;
                } else {
                    return true;
                }
            });
        }
    }
}

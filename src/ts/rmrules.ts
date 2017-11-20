import * as gutil from 'gulp-util';
import chalk from 'chalk';
import { Stylesheet, StyleRules, Rule, Declaration, Comment, Node } from 'css';
const CssSelectorParser = require('css-selector-parser').CssSelectorParser;

const parser = new CssSelectorParser();
parser.registerNestingOperators('>', '+', '~');

export enum Action {
    IGNORE = '',
    WARN = 'warn',
    ERROR = 'error',
    REMOVE = 'remove'
}

export interface Options {
    assumeSelectorsNotUsed?: string[];
    assumeSelectorsSet?: string[];

    deadRules?: Action;
    overriddenRules?: Action;

    maxReported?: number;
}

interface RulePosition {
    rule: any;
    hash: string;
    rulePos: number;
    selectorPos: number;
};

interface RuleIndex {
    [hash: string]: number[];
};

interface Result {
    errorCount: number;
    errorReported: number;
    warnCount: number;
    warnReported: number;

    maxReported: number;
};

const NAME = 'rework-rmrules';

function unique<T>(e: T, i: number, arr: T[]) {
    return arr.lastIndexOf(e) === i;
}

function ruleUsesAnyOf(rule: any, anyOf: string[]): boolean {
    if (rule.classNames) {
        if(rule.classNames.some((className: string) => anyOf.some(anyOf => anyOf === '.' + className))) {
            return true;
        } else if (rule.rule) {
            return ruleUsesAnyOf(rule.rule, anyOf);
        }
    }
    return false;
}

function classesAreAlwaysOverriding(a: any[] | undefined, b: any[] | undefined, set: string[]): boolean {
    let _a: { [className: string]: boolean } = {};
    let _b: { [className: string]: boolean } = {};
    let _s: { [className: string]: boolean } = {};
    
    if (a) {
        a.forEach(className => _a[className] = true);
    }
    if (b) {
        b.forEach(className => _b[className] = true);
    }
    set.forEach(className => {
        if (className[0] === '.') {
            _s[className.substr(1)] = true;
        }
    });

    // Each of a must exist in b or set, or there are cases when a applies but not b
    for (let className in _a) {
        if (!_b[className] && !_s[className]) {
            return false;
        }
    }

    // Each of b must exist in a, or there are cases when b applies but not a
    for (let className in _b) {
        if (!_a[className]) {
            return false;
        }
    }

    return true;
}

function idIsAlwaysOverriding(a: any, b: any, set: string[]) {
    return a === b || (a && !b && set.some(id => id === '#' + a));
}

function tagIsAlwaysOverriding(a: any, b: any, set: string[]) {
    return a === b || (a && !b && set.indexOf(a) >= 0);
}

function nestingOperatorIsAlwaysOverriding(a: any, b: any, disallowNestingOperatorOverride: boolean) {
    if (a == b) {
        return true;
    } else if (!disallowNestingOperatorOverride && !a && b === '>') {
        return true;
    } else if (!disallowNestingOperatorOverride && a === '~' && b === '+') {
        return true;
    } else {
        return false;
    }
}

function attributesAreAlwaysOverriding(a: any[] | undefined, b: any[] | undefined) {
    if (!a || !b) {
        return !a && !b;
    } else if (a.length !== b.length) {
        return false;
    } else {
        return a.every(a => b.some(b => a.name === b.name && a.operator === b.operator && a.valueType === 'string' && b.valueType === 'string' && a.value === b.value));
    }
}

function pseudosAreAlwaysOverriding(a: any[] | undefined, b: any[] | undefined) {
    if (!a || !b) {
        return !a && !b;
    } else if (a.length !== b.length) {
        return false;
    } else {
        return a.every(a => {
            return Object.keys(a).every(ak => b.some(b => b[ak] === a[ak]));
        });
    }
}

function isAlwaysOverridingSingleRule(a: any, b: any, set: string[], disallowNestingOperatorOverride: boolean) {
    return (
        idIsAlwaysOverriding(a.id, b.id, set) && 
        tagIsAlwaysOverriding(a.tagName, b.tagName, set) && 
        nestingOperatorIsAlwaysOverriding(a.nestingOperator, b.nestingOperator, disallowNestingOperatorOverride) && 
        attributesAreAlwaysOverriding(a.attrs, b.attrs) &&
        pseudosAreAlwaysOverriding(a.pseudos, b.pseudos) &&
        classesAreAlwaysOverriding(a.classNames, b.classNames, set));
}

function isAlwaysOverridingRule(a: any, b: any, set: string[], disallowNestingOperatorOverride: boolean): boolean {
    if (!a) {
        return !b;
    } else if (!b || !isAlwaysOverridingSingleRule(a, b, set, disallowNestingOperatorOverride)) {
        return isAlwaysOverridingSingleRule(a, {}, set, disallowNestingOperatorOverride) && isAlwaysOverridingRule(a.rule, b, set, disallowNestingOperatorOverride);
    } else {
        return isAlwaysOverridingRule(a.rule, b.rule, set, disallowNestingOperatorOverride);
    }
}

function containsDeclaration(node: Node, declarations: Array<Declaration | Comment>) {
    const decl = toDeclaration(node);
    return decl && declarations.some(node => {
        let decl2 = toDeclaration(node);
        return !!decl2 && decl2.property === decl.property;
    });
}

function toRule<T extends Node>(rule: T): Rule | undefined {
    if (rule.type === 'rule') {
        return <Rule>rule;
    }
}

function toDeclaration<T extends Node>(rule: T): Declaration | undefined {
    if (rule.type === 'declaration') {
        return <Declaration>rule;
    }
}

function removeDeadRules(result: Result, options: Options, rules: Node[], assumeSelectorsNotUsed: string[]) {
    rules.forEach((rule, index) => {
        let _rule = toRule(rule);
        if (_rule && _rule.selectors) {
            _rule.selectors = _rule.selectors.filter((selectorString: string) => {
                let selector = parser.parse(selectorString);

                if ((selector.type === 'ruleSet') && ruleUsesAnyOf(selector.rule, assumeSelectorsNotUsed)) {
                    return !error(result, options.deadRules, 'Selector $1 is never used', selectorString);
                } else {
                    return true;
                }
            });
        }
    });
}

function topLevelSelectors(rule: any) {
    let result: string[] = [];

    if (rule.classNames) {
        rule.classNames.forEach((className: string) => result.push('.' + className));
    }
    if (rule.tagName) {
        result.push(rule.tagName);
    }
    if (rule.id) {
        result.push('#' + rule.id);
    }

    return result;
}

function allSelectors(rule: any): string[] {
    if (rule.rule) {
        return topLevelSelectors(rule).concat(allSelectors(rule.rule));
    } else {
        return topLevelSelectors(rule);
    }
}

function selectorHash(rule: any, assumeSelectorsSet: string[]): string {
    let result = allSelectors(rule).filter(unique).filter(sel => assumeSelectorsSet.indexOf(sel) < 0).sort();
    return JSON.stringify(result);
}

function collectRules(rules: Node[], assumeSelectorsSet: string[]) {
    let list: RulePosition[] = [];
    let index: RuleIndex = {};

    rules.forEach((rule, rulePos) => {
        let _rule = toRule(rule);
        if (_rule && _rule.selectors) {
            _rule.selectors.forEach((selectorString, selectorPos) => {
                let selector = parser.parse(selectorString);

                if (selector.type === 'ruleSet') {
                    let hash = selectorHash(selector.rule, assumeSelectorsSet);
                    if (!index[hash]) {
                        index[hash] = [];
                    }
                    index[hash].push(list.length);
                    list.push({rulePos, selectorPos, hash, rule: selector.rule});                    
                }
            });
        }
    });
    return { list, index };
}

function calculateOverridingRules(rules: { list: RulePosition[], index: RuleIndex }, assumeSelectorsSet: string[]) {
    let result: { rule: RulePosition, overrides: RulePosition }[] = [];

    rules.list.forEach(a => {
        rules.index[a.hash].forEach(i => {
            let b = rules.list[i];

            if (a.rulePos < b.rulePos) {
                if (isAlwaysOverridingRule(b.rule, a.rule, assumeSelectorsSet, false)) {
                    // Also covers the case when the rules are identical
                    result.push({ rule: b, overrides: a });
                } else if (isAlwaysOverridingRule(a.rule, b.rule, assumeSelectorsSet, true)) {
                    result.push({ rule: a, overrides: b });
                }
            }
        });
    });

    return result;
}

function overridesAllDeclarations(a: Declaration[], b: Declaration[]) {
    return b.every(b_decoration => a.some(a_decoration => a_decoration.property === b_decoration.property));
}

function removeOverriddenDeclarations(result: Result, options: Options, rules: Node[], overrides: { rule: RulePosition, overrides: RulePosition }[]) {
    overrides.forEach(({ rule, overrides }) => {
        const a = toRule(rules[rule.rulePos]);
        const b = toRule(rules[overrides.rulePos]);

        if (a && a.declarations && a.selectors && b && b.declarations) {
            if (b.selectors && b.selectors.length === 1) {
                b.declarations = b.declarations.filter(node => {
                    if (a.declarations && a.selectors && b.selectors && containsDeclaration(node, a.declarations)) {
                        return !error(result, options.overriddenRules, 'Selector $1 always overides css property $2 of $3', a.selectors[rule.selectorPos], (<any>node).property, b.selectors[overrides.selectorPos]);
                    } else {
                        return true;
                    }
                });
            } else if (b.selectors && b.selectors.length > 1) {
                if (overridesAllDeclarations(a.declarations, b.declarations)) {
                    if (error(result, options.overriddenRules, 'Selector $1 always overides all css properties of $2', a.selectors[rule.selectorPos], b.selectors[overrides.selectorPos])) {
                        b.selectors.splice(overrides.selectorPos, 1);
                    }
                }
            }
        }
    });
}

function format(msg: string, args: string[]) {
    return msg.replace(/\$(.)/g, x => '[' + chalk.gray(args[parseInt(x.substr(1)) - 1]) + ']');
}

function error(result: Result, action: Action | undefined, msg: string, ...args: string[]) {
    if (action === Action.REMOVE) {
        return true;
    } else {
        if (action === Action.ERROR) {
            result.errorCount++;
            if (result.maxReported-- > 0) {
                result.errorReported++;
                gutil.log(NAME + ': [' + chalk.red('ERROR') + '] ' + format(msg, args));
            }
        } else if (action === Action.WARN) {
            result.warnCount++;
            if (result.maxReported-- > 0) {
                result.warnReported++;
                gutil.log(NAME + ': [' + chalk.black('WARN') + '] ' + format(msg, args));
            }
        }
        return false;
    }
}

export function rmrules(options: Options = {}): (style: StyleRules) => void {
    let assumeSelectorsNotUsed = options.assumeSelectorsNotUsed || [];
    let assumeSelectorsSet = options.assumeSelectorsSet || [];
    let result: Result = {
        errorCount: 0,
        errorReported: 0,
        warnCount: 0,
        warnReported: 0,

        maxReported: (options.maxReported === undefined) ? 20 : options.maxReported
    };

    return (styles: StyleRules) => {
        removeDeadRules(result, options, styles.rules, assumeSelectorsNotUsed);

        let rules = collectRules(styles.rules, assumeSelectorsSet);
        let overrides = calculateOverridingRules(rules, assumeSelectorsSet);
        removeOverriddenDeclarations(result, options, styles.rules, overrides);
        
        styles.rules = styles.rules.filter((rule, index) => {
            let _rule = toRule(rule);
            return !_rule || ((_rule.selectors && _rule.selectors.length) && (_rule.declarations && _rule.declarations.length));
        });

        if (result.errorReported < result.errorCount) {
            gutil.log(NAME + ': ' + (result.errorCount - result.errorReported) + ' more errors...');
        }
        if (result.warnReported < result.warnCount) {
            gutil.log(NAME + ': ' + (result.warnCount - result.warnReported) + ' more warnings...');
        }
        if (result.errorCount > 0) {
            throw new Error(NAME + ': There were errors, see the log for details');
        }
    };
}

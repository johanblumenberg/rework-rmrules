import * as gutil from 'gulp-util';
import chalk from 'chalk';
import { Stylesheet, StyleRules, Rule, Declaration, Comment, Node, Position } from 'css';
const CssSelectorParser = require('css-selector-parser').CssSelectorParser;
const sourceMap = require('source-map');

const parser = new CssSelectorParser();
parser.registerNestingOperators('>', '+', '~');

export enum Action {
    IGNORE = '',
    WARN = 'warn',
    ERROR = 'error',
    REMOVE = 'remove'
}

export interface Options {
    assumeSelectorsNotUsed: string[];
    assumeSelectorsSet: string[];

    actOnDeadRules: Action;
    actOnOverriddenRules: Action;
    actOnInvalidBodyRules: Action;

    maxReported: number;
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
    warnCount: number;
    removeCount: number;

    maxReported: number;
};

type _Declaration = Declaration | undefined;
type _Node = Node | undefined;
type _Rule = Rule | undefined;

const NAME = 'rework-rmrules';

function unique<T>(e: T, i: number, arr: T[]) {
    return arr.lastIndexOf(e) === i;
}

function ruleUsesBodyTag(rule: any): boolean {
    if (rule.tagName === 'body') {
        return true;
    } else if (rule.rule) {
        return ruleUsesBodyTag(rule.rule);
    } else {
        return false;
    }
}

function ruleHasInvalidBodyTag(rule: any) {
    if (rule.rule) {
        return ruleUsesBodyTag(rule.rule);
    } else {
        return false;
    }
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

function findDeclaration(node: Node, declarations: Array<Declaration | Comment>): _Declaration {
    const decl = toDeclaration(node);
    return decl && declarations.find(node => {
        let decl2 = toDeclaration(node);
        return !!decl2 && decl2.property === decl.property;
    });
}

function firstDeclaration(node: Node): _Declaration {
    let rule = toRule(node);
    return rule && rule.declarations && rule.declarations.find(node => !!toDeclaration(node));
}

function firstDeclarationAnd(node: Node) {
    let rule = toRule(node);
    if (rule && rule.declarations) {
        let decl = rule.declarations.find(node => !!toDeclaration(node));
        if (decl) {
            return [{
                rule: rule,
                decl: decl
            }];
        }
    }
    return [];
}

function toRule<T extends Node>(rule: T): _Rule {
    if (rule.type === 'rule') {
        return <Rule>rule;
    }
}

function toDeclaration<T extends Node>(rule: T): _Declaration {
    if (rule.type === 'declaration') {
        return <Declaration>rule;
    }
}

function removeDeadRules(result: Result, options: Options, smc: any, rules: Node[], assumeSelectorsNotUsed: string[]) {
    rules.forEach((rule, index) => {
        const _rule = toRule(rule);
        if (_rule && _rule.selectors) {
            _rule.selectors = _rule.selectors.filter((selectorString: string) => {
                let selector = parser.parse(selectorString);

                if ((selector.type === 'ruleSet') && ruleUsesAnyOf(selector.rule, assumeSelectorsNotUsed)) {
                    return !error(result, options.actOnDeadRules, smc, [], firstDeclaration(_rule), _rule, 'Selector $1 is never used', selectorString);
                } else {
                    return true;
                }
            });
        }
    });
}


function removeInvalidBodyTagRules(result: Result, options: Options, smc: any, rules: Node[]) {
    rules.forEach((rule, index) => {
        const _rule = toRule(rule);
        if (_rule && _rule.selectors) {
            _rule.selectors = _rule.selectors.filter((selectorString: string) => {
                let selector = parser.parse(selectorString);

                if ((selector.type === 'ruleSet') && ruleHasInvalidBodyTag(selector.rule)) {
                    return !error(result, options.actOnInvalidBodyRules, smc, [], firstDeclaration(_rule), _rule, 'Rule $1 has a body tag which is not in the first position', selectorString);
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

function isAlwaysOverridingDeclaration(a: Declaration, b: Declaration): boolean {
    if (a.property === b.property) {
        if (b.value && b.value.indexOf('important') >= 0) {
            return !!a.value && a.value.indexOf('important') >= 0;
        }
        return true;
    }
    return false;
}

function overridesAllDeclarations(a: Declaration[], b: Declaration[]) {
    return b.every(b_declaration => a.some(a_declaration => isAlwaysOverridingDeclaration(a_declaration, b_declaration)));
}

function allSelectorsAreOverridden(overriddenRulePos: number, decl: Declaration, rules: Node[], calculatedOverrides: { rule: RulePosition, overrides: RulePosition }[]) {
    let overriddenRule = toRule(rules[overriddenRulePos]);
    let found = Array(overriddenRule!.selectors!.length).fill(false);
    calculatedOverrides.forEach(override => {
        if (override.overrides.rulePos === overriddenRulePos) {
            const overridingRule = toRule(rules[override.rule.rulePos]);

            if (overridingRule && overridingRule.declarations) {
                let overridingDeclaration = findDeclaration(decl, overridingRule.declarations);
                if (overridingDeclaration && isAlwaysOverridingDeclaration(overridingDeclaration, decl)) {
                    found[override.overrides.selectorPos] = { rule: overridingRule, decl: overridingDeclaration };
                }
            }
        }
    });
    return found.every(i => !!i) && found;
}

function removeOverriddenDeclarations(result: Result, options: Options, smc: any, rules: Node[], calculatedOverrides: { rule: RulePosition, overrides: RulePosition }[]) {
    calculatedOverrides.forEach(({ rule, overrides }) => {
        const a = toRule(rules[rule.rulePos]);
        const b = toRule(rules[overrides.rulePos]);

        if (a && a.declarations && a.selectors && b && b.declarations) {
            if (b.selectors && b.selectors.length === 1) {
                b.declarations = b.declarations.filter(overriddenDeclaration => {
                    let overridingDeclaration = findDeclaration(overriddenDeclaration, a.declarations!);
                    if (overridingDeclaration && isAlwaysOverridingDeclaration(overridingDeclaration, overriddenDeclaration)) {
                        return !error(result, options.actOnOverriddenRules, smc, [{ decl: overridingDeclaration, rule: a}], overriddenDeclaration, b, 'Selector $1 always overides css property $2 of $3', a.selectors![rule.selectorPos], (<any>overridingDeclaration).property, b.selectors![overrides.selectorPos]);
                    } else {
                        return true;
                    }
                });
            } else if (b.selectors && b.selectors.length > 1) {
                if (overridesAllDeclarations(a.declarations, b.declarations)) {
                    if (error(result, options.actOnOverriddenRules, smc, firstDeclarationAnd(a), firstDeclaration(b), b, 'Selector $1 always overides all css properties of $2', a.selectors[rule.selectorPos], b.selectors[overrides.selectorPos])) {
                        b.selectors.splice(overrides.selectorPos, 1);
                    }
                } else {
                    b.declarations = b.declarations.filter(overriddenDeclaration => {
                        if (findDeclaration(overriddenDeclaration, a.declarations!)) {
                            let overridingRules = allSelectorsAreOverridden(overrides.rulePos, overriddenDeclaration, rules, calculatedOverrides);
                            if (overridingRules) {
                                return !error(result, options.actOnOverriddenRules, smc, overridingRules, overriddenDeclaration, b, 'css property $1 of $2 is always overridden', (<any>overriddenDeclaration).property, b.selectors![overrides.selectorPos]);
                            }
                        }
                        return true;
                    });
                }
            }
        }
    });
}

function format(msg: string, args: string[]) {
    return msg.replace(/\$(.)/g, x => '[' + chalk.magentaBright(args[parseInt(x.substr(1)) - 1]) + ']');
}

function position(smc: any, node: _Node) {
    if (node && node.position && node.position.source && node.position.start) {
        if (smc) {
            return smc.originalPositionFor(node.position.start);
        } else {
            return {
                source: node.position.source,
                line: node.position.start.line,
                column: node.position.start.column
            };
        }
    }
}

function posText(pos: { source: string, line: number, column: number }): string {
    return pos.source + ':' + pos.line + ':' + pos.column;
}

function logPosition(smc: any, decl: OverridingDecl[], overridesDecl: _Declaration, overridesRule: Node) {
    decl.forEach(d => {
        let declPos = position(smc, d.decl);
        let rulePos = position(smc, d.rule);

        if (rulePos && declPos) {
            if (declPos.source === rulePos.source) {
                gutil.log(NAME + ':  rule at:    ' + chalk.grey(posText(declPos)));
            } else {
                gutil.log(NAME + ':  rule at:');
                gutil.log(NAME + ':    property: ' + chalk.grey(posText(declPos)));
                gutil.log(NAME + ':    rule:     ' + chalk.grey(posText(rulePos)));
            }
        }
    });

    let declOverPos = position(smc, overridesDecl);
    let ruleOverPos = position(smc, overridesRule);

    if (ruleOverPos && declOverPos) {
        if (declOverPos.source === ruleOverPos.source) {
            gutil.log(NAME + ':  overrides:  ' + chalk.grey(posText(declOverPos)));
        } else {
            gutil.log(NAME + ':  overrides:');
            gutil.log(NAME + ':    property: ' + chalk.grey(posText(declOverPos)));
            gutil.log(NAME + ':    rule:     ' + chalk.grey(posText(ruleOverPos)));
        }
    }
}

interface OverridingDecl {
    decl: Declaration;
    rule: Rule;
};

function error(result: Result, action: Action, smc: any, decl: OverridingDecl[], overridesDecl: _Declaration, overridesRule: Node, msg: string, ...args: string[]) {
    if (action === Action.REMOVE) {
        result.removeCount++;
        if (result.maxReported-- > 0) {
            gutil.log(NAME + ': [' + chalk.redBright('REMOVE') + '] ' + format(msg, args));
            logPosition(smc, decl, overridesDecl, overridesRule);
        }
        return true;
    } else {
        if (action === Action.ERROR) {
            result.errorCount++;
            if (result.maxReported-- > 0) {
                gutil.log(NAME + ': [' + chalk.redBright('ERROR') + '] ' + format(msg, args));
                logPosition(smc, decl, overridesDecl, overridesRule);
            }
        } else if (action === Action.WARN) {
            result.warnCount++;
            if (result.maxReported-- > 0) {
                gutil.log(NAME + ': [' + chalk.black('WARN') + '] ' + format(msg, args));
                logPosition(smc, decl, overridesDecl, overridesRule);
            }
        }
        return false;
    }
}

// TODO: Suggest to combine rules where there is a more specific rule, .dark .x { a: 3; } .x { b: 2; }  =>  .dark .x { a: 3; b:2; }
//   NOTE! This makes the rule more specific, and it could override something that it is not supposed to override
// TODO: same property defined twice in the same rule
// TODO: check if !important is always overriding some rules that can be removed, .a .b { a:1 } .b { a:2 !important; } => .b { a:2 !important; }

export function rmrules(options: Partial<Options> = {}): (style: StyleRules, rework: any) => void {
    let result: Result = {
        errorCount: 0,
        warnCount: 0,
        removeCount: 0,

        maxReported: (options.maxReported === undefined) ? 20 : options.maxReported
    };

    let opts: Options = Object.assign({
        assumeSelectorsNotUsed: [],
        assumeSelectorsSet: [],
        maxReported: 10,

        actOnDeadRules: Action.IGNORE,
        actOnOverriddenRules: Action.IGNORE,
        actOnInvalidBodyRules: Action.IGNORE
    }, options);

    return (styles: StyleRules, rework: any) => {
        let sm = rework.sourcemap && rework.sourcemap();
        let smc = sm && new sourceMap.SourceMapConsumer(sm);

        if (opts.actOnInvalidBodyRules !== Action.IGNORE) {
            removeInvalidBodyTagRules(result, opts, smc, styles.rules);
        }
        if (opts.actOnDeadRules !== Action.IGNORE) {
            removeDeadRules(result, opts, smc, styles.rules, opts.assumeSelectorsNotUsed);
        }

        if (opts.actOnOverriddenRules !== Action.IGNORE) {
            let rules = collectRules(styles.rules, opts.assumeSelectorsSet);
            let overrides = calculateOverridingRules(rules, opts.assumeSelectorsSet);
            removeOverriddenDeclarations(result, opts, smc, styles.rules, overrides);
        }

        styles.rules = styles.rules.filter((rule, index) => {
            let _rule = toRule(rule);
            return !_rule || ((_rule.selectors && _rule.selectors.length) && (_rule.declarations && _rule.declarations.length));
        });

        if (result.errorCount > 0) {
            gutil.log(NAME + ': ' + result.errorCount + ' errors...');
        }
        if (result.warnCount > 0) {
            gutil.log(NAME + ': ' + result.warnCount + ' warnings...');            
        }
        if (result.removeCount > 0) {
            gutil.log(NAME + ': ' + result.removeCount + ' removals...');            
        }

        if (result.errorCount > 0) {
            throw new Error(NAME + ': There were errors, see the log for details');
        }
    };
}

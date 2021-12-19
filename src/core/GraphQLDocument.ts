import {DocumentNode, OperationDefinitionNode, parse, visit} from 'graphql'
import {ExecutableDefinitionNode} from 'graphql/language/ast'
import { Issue, linters } from './Linter';
import { SchemaContainer } from './SchemaContainer';

/**
 * What is the logical ordering of generation?
 *
 * Schema Side:
 *   - Things we can generate as is:
 *      - enums (+ config for existing)        (NO CHANGE)
 *      - scalar def (ideally we reduce this?) (CONSUME CHANGE)
 *      - unions?                              (NO CHANGE)
 *   - things we then need from queries
 *      - fragments - all needed before final gen (can probs due 'frag' gen and then consume) (CONSUME CHANGE)
 *      - queries + mutations                                                                 (INDIV CHANGE)
 *   - being smart/pretentious about it
 *      - introduce a light linter
 *          - missing ids (does current object type have an id prop?)
 *          - missing ...Errorable (does current mutation have errors return prop?)
 */

function getFragmentNames(doc: DocumentNode) {
  const fragments: string[] = []
  visit(doc, { leave: { FragmentSpread: node => {
    const name = node.name.value;
    if (!name) return;
      if (!fragments.includes(name)) {
        fragments.push(name);
      }
      } }})

  return fragments;
}

export class GraphQLDocument {
  public queryString: string;
  public doc: DocumentNode;
  public fragmentNames: string[] = [];
  public name: string;
  public type: 'fragment' | 'query' | 'mutation' | 'subscription';

  constructor(query: string) {
    this.queryString = query;
    this.doc = parse(query, { noLocation: false });
    this.type = (this.doc.definitions[0] as ExecutableDefinitionNode).kind === 'FragmentDefinition' ? 'fragment' : (this.doc.definitions[0] as OperationDefinitionNode).operation;
    this.fragmentNames = getFragmentNames(this.doc);
    this.name = (this.doc.definitions[0] as ExecutableDefinitionNode).name?.value ?? ''
  }

  getFullName() {
    return `${this.name}${this.type[0].toUpperCase()}${this.type.slice(1)}`
  }

  *lint(schema: SchemaContainer): Generator<Issue> {
    for (const linter of linters) {
      yield* linter(this, schema);
    }
  }
}

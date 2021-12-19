import { typeFromAST, visit } from 'graphql';
import { LinterRule } from '../Linter';

export const IdentifierMissingLintRule: LinterRule = function* (
  document,
  schema
) {
  visit(document.doc, {
    enter: (node, key, parent, path, ancestors) => {
      // if (node.kind === 'NamedType'){
      //   yield { message: 'Named type found!'}
      // }
    },
    leave(node, key, parent, path, ancestors) {
      // console.log('leave', node, key)
    },
  });
};

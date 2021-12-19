import {
  FieldNode,
  FragmentSpreadNode,
  getNamedType,
  GraphQLField, GraphQLInputField,
  GraphQLInputType,
  GraphQLOutputType,
  InlineFragmentNode, isType,
  SelectionSetNode,
} from 'graphql'
import {DocumentManager} from './DocumentManager'
import {GraphQLDocument} from './GraphQLDocument'

export function splitSelectionSetSectionsByType(
  selectionSet: SelectionSetNode
) {
  return {
    fragments: selectionSet.selections.filter(
      (selection) => selection.kind === 'FragmentSpread'
    ) as FragmentSpreadNode[],
    fields: selectionSet.selections.filter(
      (selection) => selection.kind === 'Field'
    ) as FieldNode[],
    inlineFragments: selectionSet.selections.filter(
      (selection) => selection.kind === 'InlineFragment'
    ) as InlineFragmentNode[],
  };
}

function getNestedFragmentsInner(documentManager: DocumentManager, doc: GraphQLDocument): string[]  {
  return [
    ...doc.fragmentNames.flatMap(frag => {
      const innerFrag = documentManager.getFragmentByName(frag);
      if (!innerFrag) return [];

      return [frag, ...getNestedFragmentsInner(documentManager, innerFrag)];
    })
  ];
}

export function getNestedFragments(documentManager: DocumentManager, doc: GraphQLDocument): string[]  {
  const items = [...new Set(getNestedFragmentsInner(documentManager, doc))];
  return items;
}

export function printNonNull(nonNull: boolean) {
  if (!nonNull) return ' | null';
  return ''
}

function getBestTSDocMetadataForType(
  type: GraphQLInputField | GraphQLField<any, any> | GraphQLInputType | GraphQLOutputType
) {
  if (!isType(type)) {
    return {
      description: type.description,
      deprecationReason:
        'deprecationReason' in type ? type.deprecationReason : undefined,
    };
  }

  const namedType = getNamedType(type);

  return { description: namedType.description, deprecationReason: undefined };
}

/**
 * Generate a possible doc string for a given field or type
 * If given field and no description will use the field's type instead
 */
export function generateTSDocCommentForType(
  type: GraphQLInputField | GraphQLField<any, any> | GraphQLInputType | GraphQLOutputType
): string {
  const { description, deprecationReason } = getBestTSDocMetadataForType(type);

  if (!description && !deprecationReason) return '';

  return `/**
      ${description ?? ''}${
    (deprecationReason && `\n@deprecated ${deprecationReason}`) ?? ''
  }
    */`;
}

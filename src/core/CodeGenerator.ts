import {
  execute,
  FieldNode,
  FragmentDefinitionNode,
  FragmentSpreadNode,
  getNamedType,
  GraphQLField,
  GraphQLFloat,
  GraphQLInputType,
  GraphQLInterfaceType,
  GraphQLObjectType,
  GraphQLOutputType,
  GraphQLScalarType,
  GraphQLUnionType,
  InlineFragmentNode,
  isListType,
  isNonNullType,
  NamedTypeNode,
  OperationDefinitionNode, parse,
  SelectionSetNode,
  typeFromAST,
  TypeNode,
} from 'graphql'
import { ExecutableDefinitionNode } from 'graphql/language/ast';
import {Configuration} from './Configuration'
import {DocumentManager} from './DocumentManager'
import { GraphQLDocument } from './GraphQLDocument';
import { Logger } from './Logger';
import { SchemaContainer } from './SchemaContainer';
import {
  generateTSDocCommentForType, getNestedFragments,
  splitSelectionSetSectionsByType,
} from './schemaHelpers'

export class CodeGenerator {
  constructor(
    private config: Configuration,
    private schema: SchemaContainer,
    private documentManager: DocumentManager
  ) {}

  realiseType(type: TypeNode, purpose: 'input' | 'output' = 'output'): string {
    if (type.kind === 'NonNullType') {
      return this.realiseType(type.type, purpose);
    }

    if (type.kind === 'ListType') {
      return `(${this.realiseType(type.type, purpose)})[]`;
    }

    const val = typeFromAST(this.schema.schema!, type);

    return (val && this.schema.getRealisedType(val, purpose)) ?? '';
  }

  buildTypeForSelectionSet(
    selectionSet: SelectionSetNode,
    type: GraphQLOutputType,
    noTypeName = false
  ): string {
    if (isListType(type)) {
      return `(${this.buildTypeForSelectionSet(selectionSet, type.ofType)})[]`;
    }

    if (isNonNullType(type)) {
      return this.buildTypeForSelectionSet(selectionSet, type.ofType);
    }

    if (type instanceof GraphQLObjectType) {
      return this.buildTypeForSelectionSetObjectInterfaceType(selectionSet, type, noTypeName);
    }

    if (type instanceof GraphQLInterfaceType) {
      return this.buildTypeForSelectionSetObjectInterfaceType(selectionSet, type, noTypeName);
    }

    if (type instanceof GraphQLUnionType) {
      return this.buildTypeForSelectionSetUnionType(selectionSet, type, noTypeName);
    }

    throw new Error('uncaught type')
  }


  buildTypeForSelectionSetObjectInterfaceType(
    selectionSet: SelectionSetNode,
    type: GraphQLObjectType | GraphQLInterfaceType,
    noTypeName = false
  ): string {
    const { fragments, fields } =
      splitSelectionSetSectionsByType(selectionSet);

    const fieldContent = fields.flatMap((selection) => {
      if (selection.name.value === '__typename') return [];
      const schemaType = type.getFields()[selection.name.value];

      if (!schemaType) {
        console.error(`${selection.name.value} not found on `, type);
      }

      return `${generateTSDocCommentForType(schemaType)}\n${
        selection.alias?.value ?? selection.name.value
      }: ${
        selection.selectionSet
          ? this.buildTypeForSelectionSet(
              selection.selectionSet,
              schemaType.type
            )
          : this.schema.getRealisedType(schemaType.type)
      }`;
    });

    if (fieldContent.length > 0 && !noTypeName) {
        fieldContent.push(
          `/** Generated type of the object type */\n__typename: '${type.name}';`
        )
    }

    const fragmentContent = fragments
      .map((selection) => `${selection.name.value}Fragment`)
      .join(' & ');

    return [
      fragments.length > 0 ? fragmentContent : '',
      fieldContent.length > 0 && fragments.length
        ? ' & '
        : '',
      fieldContent.length > 0 ? `{ ${fieldContent.join('\n')} }` : '',
    ].join('');
  }


  buildTypeForSelectionSetUnionType(
    selectionSet: SelectionSetNode,
    type: GraphQLUnionType,
    noTypeName = false
  ): string {
    const { fragments, inlineFragments } =
      splitSelectionSetSectionsByType(selectionSet);

    const inlineFragmentContent = inlineFragments.flatMap((selection) => {
      const condition = selection.typeCondition;
      if (!condition) throw new Error('no type condition on fragment');

      const fragmentFor = type
        .getTypes()
        .find((t) => t.name === condition.name.value);

      if (!fragmentFor)
        throw new Error('inline fragment condition not found within union');

      return this.buildTypeForSelectionSet(selection.selectionSet, fragmentFor);
    });

    const fragmentContent = fragments
      .map((selection) => `${selection.name.value}Fragment`)
      .join(' | ');

    return [
      fragments.length > 0 ? fragmentContent : '',
      fragments.length > 0 && inlineFragments.length > 0 ? ' & ' : '',
      inlineFragments.length > 0
        ? `(${inlineFragmentContent.join(' | ')})`
        : '',
    ].join('');
  }

  generateForSelectionSet(def: OperationDefinitionNode) {
    const final = def.selectionSet.selections.map((selection) => {
      if (selection.kind === 'Field') {
        const root = (
          def.operation === 'mutation'
            ? this.schema.schema!.getMutationType()
            : this.schema.schema!.getQueryType()
        )!.getFields()[selection.name.value];
        return `${selection.name.value}: ${
          selection.selectionSet
            ? this.buildTypeForSelectionSet(selection.selectionSet, root.type)
            : 'HELP'
        }`;
      }
    });

    return final.join('\n');
  }

  generateFragmentDocument(def: FragmentDefinitionNode) {
    const type = this.schema.schema!.getType(def.typeCondition.name.value);
    return `type ${def.name?.value}Fragment = ${this.buildTypeForSelectionSet(
      def.selectionSet,
      type as GraphQLOutputType,
      type instanceof GraphQLInterfaceType
    )}`;
  }

  generateQueryDocument(def: OperationDefinitionNode) {
    return [
      !def.variableDefinitions || def.variableDefinitions.length === 0
        ? `type ${def.name?.value}Variables = Empty;`
        : `interface ${def.name?.value}Variables {
      ${def.variableDefinitions
        .map(
          (varr) =>
            `${varr.variable.name.value}: ${this.realiseType(varr.type, 'input')};`
        )
        .join('\n')}
    }`,
      `interface ${def.name?.value}Result {
      ${this.generateForSelectionSet(def)}
     }`,
    ].join('\n\n');
  }

  generateMutationDocument(def: OperationDefinitionNode) {
    return [
      !def.variableDefinitions || def.variableDefinitions.length === 0
        ? `type ${def.name?.value}Variables = Empty;`
        : `interface ${def.name?.value}Variables {
      ${def.variableDefinitions
        ?.map(
          (varr) =>
            `${varr.variable.name.value}: ${this.realiseType(varr.type, 'input')};`
        )
        .join('\n')}
    }`,
      `interface ${def.name?.value}Result {
      ${this.generateForSelectionSet(def)}
     }`,
    ].join('\n\n');
  }

  outputDocuments() {
    return [
      ...this.documentManager.getFragments().map(fragment => this.generateFragmentDocument(fragment.doc.definitions[0] as FragmentDefinitionNode)),
      ...this.documentManager.getMutations().map(mutation => this.generateMutationDocument(mutation.doc.definitions[0] as OperationDefinitionNode)),
      ...this.documentManager.getQueries().map(query => this.generateQueryDocument(query.doc.definitions[0] as OperationDefinitionNode))
    ].join('\n');
  }

  outputGqlDocumentsDef() {

    const fragments: Record<string, { document: GraphQLDocument, content: string }> = {};
    const operations: string[] = [];

    [
      ...this.documentManager.getMutations(),
      ...this.documentManager.getQueries()
    ].forEach((query) => {
        const content = `const ${query.name}Document = ${JSON.stringify({ ...query.doc, definitions: [...query.doc.definitions, '^^'] })
          .replace(/"\^\^"/g, getNestedFragments(this.documentManager, query).map(name => `${name}FragmentDocument.definitions[0]`).join(','))
        }`;

        operations.push(content);
      });

    this.documentManager.getFragments()
      .forEach((fragment) => {
        const content = `const ${fragment.name}FragmentDocument = ${JSON.stringify({ ...fragment.doc, definitions: [...fragment.doc.definitions ] })
        }`;

          fragments[fragment.name] = { document: fragment, content};
      });

    const done: string[] = [];
    const left = Object.keys(fragments);

    const fragContent: string[] = []

    while(left.length > 0) {
      const fragmentName = left.pop()!;
      const fragment = fragments[fragmentName];


      if (fragment.document.fragmentNames.find(n => !done.includes(n))) {
        left.unshift(fragmentName);
        continue;
      }

      done.push(fragmentName)
      fragContent.push(fragment.content);
    }

    return fragContent.join('\n') + '\n' + operations.join('\n');
  }

  outputGqlDocumentsDefByQuery() {
    const documents = [
      ...this.documentManager.getFragments(),
      ...this.documentManager.getMutations(),
      ...this.documentManager.getQueries(),
    ]
      .map((query) => {
        const doc = query.doc.definitions[0] as
          | OperationDefinitionNode
          | FragmentDefinitionNode;

        const args =
          doc.kind === 'FragmentDefinition'
            ? `${doc.name.value}Fragment, unknown`
            : `${doc.name?.value}Result, ${doc.name?.value}Variables`;

        const isFragment = query.doc.definitions[0].kind === 'FragmentDefinition';
        return `${query.getFullName()}: ${query.name}${isFragment ? 'FragmentDocument' : 'Document'} as unknown as DocumentNode<${args}>`;
      })
      .join(',\n');

    return `const documents = {${documents}};`;
  }

  async fragmentMatcher() {
    if (!this.schema.schema) return ''

    const introspection = await execute({
      schema: this.schema.schema,
      document: parse(`
      {
        __schema {
          types {
            kind
            name
            possibleTypes {
              name
            }
          }
        }
      }
    `),
    });

    const possibleTypes: Record<string, string[]> = {};

    introspection.data?.__schema.types.forEach((supertype: { kind: string, name: string, possibleTypes: { name: string }[] }) => {
      if (supertype.possibleTypes) {
        possibleTypes[supertype.name] =
          supertype.possibleTypes.map(subtype => subtype.name);
      }
    });

    return `export const fragments = ${JSON.stringify(possibleTypes)}`
  }

  public async output() {
    Logger.logger.time('generate');
    this.schema.tokenCollector.reset()



    const documents = this.outputDocuments();

    const documentsDef = this.outputGqlDocumentsDef();

    const outputGqlDocumentsDefByQuery = this.outputGqlDocumentsDefByQuery();
    const fragmentMatcher = await this.fragmentMatcher();

    const build = [
      '// fgc',
      "import { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'",
      ...this.config.printing.injection,
      'type Empty = { [key: string]: never; };',
      this.schema.output(),
      fragmentMatcher,
      documents,
      documentsDef,
      outputGqlDocumentsDefByQuery,
      `export function gql(_source: TemplateStringsArray): typeof documents {
          return documents;
        }`,
      `export type DocumentType<TDocumentNode extends DocumentNode<any, any>> = TDocumentNode extends DocumentNode<
  infer TType,
  any
>
  ? TType
  : never;`,
    ].join('\n\n\n');
    Logger.logger.timeEnd('generate');

    return build;
  }
}

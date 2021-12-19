import {readFile} from 'fs/promises'
import {
  buildSchema, GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLInputType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLOutputType,
  GraphQLScalarType, GraphQLSchema,
  isInputObjectType, isNonNullType,
} from 'graphql'
import path from 'node:path'
import {Configuration} from './Configuration'
import {Logger} from './Logger'
import {generateTSDocCommentForType, printNonNull} from './schemaHelpers'
import {TokenCollector} from './TokenCollector'

export class SchemaContainer {
  private outputFinal: string = '';

  public schema: undefined | GraphQLSchema;

  public tokenCollector = new TokenCollector();

  constructor(private config: Configuration) {}

  async load() {
    Logger.logger.time('load schema');
    const schema = await readFile(
      path.join(process.cwd(), this.config.schema.path),
      { encoding: 'utf-8' }
    );

    this.schema = buildSchema(schema, { noLocation: false });
    Logger.logger.timeEnd('load schema');

    this.refreshOutput();
  }

  getRealisedType(e: GraphQLInputType | GraphQLOutputType, purpose: 'input' | 'output' = 'output',  nonNull = false): string {
    if (e instanceof GraphQLNonNull) {
      return this.getRealisedType(e.ofType, purpose, true);
    }

    if (e instanceof GraphQLList) {
      return `(${this.getRealisedType(e.ofType, purpose)})[]${printNonNull(nonNull)}`;
    }

    this.tokenCollector.found(e.name);

    if (e instanceof GraphQLScalarType) {
      return this.getTypeFromConfig('scalars', purpose, e.name) + printNonNull(nonNull);
    }

    if (e instanceof GraphQLEnumType) {
      return this.getTypeFromConfig('enums', purpose, e.name) + printNonNull(nonNull);
    }

    return e.name;
  }

  getTypeFromConfig(typetype: 'scalars' | 'enums', purpose: 'input' | 'output', token: string) {
    const { replacements, passthrough, passthroughPrepend } = this.config.printing[typetype];
    const replacement = replacements && replacements[token];

    if (replacement) return (typeof replacement !== 'string') ? replacement[purpose] : replacement;

    if (passthrough) {
      return (passthroughPrepend ?? '') + token;
    }

    throw new Error(`${token} is not handled for ${typetype}`);
  }

  generateForToken(token: string) {
    const types = this.schema!.getTypeMap();

    if (Object.hasOwnProperty.call(types, token)) {
      const type = types[token];

      if (isInputObjectType(type)) {
        return `${generateTSDocCommentForType(type)}interface ${type.name} {
      ${Object.entries((type as GraphQLInputObjectType).getFields())
        .map(([name, inn]) => `${generateTSDocCommentForType(inn)}${name}${isNonNullType(inn.type) ? '': '?'}: ${this.getRealisedType(inn.type, 'input')};`)
        .join('\n')}
    }`;
      }
    }

    return undefined;
  }

  generateUsedStructures() {
    if (!this.schema) return '';

    const lines = [];

    while (this.tokenCollector.hasMoreTokens()) {
      const token = this.tokenCollector.consume();
      const content = this.generateForToken(token);
      if (content) {
        lines.push(content);
      }
    }

    return lines.join('\n');
  }

  refreshOutput() {
    this.outputFinal = this.generateUsedStructures();
  }

  output() {
    this.refreshOutput();
    return this.outputFinal;
  }
}

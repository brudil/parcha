import {Configuration} from './core/Configuration'

export const config: Configuration = {
  output: { outputPath: './src/gql/index.ts'},
  documents: { globs: ['../**/*.{ts,tsx}'] },
  schema: { path: '../service/schema.graphql' },
  printing: {
    scalars: {
      replacements: {
        ID: 'string',
        String: 'string',
        Int: 'number',
        Float: 'number',
      }
    },
    enums: {
      passthrough: true,
    },
    injection: [

    ]
  }
}

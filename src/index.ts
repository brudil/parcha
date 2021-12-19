import { Command, flags } from '@oclif/command';
import { blueBright, bold, italic, underline } from 'colorette';
import {Configuration} from './core/Configuration'
import { Logger } from './core/Logger';
import { Parcha } from './core/Parcha';
import {config} from './config'

class ParchaCLI extends Command {
  static description = 'describe the command here';

  static flags = {
    schema: flags.string({ char: 's', }),
    version: flags.version({ char: 'v' }),
    help: flags.help({ char: 'h' }),
    watch: flags.boolean({ char: 'w' }),
    debug: flags.boolean({ char: 'd' }),
  };

  static args = [];

  async run() {
    const start = Date.now();
    const { flags } = this.parse(ParchaCLI);

    Logger.logger.setDebug(flags.debug);

    const overrides: Configuration = config;

    if (flags.schema) {
      overrides.schema.path = flags.schema
    }

    const gen = new Parcha(overrides);

    await gen.build();

    const time = Date.now() - start;
    console.log(
      bold(
        `Parcha generated types for ${underline(
          gen.getDocumentCount()
        )} documents in ${blueBright(`${time} ms`)}!`
      )
    );

    if (flags.watch) {
      console.log(italic('Now watching...'));
      await gen.watch();
    }
  }
}

export = ParchaCLI;

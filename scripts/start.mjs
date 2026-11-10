import {spawn} from 'node:child_process';
import {runtime} from './runtime.mjs';
const child=spawn(await runtime(),['.',...process.argv.slice(2)],{stdio:'inherit'});child.on('exit',code=>process.exit(code??0));

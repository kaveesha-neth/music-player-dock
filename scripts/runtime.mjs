import {existsSync} from 'node:fs';
import path from 'node:path';
export async function runtime(){try{const {default:e}=await import('electron');return e}catch{const e=path.resolve('.cache/electron/electron.exe');if(existsSync(e))return e;throw Error('Electron runtime missing. Run npm install.')}}

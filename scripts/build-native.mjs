import {spawnSync} from 'node:child_process';import fs from 'node:fs';import path from 'node:path';import os from 'node:os';
const home=path.resolve('.cache/dotnet');fs.mkdirSync(home,{recursive:true});
const args=['publish','native/MediaBridge/MediaBridge.csproj','-c','Release','-r','win-x64','--self-contained','true','-o','resources/bridge','-p:NuGetAudit=false'];
const fallback=path.join(os.homedir(),'.nuget/packages');if(fs.existsSync(fallback))args.push(`-p:RestoreAdditionalProjectFallbackFolders=${fallback}`);
const result=spawnSync('dotnet',args,{stdio:'inherit',env:{...process.env,DOTNET_CLI_HOME:home,DOTNET_CLI_TELEMETRY_OPTOUT:'1',DOTNET_SKIP_FIRST_TIME_EXPERIENCE:'1',DOTNET_GENERATE_ASPNET_CERTIFICATE:'false'}});process.exit(result.status??1);

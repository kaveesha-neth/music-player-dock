// Offline recovery for this development machine. Normal installations use npm ci.
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const npmRoot=path.join(path.dirname(process.execPath),'node_modules/npm/node_modules');
const cache=require(path.join(npmRoot,'cacache'));
(async()=>{const root=process.cwd(),cacheRoot=path.join(root,'.cache/_cacache');const records=await cache.ls(cacheRoot);
 for(const key of Object.keys(records).filter(k=>k.endsWith('.tgz'))){const data=await cache.get(cacheRoot,key);const url=key.split('request-cache:')[1];const name=decodeURIComponent(new URL(url).pathname.split('/-/')[0].slice(1));const dest=path.join(root,'node_modules',name);fs.mkdirSync(dest,{recursive:true});const tmp=path.join(root,'.cache/package.tgz');fs.writeFileSync(tmp,data.data);execFileSync('tar',['-xzf',tmp,'--strip-components=1','-C',dest]);}
 console.log('Restored cached packages.');
})().catch(e=>{console.error(e);process.exitCode=1});

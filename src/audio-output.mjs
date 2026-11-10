export function outputPresentation(output){
 const name=typeof output?.name==='string'&&output.name?output.name:'Windows output unavailable';
 const kind=output?.kind;
 const icon=kind==='headphones'?'headphones':kind==='speakers'?'laptop':kind==='display'?'display':kind==='none'?'none':'unknown';
 return {name,icon,label:`Windows output: ${name}. Open sound settings`};
}

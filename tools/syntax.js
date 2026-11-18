const fs=require('fs');const {lua,lauxlib,lualib,to_luastring}=require('fengari');
const site=require('path').join(__dirname,'..','dist');
const html=fs.readFileSync(site+'/fivem-script-garage.html','utf8');
const line=html.split('\n').find(l=>l.startsWith('window.GARAGE_DATA = '));
const data=JSON.parse(line.slice('window.GARAGE_DATA = '.length).replace(/;$/,''));
const blocks=[];
for(const L of data.lessons){const secs=[...L.sections,...L.deeper,{title:'task',parts:L.task.parts},{title:'fw',parts:L.framework||[]}];
 for(const s of secs)for(const p of s.parts)if(p.t==='code'&&p.lang==='lua')blocks.push([L.id+'/'+s.title+'/'+p.file,p.code]);}
for(const c of JSON.parse(fs.readFileSync(site+'/combos.json','utf8'))){for(const f of c.files)if(f.lang==='lua')blocks.push(['gen '+JSON.stringify(c.o).replace(/"name.*?description":"x",/,'')+' '+f.path,f.content]);}
let bad=0;
for(const [where,code] of blocks){
 const L=lauxlib.luaL_newstate();
 const src=code.replace(/`[^`]*`/g,'0'); // CfxLua compile-time hashes
 const r=lauxlib.luaL_loadstring(L,to_luastring(src));
 if(r!==0){bad++;console.log('SYNTAX',where,lua.lua_tojsstring(L,-1));}
}
console.log('checked',blocks.length,'Lua blocks,',bad,'with syntax errors');

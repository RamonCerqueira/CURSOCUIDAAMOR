const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript')
module.exports=function createLoader(overrides={}){
  const cache=new Map(),root=path.resolve(__dirname,'..')
  function load(file){
    const filename=path.resolve(root,file)
    if(cache.has(filename))return cache.get(filename).exports
    const mod=new Module(filename,module);mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));cache.set(filename,mod)
    mod.require=name=>{
      if(Object.prototype.hasOwnProperty.call(overrides,name))return overrides[name]
      if(name.startsWith('.')||name.startsWith('@/')){const target=name.startsWith('@/')?path.join(root,'src',name.slice(2)):path.resolve(path.dirname(filename),name);if(fs.existsSync(target+'.ts'))return load(target+'.ts')}
      return require(name)
    }
    mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,filename)
    return mod.exports
  }
  return load
}

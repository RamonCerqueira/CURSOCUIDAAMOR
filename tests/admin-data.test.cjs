const test=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const path=require('node:path')
const ts=require('typescript')
const Module=require('node:module')
function load(file){const filename=path.resolve(__dirname,'..',file),compiled=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;const mod=new Module(filename,module);mod.filename=filename;mod.paths=module.paths;mod._compile(compiled,filename);return mod.exports}
const {validateStudentRegistration,StudentRegistrationError}=load('src/lib/studentRegistration.ts')
const {parseAcademicCSV}=load('src/lib/adminPresentation.ts')

test('cadastro normaliza contato e preserva nome completo e limites legados',()=>{
  const result=validateStudentRegistration({nome:'  Aluno de teste  ',email:'  ALUNO@EXAMPLE.COM ',telefone:'(71) 99999-1234',cpf:'529.982.247-25',cep:'40000-000',nascimento:'2000-02-29',estado:'ba'})
  assert.equal(result.nome,'Aluno de teste');assert.equal(result.email,'aluno@example.com');assert.equal(result.telefone,'71999991234');assert.equal(result.cpf,'52998224725');assert.equal(result.cep,'40000000');assert.equal(result.estado,'BA');assert.equal(result.nascimento.toISOString().slice(0,10),'2000-02-29')
})
test('campos obrigatórios e tipos inválidos retornam erros associados ao campo',()=>{
  assert.throws(()=>validateStudentRegistration({nome:123,email:'invalido'}),error=>error instanceof StudentRegistrationError&&!!error.fields.nome&&!!error.fields.email)
})
test('rejeita CPF repetido, CPF com verificador inválido, telefone sem DDD e data inexistente',()=>{
  for(const cpf of ['11111111111','52998224724','abc'])assert.throws(()=>validateStudentRegistration({nome:'Aluno',email:'aluno@example.com',cpf}),error=>!!error.fields.cpf)
  assert.throws(()=>validateStudentRegistration({nome:'Aluno',email:'aluno@example.com',telefone:'123'}),error=>!!error.fields.telefone)
  assert.throws(()=>validateStudentRegistration({nome:'Aluno',email:'aluno@example.com',nascimento:'2025-02-29'}),error=>!!error.fields.nascimento)
})
test('rejeita valores que excedem colunas do cadastro legado',()=>{
  assert.throws(()=>validateStudentRegistration({nome:'a'.repeat(81),email:'a@example.com',bairro:'b'.repeat(26)}),error=>!!error.fields.nome&&!!error.fields.bairro)
})
test('CSV acadêmico mantém nomes com ponto e vírgula, aspas e quebras de linha',()=>{
  const rows=parseAcademicCSV('\uFEFF"Aluno";"Curso";"Media"\r\n"Nome; composto";"Curso ""especial""\nParte 2";"0"\r\n')
  assert.equal(rows.length,1);assert.equal(rows[0].Aluno,'Nome; composto');assert.equal(rows[0].Curso,'Curso "especial"\nParte 2');assert.equal(rows[0].Media,'0')
})
test('CSV vazio não cria registros fictícios',()=>assert.deepEqual(parseAcademicCSV(''),[]))

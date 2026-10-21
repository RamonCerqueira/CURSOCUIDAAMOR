// Reproduções isoladas das rotas: banco e sessão simulados, sem conexão externa.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript'),assert=require('node:assert/strict')
const NextResponse={json:(data,options={})=>({data,status:options.status||200,cookies:{set(){}}})}
function load(file,dependencies={}){
  const filename=path.resolve(__dirname,'..',file),mod=new Module(filename,module)
  mod.filename=filename;mod.paths=module.paths
  const original=mod.require.bind(mod)
  mod.require=name=>name==='next/server'?{NextResponse}:name in dependencies?dependencies[name]:original(name)
  mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,filename)
  return mod.exports
}
const actor={id:101,role:'ADMIN',nome:'Operador simulado'}
const common={
  '@/lib/courseApi':{requireCourseAdmin:async()=>({actor,response:null}),auditCourse:async()=>{}},
  '@/lib/ensureCursoTables':{ensureCursoTables:async()=>{}},
}
const approval=load('src/lib/courseApproval.ts')
async function run(){
  assert.equal(approval.approvalMinimumGrade(0,7),null)
  assert.equal(approval.approvalMinimumGrade(70,6),7)
  assert.equal(approval.approvalMinimumGrade(null,6),6)
  for(const input of [-1,101,'abc',true])assert.throws(()=>approval.parseApprovalPercentage(input))
  console.log('OK: 0% dispensa nota; percentual do curso prevalece; legado é preservado; entradas inválidas são rejeitadas.')

  // Sem registros práticos/finais: a rota consulta somente a média geral.
  const assessments=[{Etapa:'TEORICA',Nota:10,NotaMaxima:10,Peso:1}]
  const certificate=load('src/app/api/admin/certificados/route.ts',{
    ...common,'@/lib/courseApproval':approval,
    '@/lib/prisma':{prisma:{$queryRaw:async strings=>{
      const sql=strings.join('?')
      if(sql.includes('SELECT v.VinculoId'))return [{VinculoId:1,Situacao:'CONCLUIDO',ResultadoFinal:'APROVADO',PercentualMinimoAprovacao:70,FrequenciaMinima:null,NotaMinima:null}]
      if(sql.includes('AS Percentual'))return [{Percentual:null}]
      if(sql.includes('AS Media'))return [{Media:assessments.reduce((sum,n)=>sum+n.Nota/n.NotaMaxima*10,0)/assessments.length}]
      if(sql.includes('INSERT dbo.CursoCertificado'))return [{CertificadoId:1,CodigoValidacao:'SIMULADO'}]
      throw Error('Consulta não simulada')
    }}},
  })
  assert.equal((await certificate.POST(new Request('http://audit.local/api/admin/certificados',{method:'POST',body:JSON.stringify({vinculoId:1})}))).status,201)
  console.log('FALHA REPRODUZIDA: certificado aceito com média apenas teórica e sem avaliação prática/final.')

  const print=load('src/app/api/aluno/vinculos/[id]/impressos/route.ts',{
    '@/lib/courseAuth':{getStudentActor:async()=>actor},
    '@/lib/ensureCursoTables':common['@/lib/ensureCursoTables'],
    '@/lib/prisma':{prisma:{$queryRaw:async()=>[]}},
  })
  assert.equal((await print.GET(new Request('http://audit.local/api/aluno/vinculos/1/impressos'),{params:{id:'1'}})).status,404)
  console.log('FALHA REPRODUZIDA: impressão usada pelo certificado administrativo procura cadastro do próprio operador e retorna 404 quando ele não é aluno.')

  const update=load('src/app/api/admin/vinculos/[id]/route.ts',{
    ...common,'@/lib/courseApproval':approval,
    '@/lib/prisma':{prisma:{$queryRaw:async strings=>strings.join('?').includes('SELECT CodCli,CursoId,VersaoId')?[{CodCli:1,CursoId:1,VersaoId:1}]:[{VinculoId:2,TurmaId:99}]}},
  })
  assert.equal((await update.PATCH(new Request('http://audit.local/api/admin/vinculos/1',{method:'PATCH',body:JSON.stringify({situacao:'ATIVO'})}),{params:{id:'1'}})).status,409)
  console.log('FALHA REPRODUZIDA: reabertura bloqueada por vínculo em outra turma da mesma versão, embora a criação e o índice distingam as turmas.')

  const crypto=require('node:crypto'),salt=Buffer.alloc(16,1),hash=crypto.scryptSync('senha-simulada-atual',salt,64)
  const change=load('src/app/api/aluno/acesso/route.ts',{
    ...common,
    '@/lib/courseAuth':{getStudentActor:async()=>({id:1,role:'ALUNO',precisaTrocarSenha:true}),signStudentToken:()=> 'TOKEN_SIMULADO'},
    '@/lib/prisma':{prisma:{$queryRaw:async()=>[{HashSenha:hash,Salt:salt}],$executeRaw:async()=>1}},
  })
  assert.equal((await change.POST(new Request('http://audit.local/api/aluno/acesso',{method:'POST',body:JSON.stringify({novaSenha:'senha-nova-simulada',confirmarSenha:'senha-nova-simulada'})}))).status,200)
  console.log('FALHA REPRODUZIDA: token antigo com precisaTrocarSenha=true permite trocar senha sem validar a senha atual nem conferir o estado atual dessa obrigação no banco.')

  const professional=load('src/lib/courseProfessional.ts',{'@prisma/client':require('@prisma/client'),'./courseAuth':{getCourseActor:async()=>({id:1,role:'PRATICA'})}})
  assert.equal((await professional.requireTeacher(new Request('http://audit.local/api/docente/turmas?etapa=TEORICA'))).stage,'PRATICA')
  console.log('OK: docente não altera sua etapa enviando outro valor na URL.')
}
run().catch(error=>{console.error(error);process.exitCode=1})

export class StudentRegistrationError extends Error {
  constructor(public fields:Record<string,string>){super('Confira os campos do cadastro.');this.name='StudentRegistrationError'}
}

export type StudentRegistration = { nome:string;email:string;telefone:string|null;cpf:string|null;nascimento:Date|null;endereco:string|null;numero:string|null;complemento:string|null;bairro:string|null;cidade:string|null;estado:string|null;cep:string|null;observacao:string|null }

export function validateStudentRegistration(body:unknown):StudentRegistration {
  if(!body||typeof body!=='object'||Array.isArray(body))throw new StudentRegistrationError({nome:'Envie um cadastro válido.'})
  const input=body as Record<string,unknown>,fields:Record<string,string>={}
  const text=(key:string,max:number,required=false)=>{
    const raw=input[key]
    if(raw!==undefined&&raw!==null&&typeof raw!=='string'){fields[key]='Informe um texto válido.';return ''}
    const value=(typeof raw==='string'?raw:'').trim()
    if(required&&!value)fields[key]='Campo obrigatório.'
    else if(value.length>max)fields[key]=`Use no máximo ${max} caracteres.`
    return value
  }
  const nome=text('nome',80,true),email=text('email',255,true).toLowerCase()
  if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fields.email='Informe um e-mail válido.'
  const telefoneRaw=text('telefone',30),telefone=telefoneRaw.replace(/\D/g,'')||null
  if(telefoneRaw&&!telefone)fields.telefone='Informe um telefone válido.'
  if(telefone&&(telefone.length<10||telefone.length>11))fields.telefone='Informe DDD e telefone com 10 ou 11 dígitos.'
  const cpfRaw=text('cpf',20),cpf=cpfRaw.replace(/\D/g,'')||null
  if(cpfRaw&&!cpf)fields.cpf='Informe um CPF válido ou deixe o campo vazio.'
  if(cpf){
    let valid=cpf.length===11&&!/^(\d)\1{10}$/.test(cpf)
    for(let size=9;valid&&size<=10;size++){
      const sum=Array.from({length:size},(_,i)=>Number(cpf[i])*(size+1-i)).reduce((a,b)=>a+b,0)
      const digit=(sum*10)%11%10
      valid=digit===Number(cpf[size])
    }
    if(!valid)fields.cpf='Informe um CPF válido ou deixe o campo vazio.'
  }
  const rawBirth=text('nascimento',10)
  let nascimento:Date|null=null
  if(rawBirth){
    nascimento=new Date(rawBirth+'T12:00:00Z')
    if(!/^\d{4}-\d{2}-\d{2}$/.test(rawBirth)||Number.isNaN(nascimento.getTime())||nascimento.toISOString().slice(0,10)!==rawBirth||rawBirth>new Date().toISOString().slice(0,10))fields.nascimento='Informe uma data de nascimento válida.'
  }
  const endereco=text('endereco',60)||null,numero=text('numero',50)||null,complemento=text('complemento',30)||null,bairro=text('bairro',25)||null,cidade=text('cidade',30)||null
  const estado=text('estado',2).toUpperCase()||null
  if(estado&&!['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].includes(estado))fields.estado='Selecione uma UF válida.'
  const cepRaw=text('cep',12),cep=cepRaw.replace(/\D/g,'')||null
  if(cepRaw&&!cep)fields.cep='Informe um CEP válido ou deixe o campo vazio.'
  if(cep&&cep.length!==8)fields.cep='Informe um CEP com 8 dígitos.'
  const observacao=text('observacao',2000)||null
  if(Object.keys(fields).length)throw new StudentRegistrationError(fields)
  return {nome,email,telefone,cpf,nascimento,endereco,numero,complemento,bairro,cidade,estado,cep,observacao}
}

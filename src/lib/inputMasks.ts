export function registrationMask(field:string,value:string){
 const digits=value.replace(/\D/g,'')
 if(field==='cpf')return digits.slice(0,11).replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d{1,2})$/,'$1-$2')
 if(field==='cep')return digits.slice(0,8).replace(/(\d{5})(\d)/,'$1-$2')
 if(field==='telefone'){const n=digits.slice(0,11);if(n.length<3)return n;return `(${n.slice(0,2)}) ${n.slice(2)}`.replace(n.length>10?/(\d{5})(\d{1,4})$/:/(\d{4})(\d{1,4})$/,'$1-$2')}
 return value
}

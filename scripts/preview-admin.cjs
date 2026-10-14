// Local visual inspection of prerendered UI only. No database, authentication
// bypass, proxy, mutation API or private data is provided by this server.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path')
const root=path.resolve(__dirname,'..')
const pages=new Set(['dashboard','alunos','cursos','turmas','vinculos','relatorios'])
const mime={'.js':'application/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.rsc':'text/x-component','.html':'text/html; charset=utf-8'}
const server=http.createServer((request,response)=>{
  const url=new URL(request.url,'http://127.0.0.1:3041')
  if(url.pathname.startsWith('/api/')){response.writeHead(401,{'Content-Type':'application/json'});response.end(JSON.stringify({sucesso:false,mensagem:'Prévia visual: APIs desconectadas.'}));return}
  let target
  const page=url.pathname.split('/')[2]
  if(url.pathname.startsWith('/admin/')&&pages.has(page)&&url.pathname==='/admin/'+page){target=path.join(root,'.next/server/app/admin',page+(request.headers.rsc==='1'?'.rsc':'.html'))}
  else if(url.pathname.startsWith('/_next/static/'))target=path.resolve(root,'.next',url.pathname.slice('/_next/'.length))
  else if(url.pathname.startsWith('/images/'))target=path.resolve(root,'public',url.pathname.slice(1))
  else{response.writeHead(404);response.end('Not found');return}
  const allowed=[path.join(root,'.next')+path.sep,path.join(root,'public/images')+path.sep]
  if(!allowed.some(base=>target.startsWith(base))||!fs.existsSync(target)||!fs.statSync(target).isFile()){response.writeHead(404);response.end('Not found');return}
  response.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream','X-Cuida-Preview':'layout-only','Cache-Control':'no-store'})
  if(target.endsWith('.html')){let html=fs.readFileSync(target,'utf8');html=html.replace('</head>','<style>body::after{content:"PRÉVIA VISUAL · APIs desconectadas";position:fixed;right:12px;bottom:7px;z-index:200;color:#ba809a;font:9px Arial;background:#fff9fce8;padding:5px 8px;border-radius:5px;pointer-events:none}</style></head>');response.end(html)}else fs.createReadStream(target).pipe(response)
})
server.listen(3041,'127.0.0.1',()=>console.log('Prévia visual local: http://127.0.0.1:3041/admin/alunos'))
process.on('SIGINT',()=>server.close(()=>process.exit(0)))

import {NextResponse} from 'next/server'
import QRCode from 'qrcode'
import {prisma} from '@/lib/prisma'
export async function GET(request:Request,{params:routeParams}:{params:Promise<{codigo:string}>}){const params=await routeParams;
 const code=params.codigo.toUpperCase();if(!/^[A-F0-9]{48}$/.test(code))return new NextResponse('Código inválido.',{status:400})
 const [row]=await prisma.$queryRaw<any[]>`SELECT CertificadoId FROM dbo.CursoCertificado WHERE CodigoValidacao=${code} AND CanceladoEm IS NULL`
 if(!row)return new NextResponse('Certificado não disponível.',{status:404})
 const png=await QRCode.toBuffer(`${new URL(request.url).origin}/validar/${code}`,{type:'png',width:240,margin:2,errorCorrectionLevel:'M'})
 return new NextResponse(new Uint8Array(png),{headers:{'Content-Type':'image/png','Cache-Control':'no-store'}})
}

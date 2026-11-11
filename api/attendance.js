// Server-only proxy: Vercel env APPS_SCRIPT_URL + APPS_SCRIPT_TOKEN.
// Never return backend URL or token to browser.
const allowed=new Set(['bootstrap','mine','report','group','chooseGroup']);
const validId=s=>/^s\d{3,6}$/.test(String(s||''));
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(!['GET','POST'].includes(req.method))return res.status(405).json({ok:false,error:'פעולה לא נתמכת'});
 const url=process.env.APPS_SCRIPT_URL, token=process.env.APPS_SCRIPT_TOKEN;
 if(!url||!token)return res.status(503).json({ok:false,error:'החיבור ל-Google Sheets עדיין לא הופעל'});
 try{
  const target=new URL(url);
  if(target.protocol!=='https:'||target.hostname!=='script.google.com'||!target.pathname.startsWith('/macros/s/'))throw Error('bad configuration');
  const raw=req.method==='GET'?{action:req.query.action||'bootstrap',studentId:req.query.studentId}:typeof req.body==='string'?JSON.parse(req.body):req.body;
  if(!raw||!allowed.has(raw.action)||JSON.stringify(raw).length>3000)return res.status(400).json({ok:false,error:'בקשה לא תקינה'});
  const action=raw.action==='chooseGroup'?'group':raw.action;
  if(action!=='bootstrap'&&!validId(raw.studentId))return res.status(400).json({ok:false,error:'מזהה שגוי'});
  if(action==='group'&&!['שלישי','רביעי'].includes(raw.group))return res.status(400).json({ok:false,error:'קבוצה שגויה'});
  if(action==='report'&&(!['','נכחתי','לא נכחתי','מילואים'].includes(raw.status)||typeof raw.sessionId!=='string'||raw.sessionId.length>90))return res.status(400).json({ok:false,error:'דיווח שגוי'});
  const response=await fetch(target,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({...raw,action,token}),redirect:'follow',signal:AbortSignal.timeout(15000)});
  const txt=await response.text();let data;try{data=JSON.parse(txt)}catch{throw Error('Invalid Apps Script response')}
  if(!data||typeof data.ok!=='boolean')throw Error('Invalid API reply');
  if(data.ok&&action==='report')data.status=raw.status;
  return res.status(data.ok?200:400).json(data)
 }catch(err){console.error('Google Sheets backend unavailable:',err?.message);return res.status(502).json({ok:false,error:'שגיאת תקשורת עם Google Sheets'})}
}

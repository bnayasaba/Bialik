/**
 * תכנית ביאליק: API מאובטח ל-Google Sheets.
 * להגדרה ב-Project Settings > Script properties:
 * SHEET_ID = 1Y76RFQG5CtiQRQykAmdlQKQiW5UT0wHKs02tlUQJnlk
 * API_TOKEN = סוד אקראי ארוך, זהה ל-APPS_SCRIPT_TOKEN ב-Vercel.
 * Deploy > Web app > Execute as Me > Access Anyone.
 */
var GROUPS_=['שלישי','רביעי'], STATUSES_=['נכחתי','לא נכחתי','מילואים'];
function reply_(x){return ContentService.createTextOutput(JSON.stringify(x)).setMimeType(ContentService.MimeType.JSON)}
function sheet_(name){var id=PropertiesService.getScriptProperties().getProperty('SHEET_ID');if(!id)throw Error('SHEET_ID לא הוגדר');var sh=SpreadsheetApp.openById(id).getSheetByName(name);if(!sh)throw Error('לשונית חסרה: '+name);return sh}
function rows_(name){var sh=sheet_(name),count=sh.getLastRow();return count<2?[]:sh.getRange(2,1,count-1,name==='סטודנטים'?9:name==='מפגשים'?6:7).getDisplayValues()}
function students_(){return rows_('סטודנטים').filter(function(r){return r[0]&&r[3]==='כן'}).map(function(r){return {id:r[0],name:r[1],group:r[2]}})}
function sessions_(){return rows_('מפגשים').filter(function(r){return r[0]}).map(function(r){return {id:r[0],group:r[1],date:r[2],title:r[3],hours:Number(r[4])||7,active:r[5]==='כן'}})}
function reports_(studentId){var out={};rows_('דיווחים').forEach(function(r){if(r[1]===studentId&&r[0]&&STATUSES_.indexOf(r[3])>=0)out[r[2]]=r[3]});return out}
function doPost(e){try{
 var data=JSON.parse((e.postData&&e.postData.contents)||'{}');
 var secret=PropertiesService.getScriptProperties().getProperty('API_TOKEN');
 if(!secret||!data.token||data.token!==secret)return reply_({ok:false,error:'גישה לא מורשית'});
 var action=String(data.action||'');
 if(action==='bootstrap')return reply_({ok:true,students:students_(),sessions:sessions_()});
 var student=students_().find(function(s){return s.id===String(data.studentId||'')});
 if(!student)return reply_({ok:false,error:'הסטודנט לא נמצא'});
 if(action==='mine')return reply_({ok:true,reports:reports_(student.id)});
 if(action!=='group'&&action!=='report')return reply_({ok:false,error:'פעולה לא נתמכת'});
 var lock=LockService.getScriptLock();lock.waitLock(20000);
 try{
  if(action==='group'){
   var group=String(data.group||'');
   if(GROUPS_.indexOf(group)<0)return reply_({ok:false,error:'קבוצה לא תקינה'});
   var sh=sheet_('סטודנטים'),list=rows_('סטודנטים'),idx=list.findIndex(function(r){return r[0]===student.id});
   if(idx<0)throw Error('סטודנט חסר');
   var existing=list[idx][2];
   if(existing&&existing!=='טרם שויך'&&existing!==group)return reply_({ok:false,error:'לתיקון קבוצה פנו לרכז'});
   sh.getRange(idx+2,3).setValue(group);
   return reply_({ok:true,group:group})
  }
  var status=data.status,session=sessions_().find(function(s){return s.id===data.sessionId});
  if(STATUSES_.indexOf(status)<0&&status!=='')return reply_({ok:false,error:'סטטוס לא תקין'});
  // Re-read group after acquiring lock to prevent reports for moved students.
  student=students_().find(function(s){return s.id===String(data.studentId||'')});
  if(!session||!session.active||!(session.group===student.group||session.group==='שתי הקבוצות'))return reply_({ok:false,error:'מפגש לא זמין לקבוצה'});
  var reportSheet=sheet_('דיווחים'),values=rows_('דיווחים'),key=student.id+'|'+session.id;
  var position=values.findIndex(function(r){return r[0]===key});
  if(status===''){if(position>=0)reportSheet.deleteRow(position+2)}
  else{
   var record=[key,student.id,session.id,status,status==='נכחתי'?session.hours:0,new Date().toISOString(),'אתר'];
   if(position>=0)reportSheet.getRange(position+2,1,1,7).setValues([record]);else reportSheet.appendRow(record);
  }
  SpreadsheetApp.flush();
  return reply_({ok:true,reports:reports_(student.id)})
 }finally{lock.releaseLock()}
}catch(err){return reply_({ok:false,error:'תקלה בשמירה: '+String(err.message||err)})}}

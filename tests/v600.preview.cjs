// Local UI preview using fictitious data only. Never connects to Apps Script or writes files.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const stones = [['LIGHT','光'],['EARTH','地'],['DARK','暗'],['GRASS','草'],['WATER','水'],['POISON','毒'],['FIRE','火'],['ELECTRIC','電'],['ICE','冰'],['WIND','風'],['STEEL','鋼'],['CHAOS','混沌']].map(([code,attribute])=>({itemId:'STONE_'+code,name:attribute+'之石',attribute,increment:'5'}));
const pets = [{petId:'PET013',name:'森林夥伴',nickname:'',level:30,stage:3,exp:0,expNeed:0,image:'assets/pets/PET013_3.png',attribute:'草',movementType:'地面型',dialogs:['一起變強吧！'],landId:'SLOT001',x:45,y:70},{petId:'PET001',name:'小小火龍',nickname:'',level:8,stage:1,exp:40,expNeed:55,image:'assets/pets/PET001_1.png',attribute:'火',movementType:'天空型',dialogs:['一起努力！'],landId:'SLOT001',x:20,y:30}];
const inventory = [{itemId:'EXP010',quantity:8,config:{'名稱':'小經驗糖果','類型':'經驗型','效果值':10,'圖片':'assets/items/EXP001.png'}},...stones.map(s=>({itemId:s.itemId,quantity:4,config:{'名稱':s.name,'類型':'屬性石','效果值':5}}))];
const skillEnhancements = {PET013:{'ATTR-草-25':'20'}};
const petBattleConfigs = [{petId:'PET013',attribute:'草',specialName:'森林守護',specialDamage:150},{petId:'PET001',attribute:'火',specialName:'火焰守護',specialDamage:150}];
const core = ()=>({ok:true,version:'V6.0 PREVIEW',student:{id:'50501',name:'預覽學生',coins:1234},pets,lands:[{'土地ID':'SLOT001','背景ID':'LAND001',backgroundId:'LAND001',config:{'名稱':'草地','背景圖片':'assets/maps/MAP001.webp'}}],activeLandId:'SLOT001',backgrounds:['LAND001'],furniture:[],unreadMail:0,challengeStatus:{},skillEnhancements});
const bundle = ()=>({ok:true,pets,inventory,stones,petBattleConfigs,skillEnhancements,ready:true});
const applied = new Set();
function action(name,args) {
  if(name==='loginFastV596')return {ok:true,authToken:'local-preview-token',state:core()};
  if(name==='getPostLoginBundleV5101')return {core:core(),runtime:{inventory},challengeStatus:{}};
  if(name==='getUpgradeBundleV600')return bundle();
  if(name==='getStudentState')return {...core(),inventory,mailbox:[]};
  if(name==='getInventory')return inventory;
  if(name==='useAttributeStoneV600'){
    const [,petId,skillId,itemId,requestId]=args;
    if(!applied.has(requestId)){
      inventory.find(i=>i.itemId===itemId).quantity--;
      skillEnhancements[petId] ||= {};
      skillEnhancements[petId][skillId]=(BigInt(skillEnhancements[petId][skillId]||0)+5n).toString();
      applied.add(requestId);
    }
    return bundle();
  }
  if(name==='useExpItem'||name==='useExpItemsBatchV599'){
    const petId=name==='useExpItem'?args[2]:args[1];
    const uses=name==='useExpItem'?[{itemId:args[1],quantity:args[3]}]:args[2];
    const pet=pets.find(p=>p.petId===petId);let gained=0;
    if(pet.level<30){for(const use of uses){inventory.find(i=>i.itemId===use.itemId).quantity-=use.quantity;gained+=use.quantity*10;}pet.exp+=gained;while(pet.level<30&&pet.exp>=pet.expNeed){pet.exp-=pet.expNeed;pet.level++;pet.expNeed=20+(pet.level-1)*5;}if(pet.level>=30){pet.exp=0;pet.expNeed=0;}}
    return {...pet,ok:true,gained,inventory};
  }
  throw new Error('Preview action is not provided: '+name);
}
http.createServer((req,res)=>{
  if(req.url==='/mock-api'){
    let body='';req.on('data',chunk=>body+=chunk);req.on('end',()=>{
      try{const q=JSON.parse(body);res.setHeader('Content-Type','application/json');res.end(JSON.stringify({apiOk:true,result:action(q.action,q.args)}));}
      catch(e){res.end(JSON.stringify({apiOk:false,message:e.message}));}
    });return;
  }
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/config.js'){res.setHeader('Content-Type','application/javascript');res.end("window.API_URL='/mock-api';");return;}
  if(!['/','/index.html','/app.js','/style.css'].includes(url.pathname) && !url.pathname.startsWith('/assets/')){res.writeHead(404);res.end();return;}
  const file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp'};
  fs.readFile(file,(error,data)=>{if(error){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(data);});
}).listen(8765,'127.0.0.1',()=>console.log('Mock preview only: http://127.0.0.1:8765 (no Apps Script requests, no file/Sheet writes)'));

// Code-native gem icons. One deterministic SVG source and one 4x3 PNG asset.
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const colors=['#ffe787','#bc965d','#9b7ad4','#74ca73','#64baf5','#af76da','#f87555','#ffe154','#9bdff2','#95dacb','#a0b4c7','#d07bc0'];
const symbols=[
 '<path d="M0-20 5-5 20 0 5 5 0 20-5 5-20 0-5-5Z"/>',
 '<path d="M-21 14-6-15 4 3 12-8 23 14Z"/>',
 '<path d="M9-20A22 22 0 1 0 19 16A25 25 0 0 1 9-20Z"/>',
 '<path d="M-17 17Q-24-15 18-19Q25 18-17 17Z"/><path d="M-17 17 13-12" fill="none" stroke="#355f40"/>',
 '<path d="M0-23Q-31 9-13 22Q0 32 13 22Q31 9 0-23Z"/>',
 '<circle cy="-5" r="17"/><path d="M-12 12V23H12V12Z"/><circle cx="-6" cy="-5" r="4" fill="#604779"/><circle cx="6" cy="-5" r="4" fill="#604779"/>',
 '<path d="M0-25Q2-7 16-13Q35 20 0 27Q-32 20-15-5Q-14 12 0-25Z"/>',
 '<path d="M5-26-18 5H-2L-5 27 20-7H3Z"/>',
 '<path d="M0-24V24M-21-12 21 12M-21 12 21-12M-6-18 0-12 6-18M-6 18 0 12 6 18" fill="none"/>',
 '<path d="M-24-9H8Q26-9 17-22M-24 3H19Q33 3 24 15M-18 15H2" fill="none"/>',
 '<path d="M0-23 20-12V12L0 24-20 12V-12Z"/><path d="M0-12 10-6V6L0 12-10 6V-6Z" fill="#71869a"/>',
 '<path d="M0-24 8-8 24 0 8 8 0 24-8 8-24 0-8-8Z"/><circle r="7" fill="#75497c"/>'
];
const tiles=colors.map((color,i)=>`<g transform="translate(${i%4*128},${Math.floor(i/4)*128})"><path d="M35 17H93L116 51 98 101 64 118 30 101 12 51Z" fill="${color}" stroke="#344450" stroke-width="3"/><path d="M35 17 47 45H81L93 17M12 51 47 45 30 101M116 51 81 45 98 101M47 45 64 118 81 45" fill="none" stroke="#fff" opacity=".45" stroke-width="3"/><g transform="translate(64,66)" fill="#fff" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${symbols[i]}</g></g>`).join('');
async function run(){
 const dir=path.resolve(__dirname,'../assets/items/stones');fs.mkdirSync(dir,{recursive:true});
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="384" viewBox="0 0 512 384">${tiles}</svg>`;
 fs.writeFileSync(path.join(dir,'attribute-stones.svg'),svg);
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage();
  const png=await page.evaluate(async svg=>{const image=new Image();image.src='data:image/svg+xml;base64,'+btoa(svg);await image.decode();const canvas=document.createElement('canvas');canvas.width=512;canvas.height=384;canvas.getContext('2d').drawImage(image,0,0);return canvas.toDataURL('image/png').split(',')[1];},svg);
  fs.writeFileSync(path.join(dir,'attribute-stones.png'),Buffer.from(png,'base64'));console.log('Built single 512x384 stone sprite PNG.');
 }finally{await browser.close();}
}
run().catch(e=>{console.error(e);process.exitCode=1;});

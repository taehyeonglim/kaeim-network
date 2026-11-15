import fs from 'node:fs/promises';
import {chromium} from '@playwright/test';

// Render the official emblem as a code-native icon. The original logo file is untouched.
// The SVG viewport selects the emblem at the left of the full horizontal lockup.
const root=new URL('../',import.meta.url);
const logo=(await fs.readFile(new URL('public/brand/kaeim-logo.png',root))).toString('base64');
const icon=rounded=>`<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><defs><clipPath id="emblem"><rect x="23" y="12" width="210" height="232"/></clipPath></defs><rect width="256" height="256" rx="${rounded?46:0}" fill="white"/><g clip-path="url(#emblem)"><image x="27" y="2" width="801" height="253" href="data:image/png;base64,${logo}"/></g></svg>`;
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({deviceScaleFactor:1});
 const images=new Map();
 for(const [size,name,rounded] of [[16,'favicon-16.png',true],[32,'favicon-32.png',true],[48,'favicon-48.png',true],[180,'apple-touch-icon.png',false],[192,'icon-192.png',false],[512,'icon-512.png',false]]){
  const source='data:image/svg+xml;base64,'+Buffer.from(icon(rounded)).toString('base64');
  const encoded=await page.evaluate(async({source,size})=>{
   const image=new Image();image.src=source;await image.decode();
   const canvas=document.createElement('canvas');canvas.width=size;canvas.height=size;
   canvas.getContext('2d').drawImage(image,0,0,size,size);
   return canvas.toDataURL('image/png').split(',')[1];
  },{source,size});
  const bytes=Buffer.from(encoded,'base64');images.set(size,bytes);
  await fs.writeFile(new URL('public/'+name,root),bytes);
 }
 // ICO directory with actual 16/32/48px PNG entries; no Python/image-editing dependency.
 const sizes=[16,32,48],header=Buffer.alloc(6+sizes.length*16);header.writeUInt16LE(1,2);header.writeUInt16LE(sizes.length,4);
 let offset=header.length;
 sizes.forEach((size,i)=>{const p=6+i*16,data=images.get(size);header[p]=size;header[p+1]=size;header.writeUInt16LE(1,p+4);header.writeUInt16LE(32,p+6);header.writeUInt32LE(data.length,p+8);header.writeUInt32LE(offset,p+12);offset+=data.length;});
 await fs.writeFile(new URL('public/favicon.ico',root),Buffer.concat([header,...sizes.map(s=>images.get(s))]));
 console.log('Created favicon.ico (16/32/48), PNG favicons, Apple 180px and home-screen 192/512px icons.');
}finally{await browser.close();}

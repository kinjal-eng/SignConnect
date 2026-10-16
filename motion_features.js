/* Matches train_motion_v2.py: unmirrored 30 x 143 -> 30 x 149. */
(function(root){
const median = values => { const a=[...values].sort((x,y)=>x-y), n=a.length; return n%2?a[(n-1)/2]:(a[n/2-1]+a[n/2])/2; };
function features(sequence){
 const a=sequence.map(r=>Array.from(r));
 if(a.length!==30 || a.some(r=>r.length!==143 || !r.every(Number.isFinite))) throw Error('Invalid motion sequence');
 const reliable=a.filter(r=>r[131]>.5 && r[134]>.5);
 if(!reliable.length) throw Error('Keep both shoulders visible');
 const center=[0,1].map(k=>median(reliable.map(r=>(r[129+k]+r[132+k])/2)));
 const scale=Math.max(median(reliable.map(r=>Math.hypot(r[129]-r[132],r[130]-r[133]))),.05);
 const wrists=[];
 for(let slot=0;slot<2;slot++){
  const offset=slot*63, observed=a.map(r=>r[141+slot]>.5), usable=[...observed];
  const valid=observed.flatMap((v,i)=>v?[i]:[]);
  for(let i=1;i<valid.length;i++){
   const left=valid[i-1],right=valid[i];
   if(right-left>1 && right-left<=3) for(let t=left+1;t<right;t++){
    const f=(t-left)/(right-left);
    for(let j=0;j<63;j++)a[t][offset+j]=a[left][offset+j]*(1-f)+a[right][offset+j]*f;
    usable[t]=true;
   }
  }
  const wrist=a.map((r,t)=>usable[t]?[(r[offset]-center[0])/scale,(r[offset+1]-center[1])/scale,1]:[0,0,0]);
  wrists.push(wrist);
  a.forEach((r,t)=>{
   if(!usable[t]){r.fill(0,offset,offset+63);return;}
   const w=r.slice(offset,offset+3);
   const palm=Math.max(Math.hypot(...[0,1,2].map(k=>r[offset+27+k]-w[k])),.02);
   for(let j=0;j<63;j++)r[offset+j]=(r[offset+j]-w[j%3])/palm;
  });
 }
 a.forEach(r=>{for(let p=0;p<5;p++)for(let k=0;k<2;k++)r[126+3*p+k]=(r[126+3*p+k]-center[k])/scale;});
 return a.map((r,i)=>r.concat(wrists[0][i],wrists[1][i]));
}
function raw(results){
 const row=Array(143).fill(0);
 [results.leftHandLandmarks,results.rightHandLandmarks].forEach((hand,slot)=>{
  if(hand?.length===21){hand.forEach((p,j)=>{row[slot*63+j*3]=p.x;row[slot*63+j*3+1]=p.y;row[slot*63+j*3+2]=p.z;});row[141+slot]=1;}
 });
 if(results.poseLandmarks) [0,11,12,13,14].forEach((id,j)=>{const p=results.poseLandmarks[id];row[126+j*3]=p.x;row[127+j*3]=p.y;row[128+j*3]=p.visibility??0;});
 return row;
}
function resample(rows,times){
 if(rows.length<2 || times.length!==rows.length)throw Error('Not enough frames');
 return Array.from({length:30},(_,i)=>{
  const target=times[0]+(times.at(-1)-times[0])*i/29;
  let best=0;for(let j=1;j<times.length;j++)if(Math.abs(times[j]-target)<Math.abs(times[best]-target))best=j;
  return rows[best];
 });
}
root.MotionFeatures={features,raw,resample};
if(typeof module!=='undefined')module.exports=root.MotionFeatures;
})(typeof window!=='undefined'?window:globalThis);

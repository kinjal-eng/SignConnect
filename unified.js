'use strict';
const $=id=>document.getElementById(id);
let alphabetModel=null, alphabetLabels=[], alphabetTracker=null, stableLabel=null, stableFrames=0, releaseFrames=0, locked=false, acceptedAt=0, frameMode='alphabet';
const processCanvas=document.createElement('canvas'), processCtx=processCanvas.getContext('2d');
const mode=()=>$('recognition-mode').value;
const video=$('webcam'), canvas=$('overlay'), ctx=canvas.getContext('2d');
let model, labels=[], tracker, stream, running=false, busy=false, phase='idle';
let countdown=0, start=0, frameTime=0, rows=[], times=[], pending=null, sentence=sessionStorage.getItem('signconnect-sentence')||'';
const message=text=>{$('motion-message').textContent=text;};
function render(){ $('sentence').textContent=sentence; $('sentence-placeholder').hidden=!!sentence;sessionStorage.setItem('signconnect-sentence',sentence); }
function speak(text){if('speechSynthesis' in window)speechSynthesis.speak(new SpeechSynthesisUtterance(text));}
function resetCapture(){phase='idle';rows=[];times=[];pending=null;$('add-sign').disabled=true;$('record').disabled=mode()!=='motion'||!model||!running;}
async function devices(){
 const selected=$('camera-select').value;
 const list=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='videoinput');
 $('camera-select').replaceChildren(...list.map((d,i)=>new Option(d.label||`Camera ${i+1}`,d.deviceId)));
 if(list.some(d=>d.deviceId===selected))$('camera-select').value=selected;
}
async function startCamera(){
 $('start-camera').disabled=true;running=false;
 // An in-flight tracker send finishes before switching the stream.
 while(busy)await new Promise(r=>setTimeout(r,30));
 if(stream)stream.getTracks().forEach(t=>t.stop());
 resetCapture();
 try{
  const id=$('camera-select').value;
  stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{...(id?{deviceId:{exact:id}}:{}),width:{ideal:640},height:{ideal:480}}});
  video.srcObject=stream;await video.play();await devices();
  const actual=stream.getVideoTracks()[0].getSettings().deviceId;if(actual)$('camera-select').value=actual;
  if(!alphabetTracker){
   alphabetTracker=new Hands({locateFile:f=>`https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`});
   alphabetTracker.setOptions({maxNumHands:2,modelComplexity:1,minDetectionConfidence:.6,minTrackingConfidence:.5});
   alphabetTracker.onResults(r=>onResults({leftHandLandmarks:r.multiHandLandmarks?.[0],rightHandLandmarks:r.multiHandLandmarks?.[1]}));
  }
  if(!tracker){
   tracker=new Holistic({locateFile:f=>`https://cdn.jsdelivr.net/npm/@mediapipe/holistic@0.5.1675471629/${f}`});
   tracker.setOptions({modelComplexity:0,smoothLandmarks:true,enableSegmentation:false,refineFaceLandmarks:false,minDetectionConfidence:.5,minTrackingConfidence:.5,selfieMode:false});
   tracker.onResults(onResults);
  }
  running=true;$('status-dot').classList.add('live');$('status-text').textContent='Camera live';
  updateMode();loop();
 }catch(e){message(`Camera error: ${e.message}. Close other camera apps and retry.`);console.error(e);}
 finally{$('start-camera').disabled=false;}
}
async function loop(){
 if(!running)return;
 busy=true;
 try{
  frameMode=mode();
  const ratio=Math.min(1,640/Math.max(video.videoWidth,video.videoHeight));
  const w=Math.max(1,Math.round(video.videoWidth*ratio)),h=Math.max(1,Math.round(video.videoHeight*ratio));
  if(processCanvas.width!==w||processCanvas.height!==h){processCanvas.width=w;processCanvas.height=h;}
  processCtx.drawImage(video,0,0,w,h);frameTime=performance.now();
  await (frameMode==='alphabet'?alphabetTracker:tracker).send({image:processCanvas});
 }
 catch(e){running=false;resetCapture();message(`Tracking error: ${e.message}. Restart the camera.`);}
 finally{busy=false;}
 if(running)requestAnimationFrame(loop);
}
function onResults(result){
 if(frameMode!==mode())return;
 canvas.width=video.videoWidth||640;canvas.height=video.videoHeight||480;ctx.clearRect(0,0,canvas.width,canvas.height);
 for(const hand of [result.leftHandLandmarks,result.rightHandLandmarks])if(hand){drawConnectors(ctx,hand,HAND_CONNECTIONS,{color:'#ff8a5b',lineWidth:2});drawLandmarks(ctx,hand,{color:'#6ee7b7',radius:3});}
 
 if(mode()==='alphabet'){void alphabetPrediction(result.leftHandLandmarks);return;}
 const now=frameTime;
 if(phase==='countdown'){
  if(now<countdown){message(`Get ready: ${Math.ceil((countdown-now)/1000)}`);return;}
  phase='recording';start=now;rows=[];times=[];
 }
 if(phase!=='recording')return;
 rows.push(MotionFeatures.raw(result));times.push(now);
 message(`Sign now — ${Math.max(0,(2500-(now-start))/1000).toFixed(1)} seconds`);
 if(now-start>=2500){phase='predicting';$('recognition-mode').disabled=true;$('start-camera').disabled=true;message('Recognizing…');void predict(rows,times);}
}
async function predict(data,timestamps){
 let input,output;
 try{
  const fps=(data.length-1)*1000/(timestamps.at(-1)-timestamps[0]);
  const shoulders=data.filter(r=>r[131]>.5&&r[134]>.5).length/data.length;
  if(data.length<20 || fps<8)throw Error('Too few camera frames. Keep the phone connection stable and try again');
  if(shoulders<.6)throw Error('Keep both shoulders in view and try again');
  const features=MotionFeatures.features(MotionFeatures.resample(data,timestamps));
  input=tf.tensor3d([features],[1,30,149]);output=model.predict(input);
  const probs=Array.from(await output.data());
  const rank=probs.map((p,i)=>({p,label:labels[i]})).sort((a,b)=>b.p-a.p);
  const best=rank[0];$('confidence-label').textContent=`${best.label.replaceAll('_',' ')} — ${(best.p*100).toFixed(0)}%`;
  if(best.label==='NONE'){message('No sign recognized. Nothing added.');}
  else if(best.p<.75){message('Uncertain result. Record the sign again.');}
  else{pending=best.label;$('add-sign').disabled=false;message(`Prediction: ${best.label.replaceAll('_',' ')}. Click Add result if correct, or record again.`);}
 }catch(e){message(e.message);console.error(e);}
 finally{$('recognition-mode').disabled=false;$('start-camera').disabled=false;input?.dispose();output?.dispose();phase='idle';$('record').disabled=mode()!=='motion'||!running||!model;}
}
$('record').onclick=()=>{if(mode()!=='motion'||phase!=='idle'||!model||!running)return;pending=null;$('confidence-label').textContent='Waiting to record';$('add-sign').disabled=true;$('record').disabled=true;phase='countdown';countdown=performance.now()+2000;message('Get ready: 2');};
$('add-sign').onclick=()=>{if(!pending)return;const text=pending==='SPACE'?' ':pending.replaceAll('_',' ');sentence+=text;render();if(text.length>1&&$('toggle-autospeak').checked)speak(text);pending=null;$('add-sign').disabled=true;message('Added. Use Space between words, then record the next sign.');};
$('btn-clear').onclick=()=>{sentence='';pending=null;$('add-sign').disabled=true;render();};
$('btn-backspace').onclick=()=>{sentence=sentence.slice(0,-1);render();};
$('btn-space').onclick=()=>{sentence+=' ';render();};
$('btn-speak').onclick=()=>{if(sentence.trim())speak(sentence.trim());};
$('start-camera').onclick=startCamera;
$('camera-select').onchange=()=>{message('Click Start camera to use the selected camera.');};
window.addEventListener('pagehide',()=>{running=false;stream?.getTracks().forEach(t=>t.stop());});
function updateMode(){
 resetCapture();resetSpace();stableFrames=0;stableLabel=null;locked=false;releaseFrames=0;
 const motion=mode()==='motion';
 $('record').hidden=!motion;$('add-sign').hidden=!motion;
 $('mode-help').textContent=motion?'Show head, shoulders, elbows and hands. Click Record, wait for Sign now, then perform one sign over 2.5 seconds.':'Hold a letter steady, then remove your hand after capture. Select J, Z and phrases for moving signs.';
 $('mode-help').textContent+=' Trained SPACE: select motion mode, record both open palms, then click Add result.';
 $('confidence-label').textContent='Ready for a new sign';
 const ready=motion?model:alphabetModel;
 message(ready?(running?(motion?'Ready. Click Record one sign.':'Ready. Show an alphabet letter.'):'Model ready. Select your camera and click Start camera.'):'Selected model is unavailable. Check the model files.');
}
let alphabetBusy=false;
let spaceStart=null, spaceLast=0, spaceSamples=0, spaceRelease=null, spaceLocked=false, alphabetEpoch=0;
function resetSpace(){spaceStart=null;spaceLast=0;spaceSamples=0;spaceRelease=null;spaceLocked=false;alphabetEpoch++;}
function openPalm(hand){
 if(!hand||hand.length!==21||!hand.every(p=>[p.x,p.y,p.z].every(Number.isFinite)))return false;
 const v=(a,b)=>[a.x-b.x,a.y-b.y,a.z-b.z];
 const norm=a=>Math.hypot(...a), distance=(a,b)=>norm(v(a,b));
 const straight=(a,b,c)=>{
  const u=v(a,b),w=v(c,b),den=norm(u)*norm(w);
  return den>1e-8 && u.reduce((n,x,i)=>n+x*w[i],0)/den < -.85;
 };
 const palm=distance(hand[0],hand[9]);if(palm<.01)return false;
 for(const [m,p,d,t] of [[5,6,7,8],[9,10,11,12],[13,14,15,16],[17,18,19,20]]){
  if(!straight(hand[m],hand[p],hand[d])||!straight(hand[p],hand[d],hand[t])||
     distance(hand[t],hand[0])<distance(hand[p],hand[0])*1.12)return false;
 }
 return straight(hand[1],hand[2],hand[3])&&straight(hand[2],hand[3],hand[4])&&
        distance(hand[4],hand[5])>palm*.45;
}
function handleSpace(left,right,now){
 if(phase!=='idle'){spaceStart=null;spaceSamples=0;spaceRelease=null;return false;}
 if(spaceLocked){
  alphabetEpoch++;stableFrames=0;stableLabel=null;
  if(!left&&!right){
   if(spaceRelease===null)spaceRelease=now;
   if(now-spaceRelease>=300){spaceLocked=false;spaceRelease=null;locked=false;message('Ready for the next sign.');}
  }else spaceRelease=null;
  return true;
 }
 if(!left||!right){spaceStart=null;spaceSamples=0;return false;}
 // With two hands visible, never send one of them to the single-hand alphabet model.
 alphabetEpoch++;stableFrames=0;stableLabel=null;
 if(!openPalm(left)||!openPalm(right)){
  spaceStart=null;spaceSamples=0;
  $('confidence-label').textContent='Space: open both palms, fingers straight';
  return true;
 }
 if(spaceStart===null||now-spaceLast>400){spaceStart=now;spaceSamples=0;}
 spaceLast=now;spaceSamples++;
 $('confidence-label').textContent='Hold both palms for Space…';
 if(now-spaceStart>=1000&&spaceSamples>=5){
  spaceLocked=true;spaceRelease=null;spaceStart=null;locked=true;
  if(sentence && !/\s$/.test(sentence)){sentence+=' ';render();message('Space added. Lower BOTH hands before the next sign.');}
  else message('No extra space needed. Lower BOTH hands before the next sign.');
  $('confidence-label').textContent='Lower BOTH hands to reset';
 }
 return true;
}
async function alphabetPrediction(hand){
 if(!hand){stableFrames=0;stableLabel=null;if(++releaseFrames>=5)locked=false;return;}
 releaseFrames=0;
 if(locked){$('confidence-label').textContent='Remove hand for next letter';return;}
 if(!alphabetModel||alphabetBusy)return;
 alphabetBusy=true;const epoch=alphabetEpoch;let input,output;
 try{
  const wrist=hand[0], points=hand.map(p=>[p.x-wrist.x,p.y-wrist.y,p.z-wrist.z]);
  const scale=Math.hypot(...points[9]);if(!Number.isFinite(scale)||scale<1e-6)return;
  const features=points.flatMap(p=>p.map(v=>v/scale));if(!features.every(Number.isFinite))return;
  input=tf.tensor2d([features],[1,63]);output=alphabetModel.predict(input);
  const scores=Array.from(await output.data());if(mode()!=='alphabet'||epoch!==alphabetEpoch||spaceLocked)return;
  const best=scores.indexOf(Math.max(...scores)), label=alphabetLabels[best], confidence=scores[best];
  if(label==='J'||label==='Z'){stableFrames=0;stableLabel=null;$('confidence-label').textContent='Use J, Z and phrases mode for this moving letter';return;}
  $('confidence-label').textContent=`${label} — ${(confidence*100).toFixed(0)}%`;
  if(confidence<.85){stableFrames=0;stableLabel=null;return;}
  stableFrames=label===stableLabel?stableFrames+1:1;stableLabel=label;
  if(stableFrames>=4&&Date.now()-acceptedAt>=700){sentence+=label;render();locked=true;acceptedAt=Date.now();stableFrames=0;message('Letter captured. Remove hand for the next letter.');}
 }catch(e){message(`Alphabet recognition error: ${e.message}`);}
 finally{input?.dispose();output?.dispose();alphabetBusy=false;}
}
$('recognition-mode').onchange=updateMode;
render();
(async()=>{
 try{
  const response=await fetch('model_v3/labels.json');if(!response.ok)throw Error('Alphabet labels missing');
  alphabetLabels=await response.json();alphabetModel=await tf.loadLayersModel('model_v3/model.json');
  if(alphabetModel.inputs[0].shape.at(-1)!==63||alphabetModel.outputs[0].shape.at(-1)!==alphabetLabels.length)throw Error('Alphabet model shape mismatch');
 }catch(e){alphabetModel=null;console.error(e);}

 try{
  const response=await fetch('model_motion_space/labels.json');if(!response.ok)throw Error('Motion model files missing. Run export_motion.py first');
  labels=await response.json();model=await tf.loadLayersModel('model_motion_space/model.json');
  if(model.inputs[0].shape.slice(1).join(',')!=='30,149'||model.outputs[0].shape.at(-1)!==labels.length||!labels.includes('NONE'))throw Error('Motion model or labels do not match');
  message('Model ready. Select your phone camera and click Start camera.');
 }catch(e){model=null;message(`Model unavailable: ${e.message}`);}
 try{await devices();}catch(e){console.error(e);}
 updateMode();
})();

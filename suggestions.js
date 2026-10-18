/* SignConnect: local, user-confirmed vocabulary suggestions. */
(function () {
  'use strict';
  const words = ('HELLO HELP HI HOW HAPPY HUNGRY HOSPITAL HOME GOOD GOODBYE MORNING AFTERNOON EVENING NIGHT THANK THANKS THANK YOU YES NO PLEASE SORRY I AM NEED WANT FEEL HAVE LIKE LOVE CAN COULD WOULD WILL DO NOT KNOW UNDERSTAND WATER FOOD REST TOILET MEDICINE DOCTOR CALL SOMEONE MY NAME IS YOUR WHAT WHERE WHEN WHY TODAY TOMORROW NOW LATER COME GO STOP WAIT MORE AGAIN FINE TIRED SICK PAIN HOT COLD OKAY BYE ME IT THE A TO FOR AND').split(' ');
  const vocabulary = [...new Set(words)];
  const contexts = [
    ['THANK', ['YOU']], ['I NEED', ['HELP', 'WATER', 'FOOD']],
    ['I WANT', ['WATER', 'FOOD', 'REST']], ['I AM', ['FINE', 'HUNGRY', 'TIRED']],
    ['I FEEL', ['SICK', 'COLD', 'TIRED']], ['I DO NOT', ['UNDERSTAND', 'KNOW']],
    ['HOW ARE', ['YOU']], ['MY NAME', ['IS']], ['GOOD', ['MORNING', 'EVENING', 'NIGHT']],
    ['PLEASE', ['HELP', 'WAIT', 'COME']], ['CAN', ['YOU', 'I']],
    ['I', ['NEED', 'AM', 'WANT']], ['HELLO', ['HOW', 'PLEASE', 'I']]
  ];
  function suggest(text) {
    const raw = String(text || '');
    const clean = raw.trim().toUpperCase().replace(/\s+/g, ' ');
    if (!clean) return [];
    const trailing = /\s$/.test(raw);
    const match = raw.match(/([A-Za-z]+)$/);
    const partial = match ? match[1].toUpperCase() : '';
    const base = match ? raw.slice(0, -match[1].length) : raw;
    const append = value => ({label:value, value:raw.trimEnd()+' '+value+' '});
    const completed = contexts.find(([key]) => clean === key || clean.endsWith(' '+key));
    if (completed) return completed[1].map(append).slice(0,3);
    if (!trailing && partial) {
      const previous = base.trim().toUpperCase().replace(/\s+/g, ' ');
      const context = contexts.find(([key]) => previous === key || previous.endsWith(' '+key));
      const preferred = context ? context[1] : [];
      const candidates = [...new Set([...preferred, ...vocabulary])].filter(w=>w.startsWith(partial) && w!==partial);
      if(candidates.length) return candidates.slice(0,3).map(w=>({label:w,value:base+w+' '}));
      if(!vocabulary.includes(partial)) return []; // Never silently guess a correction.
    }
    return ['PLEASE','THANK YOU','I'].map(append);
  }
  if (typeof module !== 'undefined' && module.exports) {module.exports={suggest};return;}
  const transcript=document.getElementById('sentence');
  if (!transcript || typeof sentence === 'undefined' || typeof render !== 'function') return;
  const host=document.createElement('div');
  host.id='sentence-suggestions'; host.setAttribute('aria-label','Word suggestions');
  const label=document.createElement('p'); label.className='suggestion-caption';label.textContent='Suggestions · tap to add';
  const buttons=document.createElement('div');buttons.className='suggestion-buttons';
  host.append(label,buttons);transcript.insertAdjacentElement('afterend',host);
  const style=document.createElement('style');
  style.textContent='#sentence-suggestions{margin-top:16px;border-top:1px solid #efb7ce;padding-top:12px}.suggestion-caption{margin:0 0 8px;font-size:11px;color:#805267}.suggestion-buttons{display:flex;gap:8px;flex-wrap:wrap}.suggestion-buttons button{font:600 12px inherit;background:#fffafb;color:#762345;border:1px solid #e8b9cd;border-radius:18px;padding:9px 14px;min-height:40px;cursor:pointer}.suggestion-buttons button:hover{background:#f9dce7}.suggestion-buttons button:focus-visible{outline:3px solid #a33162;outline-offset:2px}';
  document.head.appendChild(style);
  function refresh(){
    const original=sentence; const items=suggest(original);buttons.replaceChildren();host.hidden=!items.length;
    items.forEach(item=>{const button=document.createElement('button');button.type='button';button.textContent=item.label;
      button.addEventListener('click',()=>{if(sentence!==original){refresh();return;}sentence=item.value;render();refresh();});buttons.appendChild(button);});
  }
  new MutationObserver(refresh).observe(transcript,{childList:true,characterData:true,subtree:true});
  refresh();
})();

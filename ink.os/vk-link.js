/* INK.OS VK client linking */
(function(){
  const API='https://jgzzdsittnzomedvsspj.supabase.co/functions/v1/inkos-vk-link';
  const GROUP_URL='https://vk.com/im?sel=-165526060';
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  async function post(body){
    const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const d=await r.json().catch(()=>({}));
    if(!r.ok||!d.ok)throw new Error(d.error||('HTTP '+r.status));
    return d;
  }
  window.startVkLink=async function(id){
    const c=(S.clients||[]).find(x=>String(x.id)===String(id));
    if(!c){toast('Клиент не найден');return;}
    if(!window.crypto||!crypto.getRandomValues){toast('Браузер не поддерживает генерацию кода');return;}
    const hex=n=>Array.from(crypto.getRandomValues(new Uint8Array(n))).map(b=>b.toString(16).padStart(2,'0')).join('').toUpperCase();
    const token=hex(6),statusKey=hex(16),code='INK-'+token;
    openModal('<div class="modal-header"><h3>Подключение ВКонтакте</h3><button class="x" onclick="closeModal()">✕</button></div>'+
      '<div class="cl-card"><div class="cl-lbl">Код привязки</div><div style="font-size:24px;font-weight:800;letter-spacing:1px;padding:12px 0;word-break:break-word" id="vkLinkCode">'+code+'</div><button class="btn btn-primary btn-block" id="vkCopyCode">Скопировать код</button></div>'+
      '<div class="cl-card"><div class="cl-lbl">Инструкция клиенту</div><ol style="padding-left:20px;line-height:1.65"><li>Откройте сообщения сообщества.</li><li>Отправьте код <b>'+code+'</b> одним сообщением.</li><li>После ответа бота напишите <b>ДА</b>, чтобы подтвердить согласие на напоминания.</li></ol><a class="btn btn-block" href="'+GROUP_URL+'" target="_blank" rel="noopener">Открыть сообщения сообщества ↗</a></div>'+
      '<div class="cl-card"><div class="cl-lbl">Статус</div><div id="vkLinkStatus">Создаю код…</div></div>');
    const status=()=>document.getElementById('vkLinkStatus');
    document.getElementById('vkCopyCode').onclick=async()=>{try{await navigator.clipboard.writeText(code);toast('Код скопирован');}catch(e){toast('Выделите код и скопируйте вручную');}};
    try{
      await post({token,clientId:String(c.id),name:String(c.name||''),phone:String(c.phone||''),statusKey});
      c.vkLinkToken=token;c.vkLinkStatusKey=statusKey;c.reminderChannel='vk';
      await idbPut('clients',c);
      const i=S.clients.findIndex(x=>String(x.id)===String(c.id));if(i>=0)S.clients[i]=c;
      if(status())status().textContent='Код создан. Жду, пока клиент отправит его в сообщения сообщества.';
    }catch(e){if(status())status().textContent='Ошибка создания кода: '+String(e.message||e);return;}
    const end=Date.now()+300000;
    while(Date.now()<end){
      await sleep(4000);
      try{
        const d=await post({action:'status',statusKey});
        if(d.status==='waiting_confirmation'){if(status())status().textContent='Код принят. Попросите клиента ответить «ДА».';}
        else if(d.status==='linked'){
          c.reminderConsent=true;c.reminderConsentAt=d.consentAt||new Date().toISOString();c.reminderConsentSource='vk_callback_confirmation';c.reminderChannel='vk';c.vkLinked=true;c.vkLinkToken='';
          await idbPut('clients',c);const i=S.clients.findIndex(x=>String(x.id)===String(c.id));if(i>=0)S.clients[i]=c;
          if(status())status().innerHTML='<b style="color:var(--green)">ВКонтакте подключён. Согласие подтверждено.</b>';
          toast('Клиент подключён к VK');return;
        }else if(status())status().textContent='Ожидаю код и подтверждение согласия клиента…';
      }catch(e){}
    }
    if(status())status().textContent='Пока нет подтверждения. Код можно использовать, пока вы не создадите новый.';
  };
  let activeClientId=null;
  function injectVkButton(){
    if(!activeClientId)return;
    const area=document.querySelector('#modalBody .cl-actions, .modal-body .cl-actions, .cl-actions');
    if(!area||area.querySelector('[data-vk-link-button]'))return;
    const b=document.createElement('button');
    b.type='button';b.className='btn';b.dataset.vkLinkButton='1';
    b.textContent='Подключить VK';
    b.style.gridColumn='1 / -1';
    b.onclick=()=>window.startVkLink(activeClientId);
    area.appendChild(b);
  }
  const original=window.openClient;
  if(typeof original==='function'){
    window.openClient=function(id,tab){
      activeClientId=id;
      const result=original.apply(this,arguments);
      setTimeout(injectVkButton,0);
      setTimeout(injectVkButton,100);
      return result;
    };
  }
  // Also handle client cards rendered after this script initializes.
  const observer=new MutationObserver(()=>injectVkButton());
  function observeModal(){
    const root=document.querySelector('#modalOverlay')||document.body;
    observer.observe(root,{childList:true,subtree:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observeModal,{once:true});
  else observeModal();
})();

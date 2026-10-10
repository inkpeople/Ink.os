/* INK.OS — годовой сценарий поддержки и возврата клиентов */
(function(){
  if(typeof NAV==='undefined'||typeof RENDERERS==='undefined'||typeof S==='undefined') return;
  if(!NAV.some(function(n){return n.id==='retention';})) NAV.splice(3,0,{id:'retention',label:'Возврат клиентов',icon:'clients'});
  var milestones=[
    {days:0,hours:2,tag:'after2h',title:'Через 2 часа',kind:'care'},
    {days:3,tag:'day3',title:'3 дня',kind:'care'},
    {days:7,tag:'day7',title:'7 дней',kind:'care'},
    {days:14,tag:'day14',title:'14 дней',kind:'care'},
    {days:30,tag:'day30',title:'30 дней',kind:'return'},
    {days:60,tag:'day60',title:'60 дней',kind:'return'},
    {days:90,tag:'day90',title:'3 месяца',kind:'return'},
    {days:120,tag:'day120',title:'4 месяца',kind:'return'},
    {days:180,tag:'day180',title:'6 месяцев',kind:'return'},
    {days:270,tag:'day270',title:'9 месяцев',kind:'return'},
    {days:365,tag:'day365',title:'1 год',kind:'return'}
  ];
  function getTasks(){
    var sent=new Set((S.notifications||[]).filter(function(n){return n.type==='retention-sent';}).map(function(n){return n.refId;}));
    var now=new Date(),tasks=[];
    (S.events||[]).filter(function(e){return e.type==='session'&&e.status==='completed'&&e.clientId&&e.date;}).forEach(function(ev){
      var client=(S.clients||[]).find(function(c){return c.id===ev.clientId;});
      if(!client)return;
      var base=new Date(ev.date+'T'+(ev.end||ev.start||'12:00'));
      if(isNaN(base.getTime()))return;
      milestones.forEach(function(m){
        var ref='retention:'+ev.id+':'+m.tag;
        if(sent.has(ref))return;
        var due=new Date(base.getTime()+m.days*86400000+(m.hours||0)*3600000);
        if(due.getTime()-now.getTime()>365*86400000)return;
        var name=client.name||'';
        var messages={
          after2h:'Привет, '+name+'! Как самочувствие после сеанса? Если появятся вопросы по уходу за татуировкой, напиши мне — помогу разобраться.',
          day3:'Привет, '+name+'! Как проходит заживление татуировки? Всё ли спокойно? Если что-то беспокоит, напиши мне и при необходимости пришли фото.',
          day7:'Привет, '+name+'! Как чувствует себя татуировка спустя неделю? Если есть вопросы по уходу или заживлению — я на связи.',
          day14:'Привет, '+name+'! Уже две недели после сеанса. Как выглядит татуировка сейчас? Можешь прислать фото, если удобно.',
          day30:'Привет, '+name+'! Как тебе татуировка спустя месяц? Если захочешь продолжить композицию или обсудить новую идею, можем подобрать дату для следующего сеанса.',
          day60:'Привет, '+name+'! Как выглядит татуировка после заживления? Если планируешь продолжение проекта или новую работу, напиши — обсудим эскиз и удобную дату.',
          day90:'Привет, '+name+'! Как тебе татуировка спустя три месяца? Если появилась идея для следующей работы, могу помочь продумать композицию и подобрать время.',
          day120:'Привет, '+name+'! Заглядываю узнать, как тебе татуировка. Если захочешь добавить детали или начать новый проект, буду рад обсудить идею.',
          day180:'Привет, '+name+'! Уже полгода с нашей татуировки. Как она тебе сейчас? Если есть задумка для продолжения или новой татуировки, можем спланировать следующий сеанс.',
          day270:'Привет, '+name+'! Как тебе наша работа спустя девять месяцев? Если давно откладывал новую идею, самое время её обсудить — без спешки подберём эскиз и дату.',
          day365:'Привет, '+name+'! Год назад мы сделали твою татуировку. Как тебе результат? Спасибо, что доверил мне свою идею. Если захочешь новый проект или продолжение, буду рад снова поработать с тобой.'
        };
        tasks.push({refId:ref,client:client,event:ev,milestone:m,due:due,message:messages[m.tag],now:now});
      });
    });
    return tasks.sort(function(a,b){return a.due-b.due;});
  }
  function channelLink(c,channel,message){
    var raw=String(channel==='vk'?(c.vk||''):(c.telegram||'')).trim();
    if(!raw)return '';
    var lower=raw.toLowerCase();
    if(channel==='telegram'){
      if(/^https?:\/\//i.test(raw))return raw;
      raw=raw.replace(/^@/,'').replace(/^(https?:\/\/)?(www\.)?(t\.me|telegram\.me)\//i,'').replace(/\/$/,'');
      return raw?'https://t.me/'+raw:'';
    }
    if(/^https?:\/\//i.test(raw))return raw;
    raw=raw.replace(/^@/,'').replace(/^(www\.)?vk\.com\//i,'').replace(/\/$/,'');
    if(/^id?[0-9]+$/i.test(raw))return 'https://vk.com/im?sel='+raw.replace(/^id/i,'');
    return raw?'https://vk.com/'+raw:'';
  }
  function safe(s){return esc(String(s==null?'':s));}
  RENDERERS.retention=function(){
    var all=getTasks(),now=new Date(),q=(window._retentionQuery||'').toLowerCase();
    var due=all.filter(function(t){return t.due<=now;});
    var future=all.filter(function(t){return t.due>now;});
    var filtered=all.filter(function(t){return !q||[t.client.name,t.client.phone,t.client.instagram,t.client.telegram,t.client.whatsapp,t.client.vk,t.milestone.title].filter(Boolean).join(' ').toLowerCase().indexOf(q)>=0;});
    window._retentionMessageMap={};
    filtered.forEach(function(t){window._retentionMessageMap[t.refId]=t.message;});
    var cards=filtered.map(function(t){
      var vkLink=channelLink(t.client,'vk',t.message),tgLink=channelLink(t.client,'telegram',t.message),dueText=t.due.toLocaleString('ru-RU',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
      return '<div class="card" style="margin-bottom:9px;border-left:3px solid '+(t.milestone.kind==='care'?'#20b2aa':'#e53935')+'">'+
        '<div class="row" style="align-items:flex-start;gap:10px;flex-wrap:wrap"><div style="flex:1;min-width:180px">'+
        '<div class="row" style="justify-content:flex-start;gap:7px;flex-wrap:wrap"><b>'+safe(t.client.name)+'</b><span class="badge '+(t.due<=now?'badge-vip':'badge-new')+'">'+safe(t.milestone.title)+'</span></div>'+
        '<div class="small dim" style="margin-top:4px">'+(t.due<=now?'Касание ожидает отправки':'Запланировано')+' · '+safe(dueText)+(t.event.date?' · сеанс '+safe(fmtDate(t.event.date)):'')+'</div>'+
        '<div style="margin-top:10px;line-height:1.5;white-space:pre-wrap">'+safe(t.message)+'</div></div></div>'+
        '<div class="row" style="gap:7px;flex-wrap:wrap;margin-top:12px;justify-content:flex-start">'+
        '<button class="btn btn-sm btn-primary" onclick="copyRetentionMessage(\''+safe(t.refId)+'\')">Скопировать текст</button>'+
         (vkLink?'<button class="btn btn-sm" onclick="openRetentionChannel(\\''+safe(t.refId)+'\\',\\'vk\\')">ВКонтакте</button>':'')+
        (tgLink?'<button class="btn btn-sm" onclick="openRetentionChannel(\\''+safe(t.refId)+'\\',\\'telegram\\')">Telegram</button>':'')+
        ((!vkLink&&!tgLink)?'<span class="small dim">Добавь VK или Telegram в карточку клиента</span>':'')+
        '<button class="btn btn-sm" onclick="completeRetentionTask(\''+safe(t.refId)+'\')">Отметить выполненным</button>'+
        '<button class="btn btn-sm" onclick="openClient(\''+safe(t.client.id)+'\')">Карточка клиента</button></div></div>';
    }).join('');
    $('#content').innerHTML=
      '<div class="row" style="gap:10px;align-items:flex-start;flex-wrap:wrap;margin-bottom:14px"><div style="flex:1;min-width:220px"><h2 style="margin:0 0 5px">Возврат клиентов</h2><div class="small dim">ИИ-поддержка и персональные касания на протяжении года после сеанса.</div></div><button class="btn btn-sm" onclick="go(\'clients\')">К базе клиентов</button></div>'+
      '<div class="grid grid-3" style="margin-bottom:14px"><div class="card"><div class="small dim">Касания ожидают</div><div class="stat-value">'+due.length+'</div><div class="small dim">Можно написать сегодня</div></div>'+
      '<div class="card"><div class="small dim">Запланировано дальше</div><div class="stat-value">'+future.length+'</div><div class="small dim">Этапы до 12 месяцев</div></div>'+
      '<div class="card"><div class="small dim">Клиенты в базе</div><div class="stat-value">'+(S.clients||[]).length+'</div><div class="small dim">По истории сеансов</div></div></div>'+
      '<div class="card" style="margin-bottom:12px"><b>Годовой сценарий</b><div class="small dim" style="margin-top:6px;line-height:1.6">2 часа → 3 дня → 7 дней → 14 дней → 30 дней → 60 дней → 3 → 4 → 6 → 9 → 12 месяцев. Сначала забота о клиенте и заживлении, затем мягкое предложение продолжить проект или выбрать новую татуировку.</div>'+
      '<div class="small dim" style="margin-top:6px">Отправка пока ручная: скопируй сообщение, открой канал связи и отметь касание выполненным. Основа — завершённые сеансы, привязанные к клиентам в календаре. Учитывай согласие клиента на сообщения.</div></div>'+
      '<div class="field-row" style="margin-bottom:10px"><input id="retentionSearch" placeholder="Найти клиента или этап..." value="'+safe(window._retentionQuery||'')+'"></div>'+
      '<div id="retentionTasks">'+(cards||'<div class="card dim">Нет касаний. Проверь, что сеансы отмечены как завершённые и привязаны к клиентам.</div>')+'</div>';
    $('#retentionSearch').oninput=function(e){window._retentionQuery=e.target.value;var pos=e.target.selectionStart;RENDERERS.retention();var input=$('#retentionSearch');input.focus();input.setSelectionRange(pos,pos);};
  };
  window.openRetentionChannel=async function(refId,channel){
    var task=getTasks().find(function(t){return t.refId===refId;});
    if(!task){toast('Касание не найдено. Обнови раздел.','error');return;}
    var link=channelLink(task.client,channel,task.message);
    if(!link){toast('Добавь контакт клиента в его карточку','error');return;}
    try{await navigator.clipboard.writeText(task.message);}catch(e){}
    window.open(link,'_blank','noopener');
    toast(channel==='vk'?'Текст скопирован. Вставь его в переписку ВКонтакте.':'Открой черновик в Telegram, проверь текст и отправь вручную.');
  };
  window.copyRetentionMessage=async function(refId){
    var message=(window._retentionMessageMap||{})[refId];
    if(!message){toast('Текст не найден. Обнови раздел.','error');return;}
    try{await navigator.clipboard.writeText(message);toast('Текст сообщения скопирован');}
    catch(e){var ta=document.createElement('textarea');ta.value=message;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();toast('Текст сообщения скопирован');}
  };
  window.completeRetentionTask=async function(refId){
    if((S.notifications||[]).some(function(n){return n.type==='retention-sent'&&n.refId===refId;})){toast('Это касание уже отмечено');return;}
    await idbPut('notifications',{id:uid(),type:'retention-sent',refId:refId,createdAt:Date.now(),title:'Касание клиенту выполнено'});
    S.notifications=await idbAll('notifications');
    var taskText=(window._retentionMessageMap||{})[refId]||'Сообщение клиенту отмечено как отправленное.';
    if(typeof addNotification==='function') addNotification('Отправка клиенту отмечена: '+taskText.slice(0,150),'followup','retention-confirm:'+refId);
    toast('Касание отмечено выполненным');
    RENDERERS.retention();
  };
  try{buildNav();if(typeof currentRoute!=='undefined')go(currentRoute);}catch(e){console.error('INK.OS retention init',e);}
})();
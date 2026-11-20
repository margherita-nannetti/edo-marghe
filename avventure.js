const THREE_URL='https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';

try{
  const THREE=await import(THREE_URL);
  const {makeAvatar,animateAvatar}=await import('./avatars.js');
  startGame(THREE,makeAvatar,animateAvatar);
}catch(error){
  const el=document.getElementById('error');
  el.style.display='block';
  el.textContent='Impossibile caricare il gioco 3D. Controlla la connessione Internet e riapri la pagina. Dettaglio: '+error.message;
}

function startGame(THREE,makeAvatar,animateAvatar){
  const chapters=[
    {title:'Lubiana — There are cats?',place:'Lubiana',icon:'🐈',theme:'cafe',hint:'Parla con Marghe, poi raggiungi il barista.'},
    {title:'Bled — Il capanno segreto',place:'Bled',icon:'🏰',theme:'castle',hint:'Esplora il lago e avvicinati al capanno.'},
    {title:'Is Arutas — Tramonto',place:'Sardegna',icon:'🎸',theme:'sunset',hint:'Raggiungi la chitarra sulla spiaggia al tramonto.'},
    {title:'Lezioni di surf',place:'Sardegna',icon:'🏄',theme:'surf',hint:'Edo sa già surfare: raggiungi la tavola e insegna a Marghe.'},
    {title:'L’outfit perfetto per sciare',place:'Montagna',icon:'⛷️',theme:'snow',hint:'Raggiungi il guardaroba e componi l’outfit di Edo.'},
    {title:'Il nostro primo stellato',place:'San Martino',icon:'🍽️',theme:'restaurant',hint:'Raggiungi il tavolo apparecchiato.'},
    {title:'Londra sotto il sole',place:'Londra',icon:'🇬🇧',theme:'city',hint:'Raccogli Tower Bridge, Big Ben e la lanterna di Chinatown.'},
    {title:'Mystery box — Primo anniversario',place:'Casa',icon:'🎁',theme:'home',hint:'Apri la mystery box sul tavolo.'},
    {title:'Molentargius a cavallo',place:'Sardegna',icon:'🐎',theme:'salt',hint:'Avvicinati al cavallo grigio o a quello baio.'},
    {title:'Muay thai — La sfida',place:'Palestra',icon:'🥊',theme:'gym',hint:'Parla con Marghe o raggiungi il sacco da allenamento.'},
    {title:'Casa, coccole e Nenno',place:'Casa',icon:'🐈',theme:'cat',hint:'Avvicinati a Nenno per accarezzarlo.'},
    {title:'Ein Prosit — Dove sono Franci e Gian?',place:'Ein Prosit',icon:'🔎',theme:'festival',hint:'Trova Franci con la videocamera e Gian con il panino.'},
    {title:'20 novembre 2026 — Il nostro universo',place:'Finale',icon:'❤️',theme:'stars',hint:'Prima parla con Marghe: ha una chiave per te.'}
  ];
  const storageKey='edo-marghe-progress-v5';
  let saved={};
  try{saved=JSON.parse(localStorage.getItem(storageKey)||'{}')}catch(_error){saved={}}

  const canvas=document.getElementById('game');
  const title=document.getElementById('title');
  const subtitle=document.getElementById('subtitle');
  const hint=document.getElementById('hint');
  const act=document.getElementById('act');
  const overlay=document.getElementById('overlay');
  const modalTitle=document.getElementById('modalTitle');
  const modalText=document.getElementById('modalText');
  const opts=document.getElementById('opts');
  const extra=document.getElementById('extra');
  const heartLayer=document.getElementById('heartLayer');

  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));
  renderer.setSize(innerWidth,innerHeight);
  renderer.shadowMap.enabled=true;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.18;
  renderer.outputColorSpace=THREE.SRGBColorSpace;

  const scene=new THREE.Scene();
  scene.background=new THREE.Color('#eadfd8');
  const camera=new THREE.PerspectiveCamera(48,innerWidth/innerHeight,.1,100);
  camera.position.set(6,8.7,11);
  const world=new THREE.Group();
  scene.add(world);
  const hemi=new THREE.HemisphereLight(0xffffff,0x8f7886,2.15);
  scene.add(hemi);
  const sun=new THREE.DirectionalLight(0xfff0d0,2.4);
  sun.position.set(-5,10,6);
  sun.castShadow=true;
  sun.shadow.mapSize.set(1024,1024);
  scene.add(sun);

  let current=0;
  let sceneReady=false;
  let open=true;
  let finished=false;
  let elapsed=0;
  let edo=null;
  let marghe=null;
  let avatarLast=new THREE.Vector3();
  let targets=[];
  let actors=[];
  let miniMode=null;
  let state={};

  const colorMap={
    cafe:['#e6d4ca','#bda487'],castle:['#cfe1e6','#92aa91'],sunset:['#f7b49a','#f0d09d'],surf:['#cce9e8','#efd7aa'],snow:['#dcebf4','#f8fbff'],restaurant:['#ead8c7','#bc9782'],city:['#dfe3eb','#b5bbc4'],home:['#f1ddd5','#dbb5a6'],salt:['#dcebea','#efe3cf'],gym:['#d8d8e1','#aeb9c1'],cat:['#f1ddd5','#dbb5a6'],festival:['#f3d6c4','#c5a38c'],stars:['#202946','#52617a']
  };

  function material(color,roughness=.82){return new THREE.MeshStandardMaterial({color,roughness})}
  function addMesh(geometry,color,x,y,z,parent=world){
    const object=new THREE.Mesh(geometry,typeof color==='string'?material(color):color);
    object.position.set(x,y,z);
    object.castShadow=true;
    object.receiveShadow=true;
    parent.add(object);
    return object;
  }
  function box(w,h,d,color,x,y,z,parent=world){return addMesh(new THREE.BoxGeometry(w,h,d),color,x,y,z,parent)}
  function ball(r,color,x,y,z,parent=world,sx=1,sy=1,sz=1){const o=addMesh(new THREE.SphereGeometry(r,16,12),color,x,y,z,parent);o.scale.set(sx,sy,sz);return o}
  function cyl(r,h,color,x,y,z,parent=world,segments=12){return addMesh(new THREE.CylinderGeometry(r,r,h,segments),color,x,y,z,parent)}
  function cone(r,h,color,x,y,z,parent=world,segments=10){return addMesh(new THREE.ConeGeometry(r,h,segments),color,x,y,z,parent)}
  function group(x=0,y=0,z=0,parent=world){const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);return g}
  function person(kind,x,z,shirt,hair,y=0){
    const avatar=makeAvatar(THREE,kind,shirt,hair);
    avatar.position.set(x,y,z);
    world.add(avatar);
    actors.push(avatar);
    return avatar;
  }
  function registerTarget(object,label,action){targets.push({object,label,action,disabled:false});return object}
  function targetPosition(target){return target.object.getWorldPosition(new THREE.Vector3())}
  function shuffle(list){
    const result=[...list];
    for(let i=result.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[result[i],result[j]]=[result[j],result[i]]}
    return result;
  }
  function clearWorld(){
    world.traverse(object=>{
      object.geometry?.dispose?.();
      if(Array.isArray(object.material))object.material.forEach(m=>m.dispose?.());
      else object.material?.dispose?.();
    });
    world.clear();
    targets=[];
    actors=[];
  }
  function setPalette(theme){
    const [sky,ground]=colorMap[theme];
    scene.background=new THREE.Color(sky);
    scene.fog=theme==='stars'?new THREE.Fog('#202946',15,35):null;
    hemi.color.set(theme==='stars'?'#a9bfff':'#ffffff');
    hemi.groundColor.set(theme==='stars'?'#292244':'#927f87');
    sun.color.set(theme==='sunset'?'#ff9b70':'#fff0d0');
    sun.intensity=theme==='stars'?1.2:2.4;
    box(18,.34,13,ground,0,-.2,0);
  }
  function tree(x,z,color='#78a185'){
    cyl(.15,1.35,'#87684f',x,.67,z);
    ball(.72,color,x,1.65,z);
    ball(.38,color,x-.4,1.55,z+.08);
    ball(.4,color,x+.38,1.62,z-.05);
  }
  function lantern(x,z){
    cyl(.065,1.65,'#544956',x,.82,z);
    ball(.18,'#ffe5a5',x,1.72,z);
  }
  function buildings(colors=['#d2a58f','#a5b9be']){
    for(let i=0;i<5;i++){
      const x=-7+i*3.5;
      box(2.7,3.1,.75,colors[i%colors.length],x,1.55,-5.6);
      box(.75,.9,.08,'#ffe7b8',x,2,-5.18);
      box(.65,.8,.08,'#76666d',x,.65,-5.17);
    }
  }
  function commonLandDecor(theme){
    if(['cafe','restaurant','city','festival'].includes(theme)){
      buildings(theme==='city'?['#a7b8c7','#b78684']:['#d0a188','#b89083']);
      for(const x of [-6,-3,0,3,6])lantern(x,-3.8);
    }else if(['castle','snow'].includes(theme)){
      for(const x of [-7,-4,-1,2,5])tree(x,-4.8,theme==='snow'?'#668c80':'#77a087');
    }else if(['home','cat'].includes(theme)){
      box(4.5,.75,1.4,'#c7918b',-3,.38,-3.5);
      for(const x of [-4.3,-3,-1.7])ball(.3,'#f4ddc5',x,.86,-3.05);
      box(2.5,2.8,.5,'#89685f',4,1.4,-5);
      for(let y=.4;y<2.4;y+=.65)box(2.2,.08,.45,'#dfbd92',4,y,-4.65);
    }
  }

  function modal(titleText,body,buttons=[]){
    open=true;
    overlay.style.display='flex';
    modalTitle.textContent=titleText;
    modalText.textContent=body;
    opts.replaceChildren();
    extra.replaceChildren();
    for(const [label,handler,primary=false] of buttons){
      const button=document.createElement('button');
      button.type='button';
      button.className='opt'+(primary?' primary':'');
      button.textContent=label;
      button.onclick=handler;
      opts.append(button);
    }
  }
  function closeModal(){open=false;overlay.style.display='none'}
  function saveProgress(){try{localStorage.setItem(storageKey,JSON.stringify(saved))}catch(_error){}}
  function done(){
    saved[current]=true;
    saveProgress();
    finished=true;
    modal('💗 Ricordo sbloccato!',chapters[current].title+'\nHai conservato un altro frammento del vostro universo. ('+Object.values(saved).filter(Boolean).length+'/'+chapters.length+')',[
      [current===chapters.length-1?'Rivedi il finale':'Continua al prossimo ricordo →',()=>{
        if(current<chapters.length-1){openChapter(current+1)}else showFinal();
      },true],
      ['Scegli un capitolo',()=>showMenu(false)]
    ]);
  }
  function burstHearts(){
    let center={x:innerWidth*.57,y:innerHeight*.52};
    if(edo&&marghe){
      const p=edo.position.clone().add(marghe.position).multiplyScalar(.5).add(new THREE.Vector3(0,1.25,0)).project(camera);
      if(Number.isFinite(p.x)&&Number.isFinite(p.y))center={x:(p.x*.5+.5)*innerWidth,y:(-.5*p.y+.5)*innerHeight};
    }
    for(let i=0;i<14;i++){
      const heart=document.createElement('span');
      heart.className='heart';
      heart.textContent=i%3?'💗':'💕';
      heart.style.left=center.x+'px';
      heart.style.top=center.y+'px';
      const angle=Math.PI*2*i/14+(Math.random()-.5)*.35;
      const distance=75+Math.random()*95;
      heart.style.setProperty('--dx',Math.cos(angle)*distance+'px');
      heart.style.setProperty('--dy',Math.sin(angle)*distance-55+'px');
      heart.style.setProperty('--rot',(Math.random()*80-40)+'deg');
      heartLayer.append(heart);
      setTimeout(()=>heart.remove(),1350);
    }
  }
  function hugMarghe(){
    closeModal();
    burstHearts();
    setTimeout(()=>modal('💗 Un abbraccio','Per un momento il mondo si ferma. I cuoricini dicono tutto.',[['Continua a esplorare',closeModal,true]]),260);
  }
  function companionDialogue(){
    const lines={
      castle:'Marghe: «Non aver paura, ci sono io!»',sunset:'Marghe: «Questo tramonto con te è il mio preferito.»',surf:'Marghe: «Prof Edo, sono pronta per la lezione!»',snow:'Marghe: «Vediamo se il tuo outfit è davvero perfetto.»',restaurant:'Marghe: «Siamo eleganti… almeno ci proviamo!»',city:'Marghe: «Cerchiamo tutti e tre i souvenir?»',home:'Marghe: «La mystery box ci aspetta.»',salt:'Marghe: «Con calma: i cavalli si fidano di noi.»',cat:'Marghe: «Nenno vuole le coccole da entrambi.»',festival:'Marghe: «Franci ha la videocamera, Gian il panino!»'
    };
    modal('💬 Edo & Marghe',lines[chapters[current].theme]||'Marghe: «Sono felice di essere qui con te.»',[
      ['💗 Abbraccia Marghe',hugMarghe],['Continua',closeModal]
    ]);
  }

  function makeCafe(){
    buildings(['#d6b394','#adc7bd']);
    box(6,.95,1,'#94664e',1,.48,-2.8);
    box(6,.14,1.2,'#f0cca0',1,1.02,-2.8);
    for(const x of [-5,-2.5]){
      box(1.2,.12,1,'#d7a48c',x,.72,.2);
      cyl(.08,.65,'#73584d',x,.35,.2);
    }
    const barista=person('guest',1,-2.25,'#6f8d7b','#5b3b2e');
    state.customMarghe=true;
    state.cafeAsked=false;
    registerTarget(marghe,'Marghe',()=>{
      modal('🐈 Una domanda per Edo','Marghe: «Edo, ma questo è uno di quei bar con i gatti?»\nEdo: «Aspetta qui, vado a chiedere al barista.»',[
        ['Vado dal barista →',()=>{state.cafeAsked=true;hint.textContent='🐈 Ora raggiungi il barista dietro al bancone.';closeModal()},true],
        ['💗 Prima un abbraccio',hugMarghe]
      ]);
    });
    registerTarget(barista,'il barista',()=>{
      if(!state.cafeAsked){modal('☕ Il barista','Edo non sa ancora cosa chiedere. Prima parla con Marghe.',[['Torno da Marghe',closeModal]]);return}
      modal('☕ Edo va dal barista','Edo si avvicina al bancone. Come formula la domanda?',[
        ['Fai la domanda',catCafeQuiz,true],['Un momento…',closeModal]
      ]);
    });
  }
  function catCafeQuiz(){
    const answers=shuffle([
      {label:'«There are cats?»',correct:true},
      {label:'«There are cars?»',correct:false},
      {label:'«Do you have castles?»',correct:false}
    ]);
    modal('🐈 Il quiz del barista','Edo guarda il barista e chiede…',answers.map(answer=>[answer.label,()=>{
      if(answer.correct)modal('🐈 There are cats?','Il barista lo guarda perplesso. Marghe trattiene a stento una risata: domanda leggendaria!',[['Conserva la scena 😹',done,true]]);
      else modal('😄 Non era questa','Marghe scuote la testa ridendo. Riprova la domanda memorabile.',[['Riprova',catCafeQuiz]]);
    }]));
  }

  function makeBoat(x,z){
    const g=group(x,.08,z);
    const hull=box(2.1,.35,.85,'#a66b4d',0,.2,0,g);
    hull.scale.set(1,.75,1);
    box(1.55,.1,.12,'#e2b98d',0,.48,-.22,g);
    box(1.55,.1,.12,'#e2b98d',0,.48,.22,g);
    const oar=box(2.5,.05,.09,'#7b573f',0,.65,0,g);oar.rotation.y=.5;
    return g;
  }
  function makeBled(){
    for(const x of [-7,-4,-1,2,5])tree(x,-4.7);
    box(18,.08,3.15,'#76bbc4',0,.015,4.25);
    const boat=makeBoat(-1.1,4.05);
    registerTarget(boat,'la barchetta',()=>modal('🛶 La barchetta sul lago','La barchetta ondeggia davanti a voi. Il capanno, però, vi aspetta dall’altra parte.',[['Verso il capanno',closeModal]]));
    const island=group(-4,0,-3.4);
    ball(.9,'#86a27d',0,.1,0,island,1.6,.35,1);
    box(.8,1.4,.7,'#eee1c9',0,.72,0,island);
    cone(.62,.65,'#a76562',0,1.72,0,island,4);
    const shed=group(.5,0,-1.9);
    box(2.2,1.5,1.45,'#99745f',0,.75,0,shed);
    const roof=cone(1.65,.8,'#6d555b',0,1.82,0,shed,4);roof.rotation.y=Math.PI/4;
    box(.62,1.05,.08,'#4f3d3e',0,.52,.76,shed);
    registerTarget(shed,'la porta del capanno',shedGame);
  }
  function shedGame(){
    modal('🏰 Il capanno proibito','Edo: «Marghe… siamo sicuri di poter entrare?»\nMarghe: «Dai, solo un secondo!»',[
      ['🚪 Entra con cautela',()=>modal('😬 Coraggio, Edo!','Un rumore! Edo sobbalza, Marghe ride e nota i bicchieri da birra.',[['Usciamo di qui!',done,true]])],
      ['💗 Prendi la mano di Marghe',()=>modal('💗 Insieme','Con Marghe accanto fa un po’ meno paura.',[['Ora entriamo',shedGame]])]
    ]);
  }

  function makeGuitar(x,z){
    const g=group(x,0,z);
    ball(.42,'#b66d45',0,.5,0,g,1,.82,.35);
    ball(.26,'#c88450',0,.92,0,g,1,.95,.3);
    cyl(.1,1.1,'#76503d',0,1.55,0,g);g.children.at(-1).rotation.z=-.08;
    box(.42,.16,.12,'#5d4235',0,2.08,0,g);
    ball(.11,'#4c3029',0,.52,.13,g,1,1,.35);
    g.rotation.z=-.15;
    return g;
  }
  function makeSunsetBeach(isSurf=false){
    box(18,.06,1.65,isSurf?'#62bdc5':'#4eabb7',0,.01,-5.3);
    box(18,.035,.55,'#83d0ce',0,.035,-4.25);
    if(!isSurf){
      ball(.72,'#ffb36e',-5.3,2.7,-6,world,1,1,.35);
      const guitar=makeGuitar(-2.65,-.3);
      registerTarget(guitar,'la chitarra',()=>modal('🎸 La chitarra al tramonto','Edo prende la chitarra. Marghe si siede vicino: il sole scende sul mare, senza nient’altro tra voi e l’orizzonte.',[
        ['Suona la vostra canzone',()=>modal('🌅 Is Arutas','Le ultime note restano nell’aria mentre il cielo diventa rosa.',[['Conserva il tramonto',done,true]])]
      ]));
      const table=group(4,0,1.2);
      box(1.7,.12,1.05,'#d7ad88',0,.68,0,table);
      for(const x of [-.6,.6])cyl(.05,.68,'#85644e',x,.34,0,table);
      ball(.13,'#ffe2a0',0,.86,0,table);
    }
  }
  function makeSurfboard(x,z,color='#f08083',parent=world){
    const g=group(x,.12,z,parent);
    const board=ball(.62,color,0,.05,0,g,.62,.12,2.05);
    board.rotation.x=.03;
    box(.06,.035,2.1,'#fff5df',0,.12,0,g);
    return g;
  }
  function makeSurf(){
    makeSunsetBeach(true);
    const lessonBoard=makeSurfboard(-1.7,-.2,'#e8787e');
    registerTarget(lessonBoard,'la tavola da surf',startSurfLesson);
    const surferData=[[-5,-4.75,'#5e91a8'],[0,-5,'#d58b7d'],[5,-4.6,'#779777']];
    for(const [x,z,color] of surferData){
      makeSurfboard(x,z,color);
      const surfer=person('guest',x,z,color,'#43342f',.13);
      surfer.scale.set(.72,.72,.72);
    }
  }
  function startSurfLesson(){
    modal('🏄 Edo insegna a Marghe','Edo sa già surfare e mostra a Marghe come piegare le ginocchia e guardare l’onda.\nPremi il pulsante solo quando diventa verde.',[
      ['Inizia la lezione',()=>{state.surfCount=0;miniMode='surf';act.textContent='🏄 ONDA';hint.textContent='🏄 Edo guida Marghe: premi sulla fase VERDE · 0/3';closeModal()},true]
    ]);
  }
  function surfTap(){
    const green=Math.sin(elapsed*3)>.2;
    if(green){
      state.surfCount++;
      hint.textContent='🏄 Onda presa insieme! '+state.surfCount+'/3';
      if(state.surfCount>=3){
        miniMode=null;act.textContent='Interagisci';
        modal('🏄 Lezione riuscita!','Grazie ai consigli di Edo, Marghe resta in piedi sulla tavola e cavalca l’onda.',[['Conserva il ricordo',done,true]]);
      }
    }else hint.textContent='🌊 Troppo presto: Edo dice di aspettare la prossima onda. '+state.surfCount+'/3';
  }

  function makeWardrobe(){
    const g=group(-1.1,0,-1.1);
    box(3,2.6,.8,'#9e7c69',0,1.3,0,g);
    box(.08,2.4,.86,'#d9b99b',0,1.3,.02,g);
    for(const x of [-.75,.75]){
      box(.78,1.1,.1,x<0?'#d4757d':'#6e92a4',x,1.35,.47,g);
      ball(.1,'#e7c483',x,2.12,.5,g);
    }
    return g;
  }
  function makeSnow(){
    for(const x of [-7,-4,-1,2,5]){
      cone(.8,2.1,'#567e75',x,1.05,-4.7);
      cone(.55,1.45,'#73998c',x,2,-4.7);
      ball(.22,'#ffffff',x,2.67,-4.7);
    }
    for(let i=0;i<6;i++)cone(.18,.55,i%2?'#df6772':'#6d8ea3',-6+i*2.3,.28,2.4);
    const wardrobe=makeWardrobe();
    registerTarget(wardrobe,'il guardaroba da sci',skiOutfitGame);
  }
  function skiOutfitGame(){
    const steps=[
      {key:'occhi',question:'Cosa mette sugli occhi?',choices:['🕶️ Occhiali da sole','🥽 Mascherina']},
      {key:'testa',question:'Cosa mette in testa?',choices:['🧢 Berretto','⛑️ Casco']},
      {key:'completo',question:'Quale completo sceglie?',choices:['🧥 Giacca + salopette','🎿 Tuta intera']}
    ];
    const selection={};
    function pick(index){
      const step=steps[index];
      modal('⛷️ Outfit di Edo','Scelta '+(index+1)+'/3 — '+step.question,shuffle(step.choices).map(choice=>[choice,()=>{
        selection[step.key]=choice;
        if(index===steps.length-1)showPreview();else pick(index+1);
      }]));
    }
    function showPreview(){
      modal('⛷️ Outfit perfetto!','Ecco l’avatar di Edo pronto per la neve.',[]);
      const img=document.createElement('img');
      img.className='outfitPreview';
      img.src=drawOutfitPreview(selection);
      img.alt='Anteprima dell’avatar di Edo con '+Object.values(selection).join(', ');
      extra.append(img);
      const summary=document.createElement('div');
      summary.className='tiny';
      summary.textContent=Object.values(selection).join(' · ');
      extra.append(summary);
      const keep=document.createElement('button');
      keep.className='wide';
      keep.textContent='💗 Conserva questo outfit';
      keep.onclick=done;
      extra.append(keep);
    }
    pick(0);
  }
  function drawOutfitPreview(selection){
    const c=document.createElement('canvas');c.width=640;c.height=720;
    const x=c.getContext('2d');
    const gradient=x.createLinearGradient(0,0,0,720);gradient.addColorStop(0,'#b9d9eb');gradient.addColorStop(1,'#f8fbff');x.fillStyle=gradient;x.fillRect(0,0,640,720);
    x.fillStyle='#ffffff';x.beginPath();x.moveTo(0,560);x.quadraticCurveTo(170,490,330,570);x.quadraticCurveTo(500,500,640,555);x.lineTo(640,720);x.lineTo(0,720);x.fill();
    x.strokeStyle='#557a96';x.lineWidth=15;x.lineCap='round';x.beginPath();x.moveTo(185,660);x.lineTo(315,480);x.moveTo(455,660);x.lineTo(325,480);x.stroke();
    x.fillStyle=selection.completo.includes('Tuta')?'#d26f7b':'#547d9b';roundRect(x,210,330,220,245,78);x.fill();
    if(selection.completo.includes('Giacca')){x.fillStyle='#d77f83';roundRect(x,210,330,220,135,60);x.fill();x.fillStyle='#596f91';roundRect(x,225,440,82,150,35);x.fill();roundRect(x,333,440,82,150,35);x.fill()}
    x.fillStyle='#edbd99';x.beginPath();x.arc(320,245,112,0,Math.PI*2);x.fill();
    x.fillStyle='#392922';x.beginPath();x.arc(320,212,116,Math.PI,Math.PI*2);x.lineTo(425,245);x.quadraticCurveTo(390,140,320,135);x.quadraticCurveTo(235,135,213,250);x.fill();
    x.fillStyle='#4e3b3c';x.beginPath();x.arc(278,255,10,0,Math.PI*2);x.arc(362,255,10,0,Math.PI*2);x.fill();
    if(selection.occhi.includes('Mascherina')){x.fillStyle='#a6d7e6';roundRect(x,245,225,150,64,24);x.fill();x.strokeStyle='#533e4b';x.lineWidth=9;x.strokeRect(244,229,152,57)}
    else{x.strokeStyle='#423841';x.lineWidth=10;x.beginPath();x.arc(278,255,34,0,Math.PI*2);x.arc(362,255,34,0,Math.PI*2);x.moveTo(312,255);x.lineTo(328,255);x.stroke()}
    if(selection.testa.includes('Casco')){x.fillStyle='#e57b7d';x.beginPath();x.arc(320,195,122,Math.PI,Math.PI*2);x.lineTo(442,205);x.lineTo(198,205);x.fill()}
    else{x.fillStyle='#6d5577';x.beginPath();x.arc(320,182,108,Math.PI,Math.PI*2);x.lineTo(428,205);x.lineTo(212,205);x.fill();x.beginPath();x.arc(320,90,25,0,Math.PI*2);x.fill()}
    x.fillStyle='#68455d';x.font='700 30px system-ui';x.textAlign='center';x.fillText('EDO SULLA NEVE',320,675);
    return c.toDataURL('image/png');
  }
  function roundRect(context,x,y,w,h,r){context.beginPath();context.roundRect(x,y,w,h,r)}

  function makeRestaurant(){
    buildings(['#8f615b','#aa786e']);
    for(const x of [-4,0,4]){
      const table=group(x,0,-1);
      box(2,.14,1.55,'#f7ead8',0,.78,0,table);
      cyl(.09,.78,'#604945',0,.39,0,table);
      ball(.25,'#fffaf1',-.35,.9,0,table,1,.15,1);
      ball(.09,'#ffe4a5',.45,1.05,0,table);
      if(x===0)registerTarget(table,'il tavolo dello stellato',restaurantGame);
    }
  }
  function restaurantGame(){
    modal('🍽️ San Martino','Edo: «Quale forchetta usiamo?»\nMarghe: «Quella che sembra meno pericolosa!»',[
      ['Ridiamo e ci godiamo la cena',done,true],
      ['Chiediamo un manuale di galateo',()=>modal('😂 Manuale non disponibile','Meglio riderci su.',[['Torniamo a tavola',restaurantGame]])]
    ]);
  }

  function makeTowerBridge(x,z){
    const g=group(x,0,z);
    for(const px of [-.65,.65]){
      box(.5,1.6,.55,'#aab3b1',px,.8,0,g);
      cone(.42,.55,'#6f8190',px,1.85,0,g,4);
      box(.12,1.25,.1,'#eef0e8',px,.85,.32,g);
    }
    box(1.8,.18,.55,'#6b8fa2',0,.55,0,g);
    box(1.6,.11,.12,'#d9c7a5',0,1.35,0,g);
    return g;
  }
  function makeBigBen(x,z){
    const g=group(x,0,z);
    box(.72,2.2,.72,'#c6aa76',0,1.1,0,g);
    box(.88,.72,.82,'#d4bd8c',0,2.05,0,g);
    for(const side of [-1,1])ball(.16,'#f5ead1',0,2.05,side*.43,g,1,1,.18);
    cone(.62,1,'#6f685c',0,2.92,0,g,4);
    return g;
  }
  function makeChinatownLantern(x,z){
    const g=group(x,0,z);
    cyl(.06,1.55,'#5e4c53',0,.78,0,g);
    ball(.46,'#c64d55',0,1.75,0,g,1,.85,.75);
    box(.72,.08,.16,'#e3ad56',0,1.42,0,g);
    box(.72,.08,.16,'#e3ad56',0,2.08,0,g);
    cone(.12,.4,'#e3ad56',0,1.1,0,g);
    return g;
  }
  function makeLondon(){
    buildings(['#9faebc','#b28b87']);
    const items=[
      {id:'bridge',name:'Tower Bridge',object:makeTowerBridge(-4,-.8)},
      {id:'ben',name:'Big Ben',object:makeBigBen(.5,-2)},
      {id:'lantern',name:'la lanterna di Chinatown',object:makeChinatownLantern(4,1)}
    ];
    state.london=new Set();
    for(const item of items)registerTarget(item.object,item.name,()=>collectLondon(item));
  }
  function collectLondon(item){
    if(state.london.has(item.id))return;
    state.london.add(item.id);
    item.object.visible=false;
    const count=state.london.size;
    if(count===3){
      hint.textContent='🇬🇧 Tutti i souvenir raccolti!';
      modal('🇬🇧 Londra completa','Tower Bridge, Big Ben e la lanterna di Chinatown sono nel vostro album.',[['Conserva il ricordo',done,true]]);
    }else{
      hint.textContent='🇬🇧 Raccolto '+item.name+' · '+count+'/3';
      modal('✨ '+item.name,'Miniatura raccolta! Ne mancano '+(3-count)+'.',[['Continua a esplorare',closeModal]]);
    }
  }

  function makeMysteryBox(){
    const table=group(0,0,-1.3);
    box(3,.14,1.7,'#b18368',0,.75,0,table);
    for(const x of [-1.1,1.1])cyl(.07,.74,'#6e5445',x,.37,0,table);
    const mystery=group(0,.83,-1.3);
    box(1.55,.85,1.1,'#d0a35f',0,.42,0,mystery);
    box(1.7,.18,1.2,'#895b55',0,.92,0,mystery);
    box(.22,1,.12,'#b95f76',0,.48,.57,mystery);
    registerTarget(mystery,'la mystery box',cookingGame);
  }
  function cookingGame(){
    const ingredients=['Tuorli d’uovo','Burro chiarificato','Succo di limone','Sale','Pepe di Cayenna','Latte','Pomodoro','Farina','Panna','Basilico','Zucchero','Aglio','Olio d’oliva','Senape','Cioccolato','Riso'];
    const correct=ingredients.slice(0,4);
    const chosen=new Set();
    modal('👩‍🍳 Mystery box: salsa olandese','Gli ingredienti giusti sono quattro, ma questa volta le risposte sono ben mescolate.',[]);
    const tip=document.createElement('div');tip.className='tiny';tip.textContent='Scegli esattamente 4 ingredienti.';extra.append(tip);
    const grid=document.createElement('div');grid.className='ingredients';extra.append(grid);
    for(const ingredient of shuffle(ingredients)){
      const button=document.createElement('button');
      button.textContent=ingredient;
      button.onclick=()=>{
        if(chosen.has(ingredient)){chosen.delete(ingredient);button.classList.remove('selected')}
        else if(chosen.size<4){chosen.add(ingredient);button.classList.add('selected')}
        tip.textContent='Selezionati: '+chosen.size+'/4';
      };
      grid.append(button);
    }
    const check=document.createElement('button');
    check.className='wide';check.textContent='🍳 Prepara la salsa';
    check.onclick=()=>{
      if(chosen.size!==4){tip.textContent='Scegli esattamente 4 ingredienti!';return}
      if(correct.every(item=>chosen.has(item)))modal('🍳 Salsa riuscita!','Tuorli, burro chiarificato, limone e sale: perfetta.',[['Servi il piatto 💗',done,true]]);
      else modal('🥄 Ops, si è separata!','Gli ingredienti sono mescolati a ogni tentativo. Riproviamo?', [['Torna ai fornelli',cookingGame]]);
    };
    extra.append(check);
  }

  function makeHorse(x,z,coat,mane,saddle){
    const g=group(x,0,z);
    ball(.65,coat,0,1.18,0,g,1.6,.8,.68);
    ball(.34,coat,.75,1.5,0,g,.72,1.4,.78);
    ball(.32,coat,1,1.78,0,g,1,.78,.73);
    ball(.2,coat,1.23,1.62,0,g,1,.7,.75);
    for(const lx of [-.45,.45])for(const lz of [-.27,.27]){
      box(.19,1.02,.19,coat,lx,.58,lz,g);box(.24,.18,.24,'#4c4240',lx,.08,lz,g);
    }
    for(let i=0;i<6;i++)ball(.12,mane,.5+i*.09,1.94-i*.06,0,g);
    ball(.2,mane,-1,1.12,0,g,.65,1.7,.6);
    ball(.48,saddle,0,1.68,0,g,1.22,.14,.9);
    box(.78,.11,.68,saddle,0,1.58,0,g);
    for(const side of [-1,1])ball(.045,'#292526',1.04,1.84,side*.24,g);
    return g;
  }
  function flamingo(x,z,scale=1){
    const g=group(x,0,z);
    cyl(.03,.75,'#b9828e',0,.42,0,g);
    ball(.23,'#f1adb9',0,.88,0,g,.75,1.2,.8);
    cyl(.035,.38,'#d793a2',.14,1.15,0,g);g.children.at(-1).rotation.z=-.6;
    ball(.1,'#f6bdc6',.28,1.3,0,g);
    cone(.08,.23,'#4b3e43',.4,1.28,0,g);g.children.at(-1).rotation.z=-Math.PI/2;
    g.scale.setScalar(scale);
    return g;
  }
  function makeMolentargius(){
    box(18,.06,2.2,'#8fcbd0',0,.01,-5);
    box(18,.04,.6,'#b8e0de',0,.035,-3.65);
    for(const x of [-6,-3,0,3,6])flamingo(x,-4.75,.82);
    const grey=makeHorse(-3.85,-1.15,'#c7cbd0','#858b94','#856b77');
    const bay=makeHorse(-1.7,-1.25,'#8b4c30','#342a29','#b58b6d');
    state.horseFinished=false;
    registerTarget(grey,'il cavallo grigio',horseGame);
    registerTarget(bay,'il cavallo baio',horseGame);
  }
  function horseGame(){
    const stages=[
      [{label:'🐎 Avvicinati lentamente',correct:true},{label:'🗣️ Urla per farlo correre',correct:false}],
      [{label:'🤲 Accarezza il collo',correct:true},{label:'🏇 Salta subito in sella',correct:false}],
      [{label:'🚶 Procedi al passo',correct:true},{label:'⚡ Parti al galoppo',correct:false}]
    ];
    let index=0;
    function ask(){
      const answers=shuffle(stages[index]);
      modal('🐎 Molentargius — fiducia','Marghe: «Con calma, Edo. Ascolta il cavallo.»\nPasso '+(index+1)+'/3',answers.map(answer=>[answer.label,()=>{
        if(answer.correct){
          index++;
          if(index===stages.length)modal('🐴 Passeggiata riuscita!','Il grigio e il baio attraversano le saline, tra i fenicotteri.',[['Conserva il ricordo',done,true]]);
          else ask();
        }else modal('🐴 Piano!','Il cavallo ha bisogno di calma e fiducia. Le risposte cambieranno ordine al nuovo tentativo.',[['Riprova questo passo',ask]]);
      }]));
    }
    ask();
  }

  function makePunchBag(x,z){
    const g=group(x,0,z);
    cyl(.08,2.8,'#4e535d',0,1.4,0,g);
    ball(.52,'#b8616c',0,1.28,0,g,.7,1.45,.7);
    return g;
  }
  function makeGym(){
    for(let x=-5;x<=5;x+=2)box(1.8,.06,2,x%4?'#8eb2b8':'#a7c3bd',x,.03,1.7);
    const bag=makePunchBag(3,-2.6);
    registerTarget(bag,'il sacco da allenamento',sequenceGame);
    state.customMarghe=true;
    registerTarget(marghe,'Marghe',gymDialogue);
  }
  function gymDialogue(){
    modal('🥊 Allenamento con Marghe','Scegli come interagire con Marghe.',[
      ['🥊 Clinch',()=>modal('🥊 Clinch','Vi avvicinate in posizione di clinch: Marghe controlla la guardia e poi scoppia a ridere.',[['Continua l’allenamento',closeModal]])],
      ['🧠 Ricorda la sequenza',sequenceGame],
      ['💗 Abbraccia Marghe',hugMarghe]
    ]);
  }
  function sequenceGame(){
    const moves=['Jab','Diretto','Gancio','Low kick','Gancio'];
    function showMove(index){
      modal('🥊 Osserva la sequenza','I gesti compaiono uno alla volta. Mossa '+(index+1)+'/5.',[
        [index===moves.length-1?'Ora ripeti la sequenza →':'Mossa successiva →',()=>index===moves.length-1?recall(0):showMove(index+1),true]
      ]);
      const card=document.createElement('div');
      card.className='move-card';
      card.textContent=(moves[index]==='Low kick'?'🦵 ':'🥊 ')+moves[index];
      extra.append(card);
    }
    function recall(index){
      const choices=shuffle(['Jab','Diretto','Gancio','Low kick']);
      modal('🧠 Ripeti la combinazione','Mossa '+(index+1)+'/5 — scegli il gesto che ricordi.',choices.map(choice=>[choice,()=>{
        if(choice===moves[index]){
          if(index===moves.length-1)modal('🥊 Sequenza perfetta!','Jab, diretto, gancio, low kick, gancio: memoria completata.',[['Conserva il ricordo',done,true]]);
          else recall(index+1);
        }else modal('🔁 Ricominciamo','Non era il gesto giusto. Marghe mostra di nuovo la sequenza, una mossa alla volta.',[['Rivedi la sequenza',()=>showMove(0)]])
      }]));
    }
    showMove(0);
  }

  function makeCat(x,z){
    const g=group(x,0,z);
    ball(.42,'#df965e',0,.38,0,g,1.25,.82,.9);
    ball(.3,'#fff4e8',.42,.55,0,g,1,.9,.9);
    cone(.15,.3,'#df965e',.28,.85,-.16,g,4);
    cone(.15,.3,'#df965e',.28,.85,.16,g,4);
    for(const side of [-1,1])ball(.05,'#4a3934',.67,.59,side*.1,g);
    const tail=ball(.15,'#df965e',-.58,.48,0,g,.7,2.2,.7);tail.rotation.z=-.65;
    for(const xOffset of [-.25,.25])ball(.17,'#fff4e8',xOffset,.14,.24,g,1,.65,1.3);
    return g;
  }
  function makeNennoScene(){
    const bed=group(1.5,0,-.3);
    ball(.82,'#d6aa91',0,.2,0,bed,1.4,.28,1);
    const nenno=makeCat(1.5,-.3);
    registerTarget(nenno,'Nenno',()=>modal('🐈 Nenno','Nenno è acciambellato e aspetta soltanto una cosa.',[
      ['🤲 Accarezza Nenno',()=>modal('🐾 Prrrrrrrr…','Nenno chiude gli occhi e fa le fusa mentre lo accarezzate.',[['Conserva le coccole',done,true]])]
    ]));
  }

  function addCameraProp(avatar){
    box(.38,.28,.2,'#403945',.48,1.02,.25,avatar);
    const lens=cyl(.11,.1,'#79a0b5',.48,1.02,.4,avatar);lens.rotation.x=Math.PI/2;
    box(.15,.13,.12,'#403945',.48,1.23,.24,avatar);
  }
  function addSandwichProp(avatar){
    box(.5,.18,.3,'#dfad66',.47,1.02,.26,avatar);
    box(.47,.06,.31,'#6f9b6f',.47,1.13,.26,avatar);
    box(.5,.12,.3,'#e6b67b',.47,1.22,.26,avatar);
  }
  function addCupProp(avatar,color='#f5ead9'){cyl(.12,.3,color,.48,1,.24,avatar)}
  function makeFestival(){
    buildings(['#ad7766','#c58d70']);
    for(let i=0;i<13;i++)ball(.11,i%2?'#f7dda0':'#efb3aa',-7.2+i*1.2,3.35,-3);
    state.found=new Set();
    const guests=[
      {name:'Franci',x:-5,z:.2,kind:'marghe',shirt:'#b77c9d',hair:'#6a3e32',prop:'camera'},
      {name:'Gian',x:4,z:1.6,kind:'guest',shirt:'#608c71',hair:'#3c2c27',prop:'sandwich'},
      {name:'Ospite',x:-1.4,z:-2.1,kind:'guest',shirt:'#c77c6f',hair:'#b78958',prop:'cup'},
      {name:'Ospite',x:5.8,z:-2.2,kind:'guest',shirt:'#6389a9',hair:'#282b36',prop:'cup'}
    ];
    for(const guest of guests){
      const avatar=person(guest.kind,guest.x,guest.z,guest.shirt,guest.hair);
      if(guest.prop==='camera')addCameraProp(avatar);
      else if(guest.prop==='sandwich')addSandwichProp(avatar);
      else addCupProp(avatar,guest.shirt);
      registerTarget(avatar,guest.name==='Ospite'?'un ospite':guest.name,()=>festivalGuest(guest));
    }
  }
  function festivalGuest(guest){
    if(guest.name==='Ospite'){
      modal('🍻 Un partecipante','Ha abiti e capelli diversi dagli altri, ma non è una delle persone che cercate.',[['Continua la ricerca',closeModal]]);return;
    }
    if(state.found.has(guest.name)){
      modal('💬 '+guest.name,'Lo hai già riconosciuto. Cerca anche l’altra persona.',[['Continua',closeModal]]);return;
    }
    const clue=guest.name==='Franci'?'È una ragazza con i capelli lunghi e una videocamera.':'È un ragazzo con un panino.';
    modal('🔎 Chi sarà?',clue,[
      ['È Franci!',()=>guessFestival(guest,'Franci')],['È Gian!',()=>guessFestival(guest,'Gian')],['Continuo a osservare',closeModal]
    ]);
  }
  function guessFestival(guest,answer){
    if(answer!==guest.name){modal('🤔 Riprova','Guarda il personaggio e l’oggetto che tiene in mano.',[['Torno a osservare',closeModal]]);return}
    state.found.add(guest.name);
    if(state.found.size===2)modal('🎉 Franci e Gian!','Franci, chiaramente femminile e con la videocamera, saluta. Gian non molla il panino.',[['Conserva il ricordo',done,true]]);
    else modal('✨ Hai trovato '+guest.name,'Ora cerca l’altra persona tra gli NPC, tutti diversi.',[['Continua la ricerca',closeModal]]);
  }

  function makeKey(parent){
    const g=group(0,0,0,parent);
    const ring=addMesh(new THREE.TorusGeometry(.16,.045,8,20),'#f2c45d',0,0,0,g);
    ring.rotation.x=Math.PI/2;
    box(.08,.48,.07,'#f2c45d',0,-.3,0,g);
    box(.22,.08,.07,'#f2c45d',.08,-.5,0,g);
    g.scale.set(1.2,1.2,1.2);
    return g;
  }
  function makeChest(x,z){
    const g=group(x,0,z);
    box(2.5,.9,1.55,'#9d673f',0,.45,0,g);
    box(.18,.95,1.65,'#e1b05e',0,.48,0,g);
    const lid=box(2.7,.42,1.72,'#bd824a',0,1.08,0,g);
    box(.24,.42,1.8,'#e1b05e',0,1.08,0,g);
    box(.42,.5,.16,'#f0c96a',0,.7,.83,g);
    return {group:g,lid};
  }
  function makeFinal(){
    for(let i=0;i<24;i++)ball(.05,'#fff1b8',Math.sin(i*2.7)*7,1.4+(i%6)*.5,-5.4+(i%3)*.22);
    marghe.position.set(-1.35,0,.15);
    const chest=makeChest(1.1,-1.55);
    const key=makeKey(marghe);
    key.position.set(.55,1.2,.28);
    state.customMarghe=true;
    state.hasKey=false;
    state.key=key;
    state.chest=chest;
    registerTarget(marghe,'Marghe',finalMarghe);
    registerTarget(chest.group,'il forziere',openFinalChest);
  }
  function finalMarghe(){
    if(state.hasKey){modal('💗 Marghe','Marghe: «Ora la chiave è tua. Il forziere ti aspetta.»',[['Vado al forziere',closeModal],['💗 Abbraccia Marghe',hugMarghe]]);return}
    modal('🗝️ La chiave di Marghe','Marghe apre la mano: tiene una piccola chiave dorata a forma di cuore.\n«Edo, questa è per te.»',[
      ['Prendi la chiave da Marghe',()=>{
        state.hasKey=true;
        marghe.remove(state.key);
        edo.add(state.key);
        state.key.position.set(.55,1.25,.3);
        hint.textContent='🗝️ Hai la chiave. Ora raggiungi il forziere e aprilo.';
        modal('🗝️ Chiave ricevuta','La chiave ora è con Edo. Il forziere è un oggetto reale nella scena: avvicinati e premi Interagisci.',[['Vai al forziere',closeModal,true]]);
      },true],
      ['💗 Abbraccia Marghe',hugMarghe]
    ]);
  }
  function openFinalChest(){
    if(!state.hasKey){modal('🔒 Il forziere è chiuso','La serratura ha la forma di un cuore. Prima devi ricevere la chiave da Marghe.',[['Torno da Marghe',closeModal]]);return}
    state.chest.lid.rotation.x=-.85;
    state.chest.lid.position.y=1.45;
    saved[current]=true;
    saveProgress();
    showFinal();
  }
  function showFinal(){
    modal('💌 Il messaggio nel forziere',`Edo,

Tutto è iniziato con un libro e una scusa perfetta per chiedermi il numero. Poi sono arrivati Venezia, un bacio sotto casa, Bled, la Sardegna, Londra, le risate e le coccole con Nenno.

Se potessi scegliere di nuovo, sceglierei ancora tutte queste avventure con te. Anche quelle più buffe. Soprattutto quelle.

Buon anniversario, amore mio. Ti amo.

— Marghe Pizzetta ❤️`,[['💗 Rivedi il nostro universo',()=>showMenu(false)],['Resta qui un momento',closeModal]]);
  }

  function buildScene(){
    clearWorld();
    miniMode=null;
    state={};
    finished=false;
    act.textContent='Interagisci';
    act.classList.remove('timing-green','timing-red');
    const chapter=chapters[current];
    setPalette(chapter.theme);
    commonLandDecor(chapter.theme);
    edo=person('edo',-4,2.2,'#6b8ba5','#3c2c27');
    marghe=person('marghe',1.6,.1,'#bd7e9a','#e6b653');
    avatarLast.copy(edo.position);
    title.textContent=chapter.icon+' '+chapter.title;
    subtitle.textContent='Livello '+(current+3)+' di '+(chapters.length+2)+' · '+chapter.place;
    hint.textContent=chapter.hint;
    switch(current){
      case 0:makeCafe();break;
      case 1:makeBled();break;
      case 2:makeSunsetBeach(false);break;
      case 3:makeSurf();break;
      case 4:makeSnow();break;
      case 5:makeRestaurant();break;
      case 6:makeLondon();break;
      case 7:makeMysteryBox();break;
      case 8:makeMolentargius();break;
      case 9:makeGym();break;
      case 10:makeNennoScene();break;
      case 11:makeFestival();break;
      case 12:makeFinal();break;
    }
    if(!state.customMarghe)registerTarget(marghe,'Marghe',companionDialogue);
    sceneReady=true;
  }
  function openChapter(index){
    current=index;
    history.replaceState(null,'','avventure.html?level='+index);
    buildScene();
    closeModal();
  }
  function showMenu(initial=false){
    modal('🗺️ Il nostro universo','Scegli un ricordo da esplorare. Qui non appare nessuna mappa prima della tua scelta.',[
      ['🎓 Capitolo 1 — Università',()=>location.href='index.html'],
      ['💋 Capitolo 2 — Primo bacio',()=>location.href='bacio.html'],
      ...chapters.map((chapter,index)=>[(saved[index]?'✓ ':'')+chapter.icon+' '+chapter.title,()=>openChapter(index)]),
      ...(initial?[]:[['Chiudi',closeModal]])
    ]);
  }

  function nearestTarget(){
    if(!edo)return null;
    let best=null;
    let distance=Infinity;
    for(const target of targets){
      if(target.disabled||!target.object.visible)continue;
      const d=targetPosition(target).distanceTo(edo.position);
      if(d<distance){best=target;distance=d}
    }
    return best?{target:best,distance}:null;
  }
  function action(){
    if(open||!sceneReady)return;
    if(miniMode==='surf'){surfTap();return}
    const nearest=nearestTarget();
    if(nearest&&nearest.distance<2.65)nearest.target.action();
    else if(nearest)hint.textContent='Avvicinati a '+nearest.target.label+' per interagire.';
    else hint.textContent='Esplora gli oggetti e i personaggi della scena.';
  }
  act.onclick=action;
  document.getElementById('menuBtn').onclick=()=>showMenu(false);

  const joy=document.getElementById('joy');
  const stick=document.getElementById('stick');
  let dx=0,dz=0;
  function moveStick(event){
    const rect=joy.getBoundingClientRect();
    const x=event.clientX-rect.left-rect.width/2;
    const z=event.clientY-rect.top-rect.height/2;
    const length=Math.max(1,Math.hypot(x,z));
    const scale=Math.min(36,length)/length;
    dx=x*scale/36;dz=z*scale/36;
    stick.style.transform=`translate(${x*scale}px,${z*scale}px)`;
  }
  joy.addEventListener('pointerdown',event=>{joy.setPointerCapture(event.pointerId);moveStick(event)});
  joy.addEventListener('pointermove',event=>{if(joy.hasPointerCapture(event.pointerId))moveStick(event)});
  function resetStick(){dx=dz=0;stick.style.transform='translate(0,0)'}
  joy.addEventListener('pointerup',resetStick);
  joy.addEventListener('pointercancel',resetStick);
  const keys={};
  addEventListener('keydown',event=>{keys[event.key.toLowerCase()]=true;if(event.key===' ')action()});
  addEventListener('keyup',event=>{keys[event.key.toLowerCase()]=false});

  const clock=new THREE.Clock();
  function frame(){
    requestAnimationFrame(frame);
    const dt=Math.min(.05,clock.getDelta());
    elapsed+=dt;
    if(sceneReady&&edo){
      if(!open&&!finished){
        let x=dx+(keys.d||keys.arrowright?1:0)-(keys.a||keys.arrowleft?1:0);
        let z=dz+(keys.s||keys.arrowdown?1:0)-(keys.w||keys.arrowup?1:0);
        const length=Math.hypot(x,z);
        if(length>.1){
          x/=Math.max(1,length);z/=Math.max(1,length);
          edo.position.x=THREE.MathUtils.clamp(edo.position.x+x*dt*3.35,-8,8);
          edo.position.z=THREE.MathUtils.clamp(edo.position.z+z*dt*3.35,-5.7,5.7);
          edo.rotation.y=Math.atan2(x,z);
        }
      }
      camera.position.lerp(new THREE.Vector3(edo.position.x+6.3,8.6,edo.position.z+10),.07);
      camera.lookAt(edo.position.x,0,edo.position.z-1);
      animateAvatar(edo,elapsed,edo.position.distanceTo(avatarLast)>.012);
      avatarLast.copy(edo.position);
      for(const actor of actors){if(actor!==edo)animateAvatar(actor,elapsed,false,true)}
    }else camera.lookAt(0,0,0);
    if(miniMode==='surf'){
      const green=Math.sin(elapsed*3)>.2;
      act.classList.toggle('timing-green',green);
      act.classList.toggle('timing-red',!green);
    }else act.classList.remove('timing-green','timing-red');
    renderer.render(scene,camera);
  }
  frame();

  addEventListener('resize',()=>{
    camera.aspect=innerWidth/innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth,innerHeight);
  });

  const query=new URLSearchParams(location.search);
  const hasLevel=query.has('level');
  const requested=Number(query.get('level'));
  if(hasLevel&&Number.isInteger(requested)&&requested>=0&&requested<chapters.length){
    current=requested;
    buildScene();
    closeModal();
  }else{
    sceneReady=false;
    showMenu(true);
  }
}

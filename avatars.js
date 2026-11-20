// Edo & Marghe: chibi cozy procedural characters, no external 3D models required.
export function makeAvatar(T,kind='edo',shirt='#758aa7',hairColor=null){
 const root=new T.Group();const rig=new T.Group();root.add(rig);
 const material=(c,roughness=.78)=>new T.MeshStandardMaterial({color:c,roughness});
 const isMarghe=kind==='marghe',isEdo=kind==='edo';
 const skin=material(isEdo?'#eab995':'#f1c8a7'),cloth=material(shirt||'#758aa7'),jeans=material('#627b98'),hair=material(hairColor||(isMarghe?'#dca75d':'#392922')),highlight=material(isMarghe?'#f4c879':(hairColor||'#5a4036')),dark=material('#332a2e'),white=material('#fff9ef'),rose=material('#d87f82'),shoe=material('#e9d7c4');
 function shape(parent,geo,mat,x,y,z,sx=1,sy=1,sz=1){const o=new T.Mesh(geo,mat);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o}
 const sphere=(p,r,m,x,y,z,sx=1,sy=1,sz=1)=>shape(p,new T.SphereGeometry(r,18,14),m,x,y,z,sx,sy,sz);
 const capsule=(p,r,h,m,x,y,z)=>shape(p,new T.CapsuleGeometry(r,h,4,10),m,x,y,z);
 // Cute proportions: oversized head and small, round torso.
 sphere(rig,.39,cloth,0,.88,0,1,1.15,.74);
 sphere(rig,.16,white,0,1.04,.29,1.15,.48,.22);
 const head=new T.Group();head.position.y=1.58;rig.add(head);
 sphere(head,.52,skin,0,0,0,1.02,1.05,.93);
 sphere(head,.51,hair,0,.24,-.09,1.06,.74,1.02);
 // Rounded locks, with extra waves on Marghe's long blonde hair.
  for(let i=0;i<7;i++){const a=-1.35+i*.45;const lock=sphere(head,isMarghe?.19:.17,hair,Math.sin(a)*.42,.35+Math.cos(a)*.075,.29,.86,1.1,.85);lock.rotation.z=Math.sin(i*2)*.25}
 if(isMarghe)for(let side of [-1,1]){sphere(head,.23,hair,side*.43,-.29,-.08,.75,1.7,.87);sphere(head,.16,highlight,side*.43,-.52,.02,.73,1.65,.72);sphere(head,.12,highlight,side*.36,-.66,.08,.72,1.2,.8)}
 else {for(let i=0;i<4;i++)sphere(head,.15,hair,-.35+i*.23,.55,-.02,1,.85,.9);sphere(head,.32,hair,0,-.32,.19,1.1,.54,.85);sphere(head,.27,skin,0,-.19,.34,1,.72,.7)}
 // Sweet inset eyes: dark almond-shaped pupils, tiny glints, subtle blush.
 for(const side of [-1,1]){
  sphere(head,.077,material('#584444'),side*.215,-.025,.452,1,.72,.23);
  sphere(head,.018,white,side*.195,.001,.471,.75,.75,.35);
  sphere(head,.09,rose,side*.35,-.17,.373,1,.32,.14);
  const brow=sphere(head,.075,hair,side*.215,.128,.436,1.25,.12,.14);
  brow.rotation.z=side*.12;
 }
 sphere(head,.052,skin,0,-.16,.475,.75,.65,.55);
 // Curved smile made of a thin arc, rather than protruding lips.
 const smile=new T.Mesh(new T.TorusGeometry(.073,.010,5,18,Math.PI),material('#a35e61'));
 smile.position.set(0,-.218,.477);smile.rotation.z=Math.PI;head.add(smile);
 if(isEdo){
  const frame=material('#27242a',.45),lens=new T.MeshStandardMaterial({color:'#d7ecf7',transparent:true,opacity:.12,roughness:.1,depthWrite:false});
  for(let side of [-1,1]){shape(head,new T.TorusGeometry(.126,.014,7,26),frame,side*.216,-.009,.508,1.08,.86,1);shape(head,new T.CircleGeometry(.107,24),lens,side*.216,-.009,.505);shape(head,new T.BoxGeometry(.18,.025,.027),frame,side*.42,.055,.40)}
  shape(head,new T.BoxGeometry(.13,.026,.028),frame,0,.05,.523);
 }
 const arms=[],legs=[];
 for(const s of [-1,1]){
  const arm=new T.Group();arm.position.set(s*.36,1.12,0);rig.add(arm);capsule(arm,.125,.32,cloth,s*.035,-.21,0);sphere(arm,.13,skin,s*.04,-.47,.025);arms.push(arm);
  const leg=new T.Group();leg.position.set(s*.17,.58,0);rig.add(leg);capsule(leg,.145,.27,jeans,0,-.22,0);sphere(leg,.18,shoe,0,-.48,.13,1,.65,1.42);legs.push(leg);
 }
 if(isEdo){const pack=material('#786453');sphere(rig,.29,pack,0,.91,-.34,1,1.18,.42)}
 root.userData.rig={body:rig,head,arms,legs,phase:Math.random()*6};return root;
}
export function animateAvatar(g,time,moving=false,gesture=false){const r=g?.userData?.rig;if(!r)return;const p=time*8+r.phase,step=moving?.48:.018;r.body.position.y=Math.sin(p*(moving?1:.25))*(moving?.045:.017);r.body.rotation.z=gesture?Math.sin(time*2.2)*.055:0;r.head.rotation.z=Math.sin(time*1.8+r.phase)*.055;r.head.rotation.x=gesture?-.055:0;r.legs[0].rotation.x=Math.sin(p)*step;r.legs[1].rotation.x=-Math.sin(p)*step;r.arms[0].rotation.x=-Math.sin(p)*step*.7;r.arms[1].rotation.x=Math.sin(p)*step*.7;r.arms[0].rotation.z=gesture?-.35+Math.sin(time*3)*.14:0;r.arms[1].rotation.z=gesture?.12:0;}

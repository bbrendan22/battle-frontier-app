import React,{useEffect,useMemo,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import pokemon from './data/pokemon.json';
import moves from './data/moves.json';
import abilities from './data/abilities.json';
import natures from './data/natures.json';
import heldItems from './data/held-items.json';
import berries from './data/berries.json';
import frontierSets from './data/frontier-sets.json';
import trainers from './data/trainers.json';
import './styles.css';

const STORAGE_KEY='battle-frontier-my-pokemon-v1';
const TEAMS_STORAGE_KEY='battle-frontier-teams-v1';
const BACKUP_FORMAT='battle-frontier-app-backup';
const BACKUP_VERSION=4;
const STREAKS_STORAGE_KEY='battle-frontier-top-streaks-v1';
const demoDexes=[260,94,248,143,376,373,121,350,130,214,257,254,289,6,169,128,142,65,230,212,330,286,9,131,208,242,149,3,135,291];
const master=new Map(pokemon.map(p=>[Number(p['#']),p]));
const validValue=v=>v && v!=='-' && v!=='—';
const sprite=(dex,shiny)=>`${import.meta.env.BASE_URL}sprites/emerald/${shiny?'shiny':'normal'}/${String(dex).padStart(3,'0')}.png`;
const genLabel=n=>`Gen ${['','I','II','III'][Number(n)]||n}`;
const statKeys=['HP','Atk','Def','SpA','SpD','Spe'];
const statNames={HP:'HP',Atk:'Attack',Def:'Defense',SpA:'Sp. Atk',SpD:'Sp. Def',Spe:'Speed'};
const allMoveNames=moves.map(m=>m.Name).sort((a,b)=>a.localeCompare(b));
const moveByName=new Map(moves.map(m=>[m.Name,m]));
const titleCaseType=t=>t?String(t).charAt(0).toUpperCase()+String(t).slice(1).toLowerCase():'';
const natureNames=natures.map(n=>n.Nature);
const itemNames=[...new Set([
  ...heldItems.map(i=>i.Name),
  ...berries.map(b=>b.Number)
].filter(Boolean))].sort((a,b)=>a.localeCompare(b));


const TYPE_COLORS={
  Normal:'#AAAA9B',Fighting:'#BB5544',Flying:'#879BFF',Poison:'#AA5599',Ground:'#DEBB54',
  Rock:'#BBAC66',Bug:'#AABC22',Ghost:'#6666BB',Steel:'#AAAABD',Fire:'#FF4421',
  Water:'#3399FF',Grass:'#77CC55',Electric:'#FFCC33',Psychic:'#FF5599',Ice:'#65CEFF',
  Dragon:'#7766EE',Dark:'#775344'
};
const GENDERLESS=new Set([
  'Magnemite','Magneton','Voltorb','Electrode','Staryu','Starmie','Ditto','Porygon',
  'Articuno','Zapdos','Moltres','Mewtwo','Mew','Unown','Porygon2','Raikou','Entei',
  'Suicune','Lugia','Ho-Oh','Celebi','Shedinja','Lunatone','Solrock','Baltoy','Claydol',
  'Beldum','Metang','Metagross','Regirock','Regice','Registeel','Kyogre','Groudon',
  'Rayquaza','Jirachi','Deoxys'
]);
const FEMALE_ONLY=new Set(['Nidoran♀','Nidorina','Nidoqueen','Chansey','Kangaskhan','Jynx','Smoochum','Miltank','Blissey','Illumise','Latias']);
const MALE_ONLY=new Set(['Nidoran♂','Nidorino','Nidoking','Tauros','Hitmonlee','Hitmonchan','Tyrogue','Hitmontop','Volbeat','Latios']);
function genderRule(name){
  if(GENDERLESS.has(name))return {options:['Genderless'],fixed:true};
  if(FEMALE_ONLY.has(name))return {options:['Female'],fixed:true};
  if(MALE_ONLY.has(name))return {options:['Male'],fixed:true};
  return {options:['Male','Female'],fixed:false};
}
function cleanBattleType(type){
 const t=titleCaseType(type);
 return Object.prototype.hasOwnProperty.call(TYPE_COLORS,t)?t:'';
}
function TypeChip({type}){
 const clean=cleanBattleType(type);
 if(!clean)return null;
 return <span className="typeChip" style={{backgroundColor:TYPE_COLORS[clean]||'#e8edf3'}}>{clean}</span>;
}

function blankStats(value=0){return Object.fromEntries(statKeys.map(k=>[k,value]));}
function createDemo(){
 return demoDexes.map((dex,i)=>({
   id:`demo-${i+1}`,dex,nickname:'',shiny:[6,135,291].includes(dex),level:50,nature:'Hardy',
   ability:master.get(dex)?.['Ability 1']||'',gender:'',item:'',moves:[],ivs:blankStats(31),evs:blankStats(0)
 }));
}
function loadCollection(){
 try{
   const saved=localStorage.getItem(STORAGE_KEY);
   if(saved){const parsed=JSON.parse(saved);if(Array.isArray(parsed))return parsed;}
 }catch(e){console.warn('Could not load saved Pokémon',e);}
 return createDemo();
}
function natureMultiplier(natureName,key){
 if(key==='HP')return 1;
 const row=natures.find(n=>n.Nature===natureName);
 if(!row)return 1;
 const name=statNames[key];
 if(row['Increased Stat']===name)return 1.1;
 if(row['Decreased Stat']===name)return .9;
 return 1;
}
function calcStats(record,p){
 const level=Number(record.level)||50;
 const out={};
 statKeys.forEach(key=>{
   const base=Number(p[key])||0,iv=Number(record.ivs?.[key]??31),ev=Number(record.evs?.[key]??0);
   if(key==='HP') out[key]=Math.floor(((2*base+iv+Math.floor(ev/4))*level)/100)+level+10;
   else out[key]=Math.floor((Math.floor(((2*base+iv+Math.floor(ev/4))*level)/100)+5)*natureMultiplier(record.nature,key));
 });
 return out;
}
function speciesAbilities(p){return [p?.['Ability 1'],p?.['Ability 2']].filter(validValue);}
function makeId(){return globalThis.crypto?.randomUUID?.()||`pokemon-${Date.now()}-${Math.random().toString(16).slice(2)}`;}

const CAUGHT_GAMES=['Emerald','Ruby','Sapphire','FireRed','LeafGreen','Colosseum','XD'];
function makeTeamId(){return globalThis.crypto?.randomUUID?.()||`team-${Date.now()}-${Math.random().toString(16).slice(2)}`;}
function normalizeTeam(team){
 const mode=team?.mode==='Doubles'?'Doubles':'Singles';
 const facility=team?.facility==='Dome'?'Dome':'Tower';
 return {...team,mode,facility,memberIds:Array.isArray(team?.memberIds)?team.memberIds.slice(0,mode==='Singles'?3:4):[]};
}
function loadTeams(){
 try{const saved=localStorage.getItem(TEAMS_STORAGE_KEY);if(saved){const parsed=JSON.parse(saved);if(Array.isArray(parsed))return parsed.map(normalizeTeam);}}
 catch(e){console.warn('Could not load saved teams',e);}
 return [];
}

const STREAK_CATEGORIES=[
 {key:'tower-singles',label:'Tower Singles',facility:'Tower',mode:'Singles',size:3,color:'#5fd0ff'},
 {key:'tower-doubles',label:'Tower Doubles',facility:'Tower',mode:'Doubles',size:4,color:'#6f9dff'},
 {key:'dome-singles',label:'Dome Singles',facility:'Dome',mode:'Singles',size:3,color:'#bd7cff'},
 {key:'dome-doubles',label:'Dome Doubles',facility:'Dome',mode:'Doubles',size:4,color:'#e16cff'}
];
function normalizeStreakEntry(entry){
 if(!entry||typeof entry!=='object')return null;
 const category=STREAK_CATEGORIES.find(x=>x.key===entry.category)?.key;
 if(!category)return null;
 return {
   id:String(entry.id||makeTeamId()),category,
   streak:Math.max(0,Math.floor(Number(entry.streak)||0)),
   level:Number(entry.level)===100?100:50,
   memberIds:Array.isArray(entry.memberIds)?entry.memberIds.map(String):[]
 };
}
function normalizeTopStreaks(value){
 const out={};STREAK_CATEGORIES.forEach(c=>out[c.key]=[]);
 if(value&&typeof value==='object'){
   STREAK_CATEGORIES.forEach(c=>{
     const rows=Array.isArray(value[c.key])?value[c.key]:[];
     out[c.key]=rows.map(normalizeStreakEntry).filter(Boolean).sort((a,b)=>b.streak-a.streak).slice(0,3);
   });
 }
 return out;
}
function loadTopStreaks(){
 try{const saved=localStorage.getItem(STREAKS_STORAGE_KEY);if(saved)return normalizeTopStreaks(JSON.parse(saved));}
 catch(e){console.warn('Could not load top streaks',e);}
 return normalizeTopStreaks({});
}
function maxComparableStat(level,key){
 const L=Math.max(1,Math.min(100,Number(level)||50));
 const maxBase=Math.max(...pokemon.map(p=>Number(p[key])||0));
 if(key==='HP')return Math.floor(((2*maxBase+31+Math.floor(252/4))*L)/100)+L+10;
 return Math.floor((Math.floor(((2*maxBase+31+Math.floor(252/4))*L)/100)+5)*1.1);
}

function showdownStatKey(label){
 const key=String(label||'').trim().toLowerCase().replace(/[^a-z]/g,'');
 return ({hp:'HP',atk:'Atk',attack:'Atk',def:'Def',defense:'Def',spa:'SpA',spatk:'SpA',specialattack:'SpA',spd:'SpD',spdef:'SpD',specialdefense:'SpD',spe:'Spe',speed:'Spe'})[key]||null;
}
function findPokemonByName(name){
 const q=String(name||'').trim().toLowerCase().replace(/♀/g,'f').replace(/♂/g,'m');
 return pokemon.find(x=>String(x.Pokemon).toLowerCase().replace(/♀/g,'f').replace(/♂/g,'m')===q)||null;
}
function canonicalFromList(value,list){
 const q=String(value||'').trim().toLowerCase();
 return list.find(x=>String(x).toLowerCase()===q)||'';
}
function parseShowdownPaste(text){
 const lines=String(text||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 if(!lines.length)throw new Error('Paste a PokéPaste / Showdown set first.');
 const result={ivs:blankStats(31),evs:blankStats(0),moves:[]};
 let first=lines[0], left=first, item='';
 if(first.includes('@')){const parts=first.split('@');left=parts.shift().trim();item=parts.join('@').trim();}
 const speciesMatch=left.match(/\(([^()]+)\)\s*(?:\([^()]+\))?$/);
 let speciesName=speciesMatch?speciesMatch[1].trim():left.replace(/\s*\((?:M|F)\)\s*$/i,'').trim();
 let nickname='';
 if(speciesMatch){nickname=left.slice(0,speciesMatch.index).trim();}
 const species=findPokemonByName(speciesName);
 if(!species)throw new Error(`Could not find species “${speciesName}” in the Gen III Pokédex.`);
 result.dex=Number(species['#']);result.nickname=nickname;result.item=canonicalFromList(item,itemNames);
 for(const line of lines.slice(1)){
   let m;
   if((m=line.match(/^Ability:\s*(.+)$/i)))result.ability=m[1].trim();
   else if((m=line.match(/^Level:\s*(\d+)/i)))result.level=Math.max(1,Math.min(100,Number(m[1])));
   else if((m=line.match(/^Shiny:\s*(Yes|True)$/i)))result.shiny=true;
   else if((m=line.match(/^EVs:\s*(.+)$/i))){
     result.evs=blankStats(0);for(const part of m[1].split('/')){const mm=part.trim().match(/^(\d+)\s+(.+)$/);if(mm){const k=showdownStatKey(mm[2]);if(k)result.evs[k]=Math.max(0,Math.min(255,Number(mm[1])));}}
   }else if((m=line.match(/^IVs:\s*(.+)$/i))){
     result.ivs=blankStats(31);for(const part of m[1].split('/')){const mm=part.trim().match(/^(\d+)\s+(.+)$/);if(mm){const k=showdownStatKey(mm[2]);if(k)result.ivs[k]=Math.max(0,Math.min(31,Number(mm[1])));}}
   }else if((m=line.match(/^(.+?)\s+Nature$/i)))result.nature=canonicalFromList(m[1],natureNames)||m[1].trim();
   else if((m=line.match(/^-\s*(.+)$/))){const move=canonicalFromList(m[1],allMoveNames);if(move&&result.moves.length<4)result.moves.push(move);}
 }
 return result;
}

function showdownTextForRecord(record){
 const p=master.get(Number(record.dex));
 if(!p)return '';
 const species=p.Pokemon;
 const nickname=String(record.nickname||'').trim();
 const gender=record.gender==='Male'?' (M)':record.gender==='Female'?' (F)':'';
 let first=nickname?`${nickname} (${species})${gender}`:`${species}${gender}`;
 if(record.item)first+=` @ ${record.item}`;
 const lines=[first];
 if(record.ability)lines.push(`Ability: ${record.ability}`);
 if(Number(record.level)&&Number(record.level)!==100)lines.push(`Level: ${record.level}`);
 if(record.shiny)lines.push('Shiny: Yes');
 const evParts=statKeys.filter(k=>Number(record.evs?.[k]||0)>0).map(k=>`${Number(record.evs[k])} ${k}`);
 if(evParts.length)lines.push(`EVs: ${evParts.join(' / ')}`);
 if(record.nature)lines.push(`${record.nature} Nature`);
 const ivParts=statKeys.filter(k=>Number(record.ivs?.[k]??31)!==31).map(k=>`${Number(record.ivs?.[k]??31)} ${k}`);
 if(ivParts.length)lines.push(`IVs: ${ivParts.join(' / ')}`);
 (record.moves||[]).filter(Boolean).slice(0,4).forEach(m=>lines.push(`- ${m}`));
 return lines.join('\n');
}

async function copyTextToClipboard(text){
 if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);return;}
 const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();
}

function PokemonCreator({onCancel,onSave,onDelete,initialRecord=null}){
 const editing=!!initialRecord;
 const [dex,setDex]=useState(initialRecord?.dex||1);
 const p=master.get(Number(dex));
 const initialGender=genderRule(p.Pokemon);
 const [form,setForm]=useState(initialRecord?{
   nickname:initialRecord.nickname||'',level:initialRecord.level||50,shiny:!!initialRecord.shiny,nature:initialRecord.nature||'Hardy',
   ability:initialRecord.ability||p['Ability 1']||'',gender:initialRecord.gender||initialGender.options[0]||'',item:initialRecord.item||'',caughtGame:initialRecord.caughtGame||'',
   moves:[...(initialRecord.moves||[]), '', '', '', ''].slice(0,4),ivs:{...blankStats(31),...(initialRecord.ivs||{})},evs:{...blankStats(0),...(initialRecord.evs||{})}
 }:{nickname:'',level:50,shiny:false,nature:'Hardy',ability:p['Ability 1'],gender:initialGender.fixed?initialGender.options[0]:'',item:'',caughtGame:'',moves:['','','',''],ivs:blankStats(31),evs:blankStats(0)});
 const [error,setError]=useState('');
 const [pasteText,setPasteText]=useState('');
 const [exportLabel,setExportLabel]=useState('Export');
 const abilitiesForSpecies=speciesAbilities(p);
 const genderForSpecies=genderRule(p.Pokemon);
 const evTotal=statKeys.reduce((sum,k)=>sum+Number(form.evs[k]||0),0);

 useEffect(()=>{
   const next=master.get(Number(dex));const opts=speciesAbilities(next);const rule=genderRule(next.Pokemon);
   setForm(f=>({...f,ability:opts.includes(f.ability)?f.ability:(opts[0]||''),gender:rule.fixed?rule.options[0]:(['Male','Female'].includes(f.gender)?f.gender:'')}));
 },[dex]);
 function setField(key,value){setForm(f=>({...f,[key]:value}));}
 function setStat(group,key,value,max){let n=Number(value);if(!Number.isFinite(n))n=0;n=Math.max(0,Math.min(max,Math.trunc(n)));setForm(f=>({...f,[group]:{...f[group],[key]:n}}));}
 function setMove(index,value){setForm(f=>({...f,moves:f.moves.map((m,i)=>i===index?value:m)}));}
 function importPaste(){
   setError('');
   try{
     const parsed=parseShowdownPaste(pasteText);setDex(parsed.dex);
     const next=master.get(parsed.dex), opts=speciesAbilities(next), rule=genderRule(next.Pokemon);
     setForm(f=>({...f,nickname:parsed.nickname||'',level:parsed.level||f.level,shiny:!!parsed.shiny,nature:parsed.nature||'Hardy',ability:opts.includes(parsed.ability)?parsed.ability:(opts[0]||''),gender:rule.fixed?rule.options[0]:(f.gender||''),item:parsed.item||'',moves:[...parsed.moves,'','','',''].slice(0,4),ivs:parsed.ivs,evs:parsed.evs}));
     setPasteText('');
   }catch(err){setError(err?.message||'Could not import that set.');}
 }
 async function exportPokemon(){
   if(!editing||!initialRecord)return;
   try{await copyTextToClipboard(showdownTextForRecord({...initialRecord,...form,dex:Number(dex)}));setExportLabel('Copied!');setTimeout(()=>setExportLabel('Export'),1100);}
   catch(err){setExportLabel('Copy failed');setTimeout(()=>setExportLabel('Export'),1400);}
 }
 function submit(e){
   e.preventDefault();setError('');
   if(form.level<1||form.level>100){setError('Level must be between 1 and 100.');return;}
   if(!form.gender){setError('Choose a gender for this Pokémon.');return;}
   if(evTotal>510){setError(`EV total is ${evTotal}. Gen III allows a maximum of 510 total EVs.`);return;}
   const chosen=form.moves.filter(Boolean);if(new Set(chosen).size!==chosen.length){setError('A Pokémon cannot have the same move more than once.');return;}
   onSave({id:initialRecord?.id||makeId(),dex:Number(dex),nickname:form.nickname.trim(),level:Number(form.level),shiny:!!form.shiny,nature:form.nature,ability:form.ability,gender:form.gender,item:form.item,caughtGame:form.caughtGame||'',moves:chosen,ivs:{...form.ivs},evs:{...form.evs}});
 }
 return <main className={`pokemonPopupPage pokemonEditPopup pokemonEditCompact ${editing?'editingPokemon':'addingPokemon'}`}>
   <form className="pokemonEditCompactForm" onSubmit={submit}>
     <section className="pokemonEditHeader">
       <div className="pokemonEditTitle"><span>#{String(dex).padStart(3,'0')}</span><b>{form.nickname||p.Pokemon}</b>{form.nickname&&<small>{p.Pokemon}</small>}</div>
       <div className="pokemonEditHeaderActions">{editing&&<button type="button" className="pokemonEditExport" onClick={exportPokemon}>{exportLabel}</button>}<button type="submit" className="pokemonEditSave">Save</button>{editing&&onDelete&&<button type="button" className="pokemonEditDelete" onClick={()=>onDelete(initialRecord)}>Delete</button>}</div>
     </section>
     {!editing&&<section className="pokemonPasteImport"><textarea aria-label="PokéPaste or Showdown set" placeholder="Paste Showdown set" value={pasteText} onChange={e=>setPasteText(e.target.value)}/><button type="button" onClick={importPaste}>Import</button></section>}
     <section className="pokemonEditInfoGrid">
       <label className="editSpecies"><span>Species</span>{editing?<div className="lockedSpecies">#{String(dex).padStart(3,'0')} — {p.Pokemon}</div>:<select value={dex} onChange={e=>setDex(Number(e.target.value))}>{pokemon.map(x=><option value={x['#']} key={x['#']}>#{String(x['#']).padStart(3,'0')} — {x.Pokemon}</option>)}</select>}</label>
       <label><span>Nickname</span><input value={form.nickname} maxLength={20} onChange={e=>setField('nickname',e.target.value)} placeholder={p.Pokemon}/></label>
       <label className="editShiny"><span>Shiny</span><button type="button" className={form.shiny?'editShinyButton active':'editShinyButton'} onClick={()=>setField('shiny',!form.shiny)}>★ {form.shiny?'Yes':'No'}</button></label>
       <label><span>Level</span><input type="number" min="1" max="100" value={form.level} onChange={e=>setField('level',Math.max(1,Math.min(100,Number(e.target.value)||1)))}/></label>
       <label><span>Gender</span><select value={form.gender} disabled={genderForSpecies.fixed} onChange={e=>setField('gender',e.target.value)}>{!genderForSpecies.fixed&&<option value="">Select gender</option>}{genderForSpecies.options.map(g=><option value={g} key={g}>{g==='Male'?'♂ Male':g==='Female'?'♀ Female':'— Genderless'}</option>)}</select></label>
       <label><span>Caught Game</span><select value={form.caughtGame||''} onChange={e=>setField('caughtGame',e.target.value)}><option value="">Not set</option>{CAUGHT_GAMES.map(g=><option key={g}>{g}</option>)}</select></label>
       <label><span>Nature</span><select value={form.nature} onChange={e=>setField('nature',e.target.value)}>{natureNames.map(n=><option key={n}>{n}</option>)}</select></label>
       <label><span>Ability</span><select value={form.ability} onChange={e=>setField('ability',e.target.value)}>{abilitiesForSpecies.map(a=><option key={a}>{a}</option>)}</select></label>
       <label><span>Item</span><select value={form.item} onChange={e=>setField('item',e.target.value)}><option value="">No item</option>{itemNames.map(i=><option key={i}>{i}</option>)}</select></label>
     </section>
     <section className="pokemonEditTrainingGrid">
       <div className="pokemonEditStatBlock"><div className="pokemonEditSectionHead"><b>IVs</b><span>0–31</span></div><div className="pokemonEditSixStats">{statKeys.map(k=><label key={`iv-${k}`}><span>{k}</span><input className={Number(form.ivs[k])===31?'perfectEditIV':''} type="number" min="0" max="31" value={form.ivs[k]} onChange={e=>setStat('ivs',k,e.target.value,31)}/></label>)}</div></div>
       <div className="pokemonEditStatBlock"><div className="pokemonEditSectionHead"><b>EVs</b><span className={evTotal>510?'bad':''}>{evTotal} / 510</span></div><div className="pokemonEditSixStats">{statKeys.map(k=><label key={`ev-${k}`}><span>{k}</span><input type="number" min="0" max="255" value={form.evs[k]} onChange={e=>setStat('evs',k,e.target.value,255)}/></label>)}</div></div>
     </section>
     <section className="pokemonEditMovesBlock"><div className="pokemonEditSectionHead"><b>Moves</b><span>4 slots</span></div><div className="pokemonEditMoveGrid">{form.moves.map((move,i)=><label key={i}><span>Move {i+1}</span><select value={move} onChange={e=>setMove(i,e.target.value)}><option value="">— None —</option>{allMoveNames.map(m=><option key={m}>{m}</option>)}</select></label>)}</div></section>
     {error&&<div className="pokemonEditCompactError" role="alert">{error}</div>}
   </form>
 </main>;
}

function Detail({record,onEdit}){
 const p=master.get(record.dex),type2=validValue(p['Type 2'])?p['Type 2']:null;
 const stats=calcStats(record,p);
 const genderText=record.gender==='Male'?'♂ Male':record.gender==='Female'?'♀ Female':record.gender==='Genderless'?'— Genderless':'—';
 const displayName=record.nickname||p.Pokemon;
 return <main className="pokemonPopupPage pokemonDetailPopup">
   <section className="pokemonDetailTopbar">
     <button className="pokemonPopupEdit" onClick={()=>onEdit(record)}>Edit Pokémon</button>
   </section>

   <section className="pokemonDetailIdentity">
     <div className="pokemonDetailSpriteWrap">
       {record.shiny&&<span className="pokemonDetailShiny">★</span>}
       <img src={sprite(record.dex,record.shiny)} alt={p.Pokemon}/>
     </div>
     <div className="pokemonDetailNameBlock">
       <div className="pokemonDetailDex">#{String(record.dex).padStart(3,'0')}</div>
       <h1>{displayName}</h1>
       {record.nickname&&<small>{p.Pokemon}</small>}
       <div className="chips pokemonDetailTypes"><TypeChip type={p['Type 1']}/>{type2&&<TypeChip type={type2}/>}</div>
     </div>
   </section>

   <section className="pokemonDetailFacts">
     <div><span>Level</span><b>{record.level}</b></div>
     <div><span>Gender</span><b>{genderText}</b></div>
     <div><span>Nature</span><b className={fitTextClass(record.nature||'—')}>{record.nature||'—'}</b></div>
     <div><span>Ability</span><b className={`abilityValue ${fitTextClass(record.ability||'—')}`}>{record.ability||'—'}</b></div>
     <div><span>Item</span><b className={fitTextClass(record.item||'None')}>{record.item||'None'}</b></div>
     <div><span>Caught Game</span><b className={fitTextClass(record.caughtGame||'—')}>{record.caughtGame||'—'}</b></div>
   </section>

   <section className="pokemonDetailTraining">
     <div className="pokemonDetailSectionTitle"><b>Stats</b><span>Calculated · IV · EV</span></div>
     <div className="pokemonDetailStatGrid">
       {statKeys.map(k=>{const iv=record.ivs?.[k]??31;return <div className="pokemonDetailStat" key={k}>
         <span>{k}</span><strong>{stats[k]}</strong>
         <small>IV <b className={Number(iv)===31?'perfectIV':''}>{iv}</b></small>
         <small>EV <b>{record.evs?.[k]??0}</b></small>
       </div>})}
     </div>
   </section>

   <section className="pokemonDetailMoves">
     <div className="pokemonDetailSectionTitle"><b>Moves</b><span>{record.moves?.length||0} / 4</span></div>
     <div className="pokemonDetailMoveGrid">
       {[0,1,2,3].map(i=>{
         const name=record.moves?.[i];
         if(!name)return <div className="pokemonDetailMove emptyDetailMove" key={i}>—</div>;
         const m=moveByName.get(name)||{};
         const moveType=titleCaseType(m.Type);
         const color=TYPE_COLORS[moveType]||'#607086';
         return <div className={`pokemonDetailMove ${fitTextClass(name)}`} style={{'--detail-move-color':color}} key={`${name}-${i}`}><b>{name}</b><span>{moveType||'—'}</span></div>;
       })}
     </div>
   </section>
 </main>;
}

function validateImportedCollection(value){
 const records=Array.isArray(value)?value:value?.collection;
 if(!Array.isArray(records))throw new Error('This file does not contain a Pokémon collection.');
 const ids=new Set();
 return records.map((r,index)=>{
   if(!r||typeof r!=='object')throw new Error(`Pokémon ${index+1} is not a valid record.`);
   const dex=Number(r.dex);
   if(!Number.isInteger(dex)||!master.has(dex))throw new Error(`Pokémon ${index+1} has an invalid Pokédex number.`);
   const level=Number(r.level);
   if(!Number.isInteger(level)||level<1||level>100)throw new Error(`Pokémon ${index+1} has an invalid level.`);
   const id=String(r.id||makeId());
   if(ids.has(id))throw new Error('The backup contains duplicate Pokémon IDs.');
   ids.add(id);
   const ivs={...blankStats(31),...(r.ivs||{})};
   const evs={...blankStats(0),...(r.evs||{})};
   for(const k of statKeys){
     const iv=Number(ivs[k]),ev=Number(evs[k]);
     if(!Number.isInteger(iv)||iv<0||iv>31)throw new Error(`Pokémon ${index+1} has an invalid ${k} IV.`);
     if(!Number.isInteger(ev)||ev<0||ev>255)throw new Error(`Pokémon ${index+1} has an invalid ${k} EV.`);
   }
   if(statKeys.reduce((sum,k)=>sum+Number(evs[k]),0)>510)throw new Error(`Pokémon ${index+1} exceeds 510 total EVs.`);
   const moveList=Array.isArray(r.moves)?r.moves.filter(Boolean).slice(0,4):[];
   if(moveList.some(m=>!moveByName.has(m)))throw new Error(`Pokémon ${index+1} contains a move not found in this app's move list.`);
   return {...r,id,dex,level,shiny:!!r.shiny,moves:moveList,ivs,evs};
 });
}


function HomePage({onMyPokemon,onPokedex,onTeams,onFrontierSets,onTrainers,onBattle,onDatabase}){
 return <main className="homePage simplifiedHomePage">
   <section className="homeHero simplifiedHomeHero">
     <div className="homeBadge">GEN III · EMERALD</div>
     <h1>Battle Frontier</h1>
     <p>A focused Emerald companion for live battles, your trained Pokémon, and Frontier reference data.</p>
   </section>
   <section className="homeMenu simplifiedHomeMenu">
     <button className="homeTile battleTile primaryHomeTile" onClick={onBattle}>
       <div className="homeTileIcon battleTileIcon"><span>VS</span></div>
       <div className="homeTileCopy"><span className="eyebrow">LIVE WORKSPACE</span><h2>Battle</h2><p>Load your team, identify the opponent, and focus on the current matchup.</p><b>Open Battle →</b></div>
     </button>
     <button className="homeTile myPokemonTile primaryHomeTile" onClick={onMyPokemon}>
       <div className="homeTileIcon"><img src={sprite(376,false)} alt="Metagross"/></div>
       <div className="homeTileCopy"><span className="eyebrow">YOUR COLLECTION</span><h2>My Pokémon</h2><p>Manage the Pokémon you actually train and use in the Frontier.</p><b>Open My Pokémon →</b></div>
     </button>
     <button className="homeTile databaseTile primaryHomeTile" onClick={onDatabase}>
       <div className="homeTileIcon databaseTileIcon"><span>DB</span></div>
       <div className="homeTileCopy"><span className="eyebrow">REFERENCE</span><h2>Frontier Database</h2><p>One place for Frontier sets, trainers, and the Gen III Pokédex.</p><b>Open Database →</b></div>
     </button>
   </section>
   <section className="homeQuickLinks"><span>Quick links</span><div><button onClick={onTeams}>Teams</button><button onClick={onFrontierSets}>Sets</button><button onClick={onTrainers}>Trainers</button><button onClick={onPokedex}>Pokédex</button></div></section>
   <footer>v1.0 PWA prototype · Installable · Offline-ready · Built from v0.50 checkpoint</footer>
 </main>;
}

function DatabasePage({onPokedex,onFrontierSets,onTrainers,onTopStreaks,onExportBackup,onImportBackup,importRef,backupMessage}){
 return <main className="extrasPagePurple">
   <section className="extrasQuickGrid">
     <button className="extrasPurpleCard streaksCard" onClick={onTopStreaks}><span className="extrasCardKicker">YOUR RECORDS</span><b>Top Streaks</b><small>Tower + Dome · Singles + Doubles</small></button>
     <button className="extrasPurpleCard" onClick={onFrontierSets}><span className="extrasCardKicker">BATTLE DATA</span><b>Frontier Sets</b><small>Sets, items, moves, stats + speed tiers</small></button>
     <button className="extrasPurpleCard" onClick={onTrainers}><span className="extrasCardKicker">TRAINER DATA</span><b>Trainers</b><small>Trainer pools + IV information</small></button>
     <button className="extrasPurpleCard" onClick={onPokedex}><span className="extrasCardKicker">GEN I–III</span><b>Pokédex</b><small>Species, types, abilities + Emerald sprites</small></button>
   </section>
   <section className="extrasBackup extrasBackupPurple">
     <div><span className="eyebrow">BACKUP</span><b>My Pokémon + Teams + Streaks</b><small>Export or restore your saved app data.</small></div>
     <div className="extrasBackupActions"><button type="button" onClick={onExportBackup}>Export</button><button type="button" onClick={()=>importRef.current?.click()}>Import</button><input ref={importRef} className="hiddenFile" type="file" accept="application/json,.json" onChange={e=>onImportBackup(e.target.files?.[0])}/></div>
   </section>
   {backupMessage&&<div className="backupMessage extrasBackupMessage" role="status">✓ {backupMessage}</div>}
 </main>;
}

function TrophyCup({rank}){
 const colors=['#ffd34d','#d7e0e8','#d78a45'];
 const labels=['Gold','Silver','Bronze'];
 const color=colors[rank]||colors[2];
 return <span className="streakTrophy" title={`${labels[rank]||'Bronze'} trophy`} aria-label={`${labels[rank]||'Bronze'} trophy`}>
   <svg viewBox="0 0 24 24" aria-hidden="true"><path fill={color} d="M7 3h10v2h3v4c0 2.8-2 5-4.7 5.5A5.3 5.3 0 0 1 13 16.7V19h4v2H7v-2h4v-2.3a5.3 5.3 0 0 1-2.3-2.2C6 14 4 11.8 4 9V5h3V3Zm0 4H6v2c0 1.4.8 2.6 2 3.2A8.7 8.7 0 0 1 7 7Zm10 0a8.7 8.7 0 0 1-1 5.2c1.2-.6 2-1.8 2-3.2V7h-1Z"/></svg>
 </span>;
}

function TopStreaksPage({collection,topStreaks,setTopStreaks}){
 const [editing,setEditing]=useState(null);
 const collectionById=useMemo(()=>new Map(collection.map(x=>[String(x.id),x])),[collection]);
 function openEntry(category,index){
   const existing=topStreaks[category.key]?.[index]||null;
   setEditing(existing?{...existing,memberIds:[...(existing.memberIds||[])]}:{id:makeTeamId(),category:category.key,streak:0,level:50,memberIds:[]});
 }
 function saveEntry(){
   if(!editing)return;
   const cat=STREAK_CATEGORIES.find(x=>x.key===editing.category);if(!cat)return;
   const clean={...editing,streak:Math.max(0,Math.floor(Number(editing.streak)||0)),level:Number(editing.level)===100?100:50,memberIds:(editing.memberIds||[]).filter(id=>collectionById.has(String(id))).slice(0,cat.size)};
   if(clean.streak<=0){window.alert('Enter a streak of at least 1.');return;}
   setTopStreaks(prev=>{
     const next=normalizeTopStreaks(prev);
     const rows=[...(next[cat.key]||[]).filter(x=>x.id!==clean.id),clean].sort((a,b)=>b.streak-a.streak).slice(0,3);
     return {...next,[cat.key]:rows};
   });
   setEditing(null);
 }
 function clearEntry(){
   if(!editing)return;
   setTopStreaks(prev=>({...normalizeTopStreaks(prev),[editing.category]:(prev[editing.category]||[]).filter(x=>x.id!==editing.id)}));
   setEditing(null);
 }
 function toggleMember(id){
   if(!editing)return;
   const cat=STREAK_CATEGORIES.find(x=>x.key===editing.category);if(!cat)return;
   const sid=String(id);const current=editing.memberIds||[];
   if(current.includes(sid))setEditing({...editing,memberIds:current.filter(x=>x!==sid)});
   else if(current.length<cat.size)setEditing({...editing,memberIds:[...current,sid]});
 }
 if(editing){
   const cat=STREAK_CATEGORIES.find(x=>x.key===editing.category);
   return <main className="topStreaksPage streakEditorPage" style={{'--streak-accent':cat.color}}>
     <section className="streakEditorTop"><div><span>{cat.label}</span><b>Edit Streak</b></div><div><button className="streakClear" onClick={clearEntry}>Clear</button><button className="streakSave" onClick={saveEntry}>Save</button></div></section>
     <section className="streakEditorBasics">
       <label><span>Streak</span><input type="number" min="1" inputMode="numeric" value={editing.streak||''} onChange={e=>setEditing({...editing,streak:e.target.value})}/></label>
       <label><span>Level</span><select value={editing.level} onChange={e=>setEditing({...editing,level:Number(e.target.value)})}><option value="50">Lv. 50</option><option value="100">Lv. 100</option></select></label>
       <div className="streakTeamCount"><span>Team</span><b>{editing.memberIds.length}/{cat.size}</b></div>
     </section>
     <section className="streakPokemonPicker">
       <div className="streakPickerHead"><b>Select Pokémon</b><span>{cat.size} required</span></div>
       <div className="streakPickerScroll">{collection.map(x=>{const p=master.get(Number(x.dex));const chosen=editing.memberIds.includes(String(x.id));const full=!chosen&&editing.memberIds.length>=cat.size;return <button key={x.id} disabled={full} className={chosen?'chosen':''} onClick={()=>toggleMember(x.id)}><img src={sprite(x.dex,x.shiny)} alt=""/><span><b>{x.nickname||p?.Pokemon||'Pokémon'}</b><small>#{String(x.dex).padStart(3,'0')}</small></span><i>{chosen?'✓':'+'}</i></button>})}</div>
     </section>
   </main>;
 }
 return <main className="topStreaksPage">
   <section className="streakPageTop"><span>ALL-TIME BEST</span><b>Top Streaks</b><small>Tap any entry to edit it. Rankings reorder automatically.</small></section>
   <section className="streakCategoryList">
     {STREAK_CATEGORIES.map(cat=><section className="streakCategory" key={cat.key} style={{'--streak-accent':cat.color}}>
       <div className="streakCategoryHead"><b>{cat.label}</b><span>Top 3</span></div>
       <div className="streakRows">{[0,1,2].map(rank=>{const row=topStreaks[cat.key]?.[rank];const members=(row?.memberIds||[]).map(id=>collectionById.get(String(id))).filter(Boolean).slice(0,cat.size);return <button className={`streakRow ${row?'filled':'empty'}`} key={rank} onClick={()=>openEntry(cat,rank)}>
         <span className="streakRank">#{rank+1}</span>
         <span className="streakSprites">{Array.from({length:cat.size},(_,i)=>{const mon=members[i];return mon?<img key={i} src={sprite(mon.dex,mon.shiny)} alt=""/>:<i key={i}>+</i>})}</span>
         <span className="streakLevel">{row?`Lv. ${row.level}`:'—'}</span>
         <span className="streakNumber">{row?.streak||'—'}</span>
         <TrophyCup rank={rank}/>
       </button>})}</div>
     </section>)}
   </section>
 </main>;
}

function PokedexDetail({p,onBack}){
 const dex=Number(p['#']);
 const abilities=speciesAbilities(p);
 const total=statKeys.reduce((sum,k)=>sum+(Number(p[k])||0),0);
 const maxBase=Math.max(...statKeys.map(k=>Number(p[k])||0),1);
 return <main className="dexPage dexPurplePage dexPurpleDetailPage">
   <div className="dexPurpleDetailTop"><button className="dexPurpleBack" onClick={onBack}>← Back to Pokédex</button></div>
   <section className="dexPurpleIdentityPanel">
     <div className="dexPurpleSprites">
       <div><span>Normal</span><img src={sprite(dex,false)} alt={p.Pokemon}/></div>
       <div><span>Shiny</span><img src={sprite(dex,true)} alt={`Shiny ${p.Pokemon}`}/></div>
     </div>
     <div className="dexPurpleIdentity">
       <small>#{String(dex).padStart(3,'0')} · {genLabel(p.Gen)}</small>
       <h1>{p.Pokemon}</h1>
       <div className="chips dexPurpleTypes"><TypeChip type={p['Type 1']}/>{validValue(p['Type 2'])&&<TypeChip type={p['Type 2']}/>}</div>
       <div className="dexPurpleFacts"><div><span>Ability{abilities.length>1?'ies':''}</span><b>{abilities.join(' / ')||'—'}</b></div><div><span>BST</span><b>{total}</b></div></div>
     </div>
   </section>
   <section className="dexPurpleStatsPanel">
     <div className="dexPurpleStatsTitle"><b>Base Stats</b><span>Total {total}</span></div>
     <div className="dexPurpleBaseStats">{statKeys.map(k=>{const v=Number(p[k])||0;return <div className="dexPurpleBaseRow" key={k}><span>{statNames[k]}</span><b>{v}</b><div className="statTrack"><div className="statFill" style={{width:`${Math.max(4,(v/maxBase)*100)}%`}}></div></div></div>})}</div>
   </section>
 </main>;
}

function Pokedex({onHome}){
 const [search,setSearch]=useState('');
 const [type,setType]=useState('');
 const [gen,setGen]=useState('');
 const [sort,setSort]=useState('dex-asc');
 const [selectedDex,setSelectedDex]=useState(null);
 const types=[...new Set(pokemon.flatMap(p=>[p['Type 1'],p['Type 2']]).filter(validValue))].sort();
 const list=useMemo(()=>{
   const q=search.trim().toLowerCase();
   const filtered=pokemon.filter(p=>(!q||p.Pokemon.toLowerCase().startsWith(q))&&(!type||p['Type 1']===type||p['Type 2']===type)&&(!gen||String(p.Gen)===gen));
   return [...filtered].sort((a,b)=>sort==='name-asc'?a.Pokemon.localeCompare(b.Pokemon):sort==='name-desc'?b.Pokemon.localeCompare(a.Pokemon):Number(a['#'])-Number(b['#']));
 },[search,type,gen,sort]);
 if(selectedDex)return <PokedexDetail p={master.get(Number(selectedDex))} onBack={()=>setSelectedDex(null)}/>;
 return <main className="dexPage dexPurplePage">
   <section className="dexPurpleControls">
     <input autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} placeholder="Search Pokémon" value={search} onChange={e=>setSearch(e.target.value)}/>
     <select value={type} onChange={e=>setType(e.target.value)}><option value="">Type</option>{types.map(t=><option key={t}>{t}</option>)}</select>
     <select value={gen} onChange={e=>setGen(e.target.value)}><option value="">Gen</option><option value="1">Gen I</option><option value="2">Gen II</option><option value="3">Gen III</option></select>
     <select value={sort} onChange={e=>setSort(e.target.value)}><option value="dex-asc">Dex #</option><option value="name-asc">A–Z</option><option value="name-desc">Z–A</option></select>
   </section>
   <section className="dexPurpleBox">
     <div className="grid dexGrid dexPurpleGrid">{list.map(p=>{const dex=Number(p['#']);const tc=TYPE_COLORS[titleCaseType(p['Type 1'])]||'#607086';return <button className="slot dexSlot dexPurpleSlot" style={{'--type-color':tc}} key={dex} onClick={()=>setSelectedDex(dex)}><div className="spritewrap"><img src={sprite(dex,false)} alt={p.Pokemon}/></div><strong>{p.Pokemon}</strong><small>#{String(dex).padStart(3,'0')}</small><div className="miniTypes"><span style={{background:TYPE_COLORS[p['Type 1']]}}></span>{validValue(p['Type 2'])&&<span style={{background:TYPE_COLORS[p['Type 2']]}}></span>}</div></button>})}</div>
   </section>
 </main>;
}



function parseFrontierStats(value){
 return String(value||'').split('/').map(v=>Number(String(v).trim())||0).slice(0,6);
}
function parseFrontierEVs(value){
 const nums=String(value||'').split('/').map(v=>Number(String(v).trim())||0).slice(0,6);
 return Object.fromEntries(statKeys.map((k,i)=>[k,nums[i]||0]));
}
function calcFrontierSetStats(record,level,ivValue){
 if(!record)return [0,0,0,0,0,0];
 const p=master.get(Number(record.dex));
 if(!p)return parseFrontierStats(level===50?record.stats50:record.stats100);
 const fixed=Number(record.fixedIVs);
 const requested=Number(ivValue);
 const iv=Number.isFinite(fixed)&&record.brain?fixed:(Number.isFinite(requested)?requested:31);
 const result=calcStats({
   level:Number(level)||50,
   nature:record.nature||'Hardy',
   ivs:Object.fromEntries(statKeys.map(k=>[k,iv])),
   evs:parseFrontierEVs(record.evs)
 },p);
 return statKeys.map(k=>result[k]);
}
function battleIVForSet(record,facility,trainer){
 if(record?.brain&&Number.isFinite(Number(record.fixedIVs)))return Number(record.fixedIVs);
 if(facility==='Dome')return 3;
 if(trainer&&!trainer.brain&&Number.isFinite(Number(trainer.ivs)))return Number(trainer.ivs);
 return 31;
}
function battleSearchLabel(record){
 return `${record?.species||''} ${record?.instance||''}`.trim().toLowerCase();
}
function FrontierSetsPage(){
 const [search,setSearch]=useState('');
 const [type,setType]=useState('');
 const [level,setLevel]=useState(50);
 const [brainsOnly,setBrainsOnly]=useState(false);
 const [speedSort,setSpeedSort]=useState(false);
 const types=[...new Set(frontierSets.flatMap(x=>[cleanBattleType(x.type1),cleanBattleType(x.type2)]).filter(Boolean))].sort();
 const list=useMemo(()=>{
   const q=search.trim().toLowerCase();
   const filtered=frontierSets.filter(x=>(!q||battleSearchLabel(x).startsWith(q))&&(!type||cleanBattleType(x.type1)===type||cleanBattleType(x.type2)===type)&&(!brainsOnly||x.brain));
   return [...filtered].sort((a,b)=>{
     if(speedSort){
       const aSpe=calcFrontierSetStats(a,level,a.brain?a.fixedIVs:31)[5]||0;
       const bSpe=calcFrontierSetStats(b,level,b.brain?b.fixedIVs:31)[5]||0;
       if(bSpe!==aSpe)return bSpe-aSpe;
     }
     if(a.brain!==b.brain)return a.brain?1:-1;
     if(!a.brain&&!b.brain)return Number(a.entry)-Number(b.entry);
     return Number(a.sourceOrder)-Number(b.sourceOrder);
   });
 },[search,type,brainsOnly,speedSort,level]);
 const standardCount=frontierSets.filter(x=>!x.brain).length;
 const brainCount=frontierSets.filter(x=>x.brain).length;
 return <main className="frontierPage frontierPurplePage">
   <section className="frontierPurpleStats">
     <div><b>{standardCount}</b><span>Standard Pokémon</span></div>
     <div><b>{brainCount}</b><span>Brain Pokémon</span></div>
   </section>

   <section className="frontierPurpleControls">
     <input className="frontierSearch" autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} placeholder="Search Pokémon" value={search} onChange={e=>setSearch(e.target.value)}/>
     <select value={type} onChange={e=>setType(e.target.value)}><option value="">Type</option>{types.map(t=><option key={t}>{t}</option>)}</select>
     <div className="frontierPurpleLevel"><button className={level===50?'active':''} onClick={()=>setLevel(50)}>Lv. 50</button><button className={level===100?'active':''} onClick={()=>setLevel(100)}>Lv. 100</button></div>
     <button className={brainsOnly?'active':''} onClick={()=>setBrainsOnly(v=>!v)}>★ Brains</button>
     <button className={speedSort?'active':''} onClick={()=>setSpeedSort(v=>!v)}>⚡ Speed</button>
   </section>

   <section className={`frontierPurpleList ${speedSort?'speedMode':''}`}>
     {list.length?list.map((x,index)=>{
       const stats=calcFrontierSetStats(x,level,x.brain?x.fixedIVs:31);
       const rowKey=`${x.brain?'brain':x.entry}-${x.brainLabel||''}-${x.species}-${index}`;
       if(speedSort){
         return <article className={`frontierPurpleSpeedRow ${x.brain?'brainSet':''}`} key={rowKey}>
           <img src={sprite(x.dex,false)} alt=""/>
           <b>{x.species} {x.instance}</b>
           <span><small>SPE</small><strong>{stats[5]??'—'}</strong></span>
         </article>;
       }
       return <article className={`opponentSetRow frontierBattleSearchRow ${x.brain?'brainSet':''}`} key={rowKey}>
         <img src={sprite(x.dex,false)} alt=""/>
         <div className="oppSetIdentity frontierBattleIdentity">
           <b>{x.species} {x.instance}<span className="oppInlineItem frontierBattleItem"> @{x.item||'No item'}</span></b>
         </div>
         <div className="oppSetMoves frontierBattleMoves">{[0,1,2,3].map(i=>{const m=x.moves?.[i]||'—';const mt=moveTypeFor(m);const c=TYPE_COLORS[mt]||'#7b8792';return <span key={`${x.entry}-${x.sourceOrder||''}-${i}`} className={fitTextClass(m)} style={{'--moveTypeColor':c}}>{m}</span>})}</div>
         <div className="oppSetStats frontierBattleStats">{statKeys.map((k,i)=><span key={k}>{k} <b>{stats[i]??'—'}</b></span>)}</div>
       </article>
     }):<div className="battleHint">No Frontier sets match that search.</div>}
   </section>
   <footer>v1.27 Frontier Sets · narrow-width fit</footer>
 </main>;
}

function TrainerDatabasePage(){
 const [search,setSearch]=useState('');
 const [classFilter,setClassFilter]=useState('');
 const [expandedId,setExpandedId]=useState(null);
 const classes=[...new Set(trainers.map(t=>t.class).filter(Boolean))].sort();
 const list=useMemo(()=>{
   const q=search.trim().toLowerCase();
   return trainers.filter(t=>(!q||String(t.name||'').toLowerCase().startsWith(q))&&(!classFilter||t.class===classFilter));
 },[search,classFilter]);
 function toggleTrainer(id){setExpandedId(cur=>String(cur)===String(id)?null:id)}
 return <main className="trainersPage trainersPurplePage">
   <section className="trainerPurpleControls">
     <input className="frontierSearch" autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} placeholder="Search trainer" value={search} onChange={e=>setSearch(e.target.value)}/>
     <select value={classFilter} onChange={e=>setClassFilter(e.target.value)}><option value="">Class</option>{classes.map(c=><option key={c} value={c}>{c}</option>)}</select>
   </section>
   <section className="trainerAccordionList">
     {list.length?list.map(t=>{
       const open=String(expandedId)===String(t.id);
       return <article className={`trainerAccordion ${open?'open':''}`} key={t.id}>
         <button className="trainerAccordionHead" onClick={()=>toggleTrainer(t.id)}>
           <span className="trainerAccordionName"><b>{t.name}</b><small>{t.class}</small></span>
           <span className="trainerAccordionMeta"><span>IVs <b>{t.ivs??'—'}</b></span><span>Sets <b>{t.count??t.possiblePokemon?.length??0}</b></span></span>
           <span className="trainerChevron">{open?'−':'+'}</span>
         </button>
         {open&&<div className="trainerAccordionPokemon">
           {(t.possiblePokemon||[]).map((x,i)=>{
             const t1=cleanBattleType(x.type1),t2=cleanBattleType(x.type2);
             return <div className="trainerMiniPokemon" key={`${t.id}-${x.entry||x.sourceOrder}-${i}`}>
               <img src={sprite(x.dex,false)} alt=""/>
               <b>{x.species} {x.instance}</b>
               <div className="trainerMiniTypes">{t1&&<span style={{background:TYPE_COLORS[t1]||'#607086'}}>{t1}</span>}{t2&&<span style={{background:TYPE_COLORS[t2]||'#607086'}}>{t2}</span>}</div>
             </div>
           })}
         </div>}
       </article>
     }):<div className="battleHint">No trainers match those filters.</div>}
   </section>
   <footer>v1.29 Trainers · compact accordion</footer>
 </main>;
}

function TeamEditor({collection,teams,initialTeam=null,onCancel,onSave}){
 const [facility,setFacility]=useState(initialTeam?.facility||'Tower');
 const [mode,setMode]=useState(initialTeam?.mode||'Singles');
 const [name,setName]=useState(initialTeam?.name||'');
 const [notes,setNotes]=useState(initialTeam?.notes||'');
 const [memberIds,setMemberIds]=useState(initialTeam?.memberIds||[]);
 const limit=mode==='Singles'?3:4;
 useEffect(()=>{setMemberIds(ids=>ids.slice(0,limit));},[mode,limit]);
 function toggleMember(id){setMemberIds(ids=>ids.includes(id)?ids.filter(x=>x!==id):(ids.length<limit?[...ids,id]:ids));}
 function nextAutoName(){
   const base=`${facility} ${mode}`;
   const used=new Set(teams.filter(t=>t.id!==initialTeam?.id).map(t=>String(t.name||'').trim().toLowerCase()));
   let n=1;
   while(used.has(`${base} ${n}`.toLowerCase()))n++;
   return `${base} ${n}`;
 }
 function submit(e){
   e.preventDefault();
   if(memberIds.length!==limit){window.alert(`${facility} ${mode} teams need exactly ${limit} Pokémon.`);return;}
   onSave({id:initialTeam?.id||makeTeamId(),name:name.trim()||nextAutoName(),facility,mode,notes:notes.trim(),memberIds});
 }
 return <main className="teamPage"><div className="detailNav"><button className="back" onClick={onCancel}>← Back to Teams</button></div><form className="teamEditor" onSubmit={submit}>
   <section className="teamEditorHeader"><div><span className="eyebrow">TEAM BUILDER</span><h1>{initialTeam?'Edit Team':'Create Team'}</h1><p>Build a Battle Tower or Battle Dome team from the actual Pokémon in your PC.</p></div><div className="teamLimit"><b>{memberIds.length} / {limit}</b><span>selected</span></div></section>
   <section className="formSection"><h2>Team setup</h2><div className="formGrid two"><label><span>Team name <em>optional</em></span><input value={name} maxLength={40} onChange={e=>setName(e.target.value)} placeholder={`Auto: ${facility} ${mode} 1`}/></label><label><span>Facility</span><select value={facility} onChange={e=>setFacility(e.target.value)}><option>Tower</option><option>Dome</option></select></label><label><span>Format</span><select value={mode} onChange={e=>setMode(e.target.value)}><option>Singles</option><option>Doubles</option></select></label><label><span>Team size</span><div className="readOnlyField">{limit} Pokémon</div></label><label className="wide"><span>Notes <em>optional</em></span><textarea rows="3" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Lead plan, matchup notes, facility strategy…"/></label></div></section>
   <section className="formSection"><div className="sectionTitle"><h2>Select Pokémon</h2><small>{facility} {mode} · {limit} Pokémon</small></div>{collection.length?<div className="teamPicker">{collection.map(x=>{const p=master.get(Number(x.dex));const selected=memberIds.includes(x.id);return <button type="button" className={`teamPick ${selected?'selected':''}`} key={x.id} onClick={()=>toggleMember(x.id)} disabled={!selected&&memberIds.length>=limit}><img src={sprite(x.dex,x.shiny)} alt={p.Pokemon}/><div><b>{x.nickname||p.Pokemon}</b><small>Lv. {x.level}{x.item?` · ${x.item}`:''}</small></div><span>{selected?'✓':'+'}</span></button>})}</div>:<div className="empty">Add Pokémon to My Pokémon before building a team.</div>}</section>
   <div className="formActions"><button type="button" className="secondary" onClick={onCancel}>Cancel</button><button className="primary" type="submit">{initialTeam?'Save Changes':'Save Team'}</button></div>
 </form></main>;
}

function TeamDetail({team,collection,onBack,onEdit,onDelete,onOpenPokemon}){
 const members=team.memberIds.map(id=>collection.find(x=>x.id===id)).filter(Boolean);
 const facility=team.facility||'Tower';
 return <main className="teamPage"><div className="detailNav"><button className="back" onClick={onBack}>← Back to Teams</button><div className="detailActions"><button className="secondary" onClick={()=>onEdit(team)}>✎ Edit</button><button className="danger" onClick={()=>onDelete(team)}>Delete</button></div></div>
   <section className="teamDetailHero"><div><div className="teamBadges"><span className={`facilityBadge ${facility.toLowerCase()}`}>{facility}</span><span className={`teamModeBadge ${team.mode.toLowerCase()}`}>{team.mode}</span></div><h1>{team.name}</h1><p>{team.notes||'No notes added for this team.'}</p></div><div className="teamLimit"><b>{members.length}</b><span>{team.mode==='Singles'?'of 3':'of 4'} Pokémon</span></div></section>
   <section className="teamMemberGrid">{members.map((x,index)=>{const p=master.get(Number(x.dex)),stats=calcStats(x,p);return <button className="teamMemberCard" key={x.id} onClick={()=>onOpenPokemon(x,team)}><div className="memberNumber">{index+1}</div><img src={sprite(x.dex,x.shiny)} alt={p.Pokemon}/><div className="memberIdentity"><span>#{String(x.dex).padStart(3,'0')} · Lv. {x.level}</span><h2>{x.nickname||p.Pokemon}</h2>{x.nickname&&<small>{p.Pokemon}</small>}<div className="chips"><TypeChip type={p['Type 1']}/>{validValue(p['Type 2'])&&<TypeChip type={p['Type 2']}/>}</div></div><div className="memberBuild"><div><span>Item</span><b>{x.item||'None'}</b></div><div><span>Ability</span><b>{x.ability||'—'}</b></div><div><span>Nature</span><b>{x.nature||'—'}</b></div><div><span>Moves</span><b>{x.moves?.length?x.moves.join(' · '):'None selected'}</b></div></div><div className="memberStats">{statKeys.map(k=><span key={k}><small>{k}</small><b>{stats[k]}</b></span>)}</div></button>})}</section>
   {members.length<team.memberIds.length&&<div className="backupMessage">Some Pokémon formerly on this team are no longer in your PC. Edit the team to replace them.</div>}
 </main>;
}

function TeamsPage({collection,teams,setTeams,initialTeamId=null,onHome,onOpenPokemon}){
 const groupDefs=[
  {facility:'Tower',mode:'Singles',label:'Tower Singles',className:'towerSingles',color:'#38d9ff'},
  {facility:'Tower',mode:'Doubles',label:'Tower Doubles',className:'towerDoubles',color:'#8b7cff'},
  {facility:'Dome',mode:'Singles',label:'Dome Singles',className:'domeSingles',color:'#72ff24'},
  {facility:'Dome',mode:'Doubles',label:'Dome Doubles',className:'domeDoubles',color:'#d96cff'}
 ];
 const groupIndex=(team)=>Math.max(0,groupDefs.findIndex(g=>g.facility===(team.facility||'Tower')&&g.mode===team.mode));
 const [editor,setEditor]=useState(()=>{
   const initial=teams.find(t=>t.id===initialTeamId);
   return initial?{...initial,memberIds:[...(initial.memberIds||[])]}:null;
 });
 const [error,setError]=useState('');
 const sortedTeams=useMemo(()=>[...teams].sort((a,b)=>groupIndex(a)-groupIndex(b)||String(a.name||'').localeCompare(String(b.name||''))),[teams]);
 const counts=groupDefs.map(g=>teams.filter(t=>(t.facility||'Tower')===g.facility&&t.mode===g.mode).length);
 function beginAdd(){setError('');setEditor({id:null,name:'',facility:'Tower',mode:'Singles',memberIds:[],notes:''});}
 function beginEdit(team){setError('');setEditor({...team,facility:team.facility||'Tower',memberIds:[...(team.memberIds||[])]});}
 function setEditorField(key,value){setEditor(e=>({...e,[key]:value}));}
 function setType(facility,mode){setEditor(e=>({...e,facility,mode,memberIds:(e.memberIds||[]).slice(0,mode==='Singles'?3:4)}));}
 function toggleMember(id){setEditor(e=>{const ids=[...(e.memberIds||[])];const i=ids.indexOf(id);if(i>=0)ids.splice(i,1);else if(ids.length<(e.mode==='Singles'?3:4))ids.push(id);return {...e,memberIds:ids};});}
 function nextAutoTeamName(facility,mode){
   const def=groupDefs.find(g=>g.facility===facility&&g.mode===mode)||groupDefs[0];
   const base=def.label;
   let max=0;
   const pattern=new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\s+(\\d+)$`,'i');
   teams.forEach(t=>{const m=String(t.name||'').trim().match(pattern);if(m)max=Math.max(max,Number(m[1])||0);});
   return `${base} ${max+1}`;
 }
 function saveEditor(){
   setError('');const typedName=String(editor.name||'').trim();const name=typedName||nextAutoTeamName(editor.facility,editor.mode);const limit=editor.mode==='Singles'?3:4;
   if(teams.some(t=>t.id!==editor.id&&String(t.name||'').trim().toLowerCase()===name.toLowerCase())){setError('That team name is already in use.');return;}
   if((editor.memberIds||[]).length!==limit){setError(`${editor.facility} ${editor.mode} needs exactly ${limit} Pokémon.`);return;}
   const saved=normalizeTeam({...editor,id:editor.id||makeTeamId(),name,notes:''});
   setTeams(ts=>editor.id?ts.map(t=>t.id===editor.id?saved:t):[...ts,saved]);setEditor(null);
 }
 function deleteEditor(){if(!editor?.id)return;if(window.confirm(`Delete ${editor.name}?`)){setTeams(ts=>ts.filter(t=>t.id!==editor.id));setEditor(null);}}
 if(editor){
   const limit=editor.mode==='Singles'?3:4;
   const currentDef=groupDefs.find(g=>g.facility===editor.facility&&g.mode===editor.mode)||groupDefs[0];
   return <main className="teamsPopupPage teamEditPopup" style={{'--team-kind-color':currentDef.color}}>
     <section className="teamPopupTop teamEditorTop">
       <div className="teamEditorIdentity"><span>{editor.id?'EDIT TEAM':'ADD TEAM'}</span><b>{editor.name||currentDef.label}</b></div>
       <div className="teamEditorActions"><button className="teamSaveButton" type="button" onClick={saveEditor}>Save</button>{editor.id&&<button className="teamDeleteButton" type="button" onClick={deleteEditor}>Delete</button>}</div>
     </section>
     <section className="teamEditorBasics">
       <label><span>Team Name</span><input value={editor.name||''} maxLength={30} onChange={e=>setEditorField('name',e.target.value)} placeholder={`Auto: ${currentDef.label} ${counts[groupDefs.indexOf(currentDef)]+1}`}/></label>
       {editor.id?<div className="teamLockedType"><span>Team Type</span><b>{currentDef.label}</b></div>:<div className="teamTypeChooser"><span>Team Type</span><div>{groupDefs.map(g=><button type="button" key={g.label} className={g.facility===editor.facility&&g.mode===editor.mode?'selected':''} style={{'--choice-color':g.color}} onClick={()=>setType(g.facility,g.mode)}>{g.label}</button>)}</div></div>}
       <div className="teamSelectionCount"><b>{(editor.memberIds||[]).length}/{limit}</b><span>Pokémon</span></div>
     </section>
     <section className="teamPokemonPickerWrap">
       <div className="teamPickerHeading"><b>Select Pokémon</b><span>{currentDef.label} · {limit} required</span></div>
       <div className="teamPopupPokemonPicker">{collection.map(x=>{const p=master.get(Number(x.dex));const selected=(editor.memberIds||[]).includes(x.id);return <button type="button" className={selected?'teamPopupPick selected':'teamPopupPick'} key={x.id} onClick={()=>toggleMember(x.id)} disabled={!selected&&(editor.memberIds||[]).length>=limit}><img src={sprite(x.dex,x.shiny)} alt=""/><span><b>{x.nickname||p.Pokemon}</b><small>#{String(x.dex).padStart(3,'0')} · Lv. {x.level}</small></span><i>{selected?'✓':'+'}</i></button>})}</div>
     </section>
     {error&&<div className="teamPopupError">{error}</div>}
   </main>;
 }
 return <main className="teamsPopupPage teamListPopup">
   <section className="teamPopupTop"><button className="teamAddButton" onClick={beginAdd}>+ Add Team</button><div className="teamPopupTitle"><b>Teams</b><span>{teams.length} total</span></div></section>
   <section className="teamTypeStats">{groupDefs.map((g,i)=><div key={g.label} style={{'--team-kind-color':g.color}}><b>{counts[i]}</b><span>{g.label}</span></div>)}</section>
   <section className="teamListScroll">{sortedTeams.length?sortedTeams.map(team=>{const def=groupDefs[groupIndex(team)];const members=(team.memberIds||[]).map(id=>collection.find(x=>x.id===id)).filter(Boolean);const limit=team.mode==='Singles'?3:4;return <button className={`teamListRow ${def.className}`} style={{'--team-kind-color':def.color}} key={team.id} onClick={()=>beginEdit(team)}><div className="teamListText"><b>{team.name}</b><span>{def.label}</span></div><div className="teamListSprites">{Array.from({length:limit},(_,i)=>members[i]?<img key={members[i].id} src={sprite(members[i].dex,members[i].shiny)} alt=""/>:<i key={i}>+</i>)}</div></button>}):<div className="teamListEmpty"><b>No teams yet</b><span>Use Add Team to create your first roster.</span></div>}</section>
 </main>;
}

const GEN3_TYPES=['Normal','Fire','Water','Electric','Grass','Ice','Fighting','Poison','Ground','Flying','Psychic','Bug','Rock','Ghost','Dragon','Dark','Steel'];
const GEN3_TYPE_EFFECT={
 Normal:{Rock:.5,Ghost:0,Steel:.5},
 Fire:{Fire:.5,Water:.5,Grass:2,Ice:2,Bug:2,Rock:.5,Dragon:.5,Steel:2},
 Water:{Fire:2,Water:.5,Grass:.5,Ground:2,Rock:2,Dragon:.5},
 Electric:{Water:2,Electric:.5,Grass:.5,Ground:0,Flying:2,Dragon:.5},
 Grass:{Fire:.5,Water:2,Grass:.5,Poison:.5,Ground:2,Flying:.5,Bug:.5,Rock:2,Dragon:.5,Steel:.5},
 Ice:{Fire:.5,Water:.5,Grass:2,Ice:.5,Ground:2,Flying:2,Dragon:2,Steel:.5},
 Fighting:{Normal:2,Ice:2,Poison:.5,Flying:.5,Psychic:.5,Bug:.5,Rock:2,Ghost:0,Dark:2,Steel:2},
 Poison:{Grass:2,Poison:.5,Ground:.5,Rock:.5,Ghost:.5,Steel:0},
 Ground:{Fire:2,Electric:2,Grass:.5,Poison:2,Flying:0,Bug:.5,Rock:2,Steel:2},
 Flying:{Electric:.5,Grass:2,Fighting:2,Bug:2,Rock:.5,Steel:.5},
 Psychic:{Fighting:2,Poison:2,Psychic:.5,Dark:0,Steel:.5},
 Bug:{Fire:.5,Grass:2,Fighting:.5,Poison:.5,Flying:.5,Psychic:2,Ghost:.5,Dark:2,Steel:.5},
 Rock:{Fire:2,Ice:2,Fighting:.5,Ground:.5,Flying:2,Bug:2,Steel:.5},
 Ghost:{Normal:0,Psychic:2,Ghost:2,Dark:.5,Steel:.5},
 Dragon:{Dragon:2,Steel:.5},
 Dark:{Fighting:.5,Psychic:2,Ghost:2,Dark:.5,Steel:.5},
 Steel:{Fire:.5,Water:.5,Electric:.5,Ice:2,Rock:2,Steel:.5}
};
function defensiveTypeMatchups(type1,type2){
 const defs=[titleCaseType(type1),titleCaseType(type2)].filter(Boolean);
 const groups={4:[],2:[],0.5:[],0.25:[],0:[]};
 GEN3_TYPES.forEach(atk=>{
   let mult=1;
   defs.forEach(def=>{mult*=GEN3_TYPE_EFFECT[atk]?.[def]??1});
   if(groups[mult])groups[mult].push(atk);
 });
 return groups;
}
function TypeMatchupStrip({type1,type2}){
 const g=defensiveTypeMatchups(type1,type2);
 const rows=[[4,'4×'],[2,'2×'],[0.5,'½×'],[0.25,'¼×'],[0,'0×']].filter(([m])=>g[m].length);
 return <div className="typeMatchupStrip">
   <div className="typeMatchupTitle">Type Matchups</div>
   {rows.map(([m,label])=><div className={`typeMatchupRow mult${String(m).replace('.','_')}`} key={label}><b>{label}</b><div>{g[m].map(t=><TypeChip key={t} type={t}/>)}</div></div>)}
 </div>;
}

function BattleSlot({record,setRecord,opponent=false,index,teamLocked=false,onPick,onClear,extraClass=''}){
 const filled=!!record;
 const dex=filled?Number(record.dex):null;
 const p=filled?master.get(dex):null;
 const type1=opponent?record?.type1:p?.['Type 1'];
 const type2=opponent?record?.type2:p?.['Type 2'];
 const name=opponent?(record?`${record.species} ${record.instance||''}`.trim():''):(record?(record.nickname||p?.Pokemon||'Pokémon'):'');
 return <div className={`battleSlot ${filled?'filled':''} ${opponent?'opponent':''} ${extraClass}`}>
   {!teamLocked&&filled&&<button className="slotClear" type="button" onClick={e=>{e.stopPropagation();onClear?.()}} aria-label={`Clear ${name}`}>×</button>}
   <button className="battleSlotMain" type="button" onClick={onPick}>
     {!filled?<span className="battlePlus">＋</span>:<>
       <img src={sprite(dex,opponent?false:!!record.shiny)} alt={name}/><b>{name}</b>
       <div className="battleSlotTypes">{type1&&<TypeChip type={titleCaseType(type1)}/>} {type2&&<TypeChip type={titleCaseType(type2)}/>}</div>
     </>}
   </button>
 </div>;
}

function formatEVs(evs){
 if(!evs)return '—';
 if(typeof evs==='string'){
   const raw=evs.trim();
   const numeric=raw.split(/[\/|,]/).map(v=>Number(String(v).trim()));
   if(numeric.length>=6&&numeric.slice(0,6).every(Number.isFinite)){
     const parts=statKeys
       .map((k,i)=>[k,numeric[i]])
       .filter(([,v])=>v>0)
       .map(([k,v])=>`${k} ${v}`);
     return parts.length?parts.join(' · '):'0 EVs';
   }
   const labeled=[];
   const rx=/(HP|Atk|Def|SpA|SpD|Spe)\s*[:=]?\s*(\d+)|(\d+)\s*(HP|Atk|Def|SpA|SpD|Spe)/gi;
   let m;
   while((m=rx.exec(raw))){
     const stat=m[1]||m[4];
     const value=Number(m[2]||m[3]||0);
     if(value>0)labeled.push(`${stat} ${value}`);
   }
   if(labeled.length)return labeled.join(' · ');
   return raw.replace(/\s*[,/|]\s*/g,' · ').replace(/\s{2,}/g,' ').trim();
 }
 const parts=statKeys
   .filter(k=>Number(evs?.[k]||0)>0)
   .map(k=>`${k} ${Number(evs[k])}`);
 return parts.length?parts.join(' · '):'0 EVs';
}


function repeatedClueVisual(name,repeatedMap,offset=0){
 const key=String(name||'').trim().toLowerCase()
 if(!key||!repeatedMap||!(repeatedMap.get(key)>1))return {className:'',style:undefined}
 const keys=[...repeatedMap.entries()]
  .filter(([,count])=>count>1)
  .map(([value])=>value)
  .sort()
 const i=keys.indexOf(key)
 const hue=((i<0?0:i)*47+offset)%360
 return {className:'duplicateClue',style:{'--dupHue':String(hue)}}
}

function fitTextClass(value){
 const n=String(value||'').length;
 return n>=18?'fitText fitTextXL':n>=14?'fitText fitTextL':n>=11?'fitText fitTextM':'fitText';
}

function moveTypeFor(name){
 const move=moveByName.get(name);
 return titleCaseType(move?.Type||move?.type||'');
}
function readableTypeText(type){
 return ['Dark','Ghost','Dragon','Psychic','Poison','Fighting','Rock','Ground','Steel'].includes(type)?'#fff':'#172431';
}

function BattleMatchCard({record,opponent=false,level=50,label,isFaster=false}){
 if(!record)return <div className="matchEmpty"><b>{label}</b></div>;
 const dex=Number(record.dex),p=master.get(dex);
 const ownLevel=Number(record.level)||50;
 const displayLevel=opponent?level:ownLevel;
 const name=opponent?`${record.species} ${record.instance||''}`.trim():(record.nickname||p?.Pokemon||'Pokémon');
 const type1=cleanBattleType(opponent?record.type1:p?.['Type 1']),type2=cleanBattleType(opponent?record.type2:p?.['Type 2']);
 const stats=opponent?calcFrontierSetStats(record,level,record.effectiveIV):calcStats({...record,level:ownLevel},p);
 return <div className={`matchPokemonCard ${opponent?'opponent':''}`}>
   <span className="matchSideLabel">{label}</span>
   <img className="matchSprite" src={sprite(dex,opponent?false:!!record.shiny)} alt={name}/>
   <h2>{name}</h2>
   {!opponent&&record.nickname&&<small className="matchSpecies">{p?.Pokemon}</small>}
   <div className={`chips matchTypes ${type2?'dualType':'singleType'}`}>{type1&&<TypeChip type={type1}/>} {type2&&<TypeChip type={type2}/>}</div>
   <div className="matchFacts">
     {opponent?<>
       <div><span>Level</span><b>{displayLevel}</b></div>
       <div><span>Nature</span><b className={fitTextClass(record.nature||'—')}>{record.nature||'—'}</b></div>
       <div><span>Ability</span><b className={`abilityValue ${fitTextClass(record.ability||'—')}`}>{record.ability||'—'}</b></div>
       <div><span>Item</span><b className={fitTextClass(record.item||'None')}>{record.item||'None'}</b></div>
       <div className="wide"><span>EVs</span><b className={`evValue ${fitTextClass(formatEVs(record.evs))}`}>{formatEVs(record.evs)}</b></div>
     </>:<>
       <div><span>Level</span><b>{displayLevel}</b></div>
       <div><span>Nature</span><b className={fitTextClass(record.nature||'—')}>{record.nature||'—'}</b></div>
       <div><span>Ability</span><b className={`abilityValue ${fitTextClass(record.ability||'—')}`}>{record.ability||'—'}</b></div>
       <div><span>Item</span><b className={fitTextClass(record.item||'None')}>{record.item||'None'}</b></div>
       <div className="wide"><span>EVs</span><b className={`evValue ${fitTextClass(formatEVs(record.evs))}`}>{formatEVs(record.evs)}</b></div>
     </>}
   </div>
   <div className="matchStats">{statKeys.map((k,i)=><span key={k} className={`matchStat ${k==='Spe'&&isFaster?'fasterSpeed':''}`}><small>{k}</small><b>{stats[i]??stats[k]??'—'}</b></span>)}</div>
   <div className="matchMoves">{(opponent?record.moves:record.moves||[]).map((m,i)=>{const moveType=moveTypeFor(m);const typeColor=TYPE_COLORS[moveType]||'#7b8792';return <div className="typedMatchMove" key={`${m}-${i}`} style={{'--moveTypeColor':typeColor}}><b className={fitTextClass(m)}>{m}</b></div>})}{!((opponent?record.moves:record.moves||[]).length)&&<div className="noMoves">No moves selected</div>}</div>
   <TypeMatchupStrip type1={type1} type2={type2}/>
 </div>;
}

let battleSessionState = null;

function BattlePage({collection,teams,onHome}){
 const savedBattle=battleSessionState||{};
 const [level,setLevel]=useState(savedBattle.level??50);
 const [facility,setFacility]=useState(savedBattle.facility??'Tower');
 const [mode,setMode]=useState(savedBattle.mode??'Singles');
 const [streak,setStreak]=useState(savedBattle.streak??'0');
 const [teamId,setTeamId]=useState(savedBattle.teamId??'');
 const [manualIds,setManualIds]=useState(savedBattle.manualIds??[]);
 const [myPickIndex,setMyPickIndex]=useState(savedBattle.myPickIndex??null);
 const [mySearch,setMySearch]=useState(savedBattle.mySearch??'');
 const [oppSlots,setOppSlots]=useState(savedBattle.oppSlots??[]);
 const [trainerSearch,setTrainerSearch]=useState(savedBattle.trainerSearch??'');
 const [trainerId,setTrainerId]=useState(savedBattle.trainerId??'');
 const [oppSearch,setOppSearch]=useState(savedBattle.oppSearch??'');
 const [opponentTargetSlot,setOpponentTargetSlot]=useState(savedBattle.opponentTargetSlot??null);
 const [myMatch,setMyMatch]=useState(savedBattle.myMatch??null);
 const [oppMatch,setOppMatch]=useState(savedBattle.oppMatch??null);
 const [hiddenOpponentKeys,setHiddenOpponentKeys]=useState([]);
 const oppSearchRef=useRef(null);
 const slotCount=mode==='Singles'?3:4;
 const availableTeams=teams.filter(t=>(t.facility||'Tower')===facility&&t.mode===mode);
 const selectedTeam=availableTeams.find(t=>t.id===teamId)||null;
 const teamRecords=selectedTeam?selectedTeam.memberIds.map(id=>collection.find(x=>x.id===id)).filter(Boolean):[];
 const mySlots=selectedTeam?Array.from({length:slotCount},(_,i)=>teamRecords[i]||null):Array.from({length:slotCount},(_,i)=>collection.find(x=>x.id===manualIds[i])||null);
 const facilityModeReady=useRef(false);
 useEffect(()=>{
   if(!facilityModeReady.current){facilityModeReady.current=true;return;}
   setTeamId('');setManualIds([]);setMyPickIndex(null);setMyMatch(null);setOppSlots([]);setOppMatch(null);setOpponentTargetSlot(null);
 },[facility,mode]);
 useEffect(()=>{if(teamId&&!availableTeams.some(t=>t.id===teamId))setTeamId('')},[teamId,facility,mode,teams]);
 useEffect(()=>{
   battleSessionState={level,facility,mode,streak,teamId,manualIds,myPickIndex,mySearch,oppSlots,trainerSearch,trainerId,oppSearch,opponentTargetSlot,myMatch,oppMatch};
 },[level,facility,mode,streak,teamId,manualIds,myPickIndex,mySearch,oppSlots,trainerSearch,trainerId,oppSearch,opponentTargetSlot,myMatch,oppMatch]);
 useEffect(()=>{
   if(opponentTargetSlot===null)return;
   const id=requestAnimationFrame(()=>oppSearchRef.current?.focus());
   return ()=>cancelAnimationFrame(id);
 },[opponentTargetSlot]);
 const battleTrainers=useMemo(()=>trainers.filter(t=>!t.brain||(facility==='Tower'&&t.brainBase==='Anabel')||(facility==='Dome'&&t.brainBase==='Tucker')),[facility]);
 const trainerList=useMemo(()=>{const q=trainerSearch.trim().toLowerCase();if(!q)return [];return battleTrainers.filter(t=>String(t.name||'').toLowerCase().startsWith(q)).slice(0,12)},[trainerSearch,battleTrainers]);
 const selectedTrainer=battleTrainers.find(t=>String(t.id)===String(trainerId))||null;
 function chooseTrainer(t){setTrainerId(String(t.id));setTrainerSearch(String(t.name||''));setOppSearch('');setOppSlots([]);setOppMatch(null);setOpponentTargetSlot(null)}
 function handleTrainerKeyDown(e){
   if(e.key!=='Enter')return;
   e.preventDefault();
   const q=trainerSearch.trim().toLowerCase();
   const exact=battleTrainers.filter(t=>String(t.name||'').toLowerCase()===q);
   if(exact.length===1)chooseTrainer(exact[0]);
   else if(exact.length===0&&trainerList.length===1)chooseTrainer(trainerList[0]);
 }
 const opponentSets=useMemo(()=>{
   const q=oppSearch.trim().toLowerCase();
   const base=selectedTrainer
     ? selectedTrainer.possiblePokemon.map(tp=>tp.brain
         ? frontierSets.find(fs=>fs.brain&&Number(fs.sourceOrder)===Number(tp.sourceOrder))
         : frontierSets.find(fs=>!fs.brain&&Number(fs.entry)===Number(tp.entry))).filter(Boolean)
     : frontierSets.filter(fs=>!fs.brain||(facility==='Tower'&&fs.brainBase==='Anabel')||(facility==='Dome'&&fs.brainBase==='Tucker'));
   return base.filter(fs=>!q||battleSearchLabel(fs).startsWith(q));
 },[selectedTrainer,oppSearch,facility]);
 const opponentSetKey=fs=>fs.brain?`brain-${fs.sourceOrder}`:`set-${fs.entry}`;
 const visibleOpponentSets=useMemo(()=>opponentSets.filter(fs=>!hiddenOpponentKeys.includes(opponentSetKey(fs))),[opponentSets,hiddenOpponentKeys]);
 const repeatedOpponentClues=useMemo(()=>{
   const moveCounts=new Map(),itemCounts=new Map();
   visibleOpponentSets.forEach(fs=>{
     (fs.moves||[]).filter(Boolean).forEach(m=>{const key=String(m).trim().toLowerCase();moveCounts.set(key,(moveCounts.get(key)||0)+1)});
     if(fs.item){const key=String(fs.item).trim().toLowerCase();itemCounts.set(key,(itemCounts.get(key)||0)+1)}
   });
   return {moves:moveCounts,items:itemCounts};
 },[visibleOpponentSets]);
 const manualChoices=useMemo(()=>{
   const q=mySearch.trim().toLowerCase();
   return [...collection]
     .filter(x=>{
       const p=master.get(Number(x.dex));
       if(!p)return false;
       const species=String(p.Pokemon||'').toLowerCase();
       const nickname=String(x.nickname||'').toLowerCase();
       return !q||species.startsWith(q)||nickname.startsWith(q);
     })
     .sort((a,b)=>Number(a.dex)-Number(b.dex)||String(a.nickname||'').localeCompare(String(b.nickname||'')));
 },[collection,mySearch]);
 function setManualSlot(index,id){setManualIds(arr=>{const next=Array.from({length:slotCount},(_,i)=>arr[i]||'');next[index]=id;return next});setMyPickIndex(null);setMySearch('')}
 function clearManualSlot(index){setManualIds(arr=>{const next=[...arr];next[index]='';return next});if(myMatch?.id===mySlots[index]?.id)setMyMatch(null)}
 function addOpponent(fs){
  const prepared={...fs,effectiveIV:battleIVForSet(fs,facility,selectedTrainer)};
  setOppSlots(arr=>{
   const next=Array.from({length:slotCount},(_,i)=>arr[i]||null);
   const idx=opponentTargetSlot!=null?opponentTargetSlot:next.findIndex(x=>!x);
   if(idx>=0&&idx<slotCount)next[idx]=prepared;
   return next
  });
  setOppMatch(prepared);
  setOppSearch('');
  setHiddenOpponentKeys([]);
  setOpponentTargetSlot(null)
 }
 function clearOpponent(index){setOppSlots(arr=>{const next=Array.from({length:slotCount},(_,i)=>arr[i]||null);next[index]=null;return next});if(oppMatch===oppSlots[index])setOppMatch(null);if(opponentTargetSlot===index)setOpponentTargetSlot(null)}
 function adjustStreak(delta){const n=Math.max(0,(parseInt(streak,10)||0)+delta);setStreak(String(n))}
 return <main className="battlePage">
   <section className="battleToolbar">
     <div className="battleToggleGroup"><span>Level</span><div className="levelToggle"><button className={level===50?'active':''} onClick={()=>setLevel(50)}>Lv. 50</button><button className={level===100?'active':''} onClick={()=>setLevel(100)}>Lv. 100</button></div></div>
     <div className="battleToggleGroup"><span>Facility</span><div className="levelToggle"><button className={facility==='Tower'?'active':''} onClick={()=>setFacility('Tower')}>Tower</button><button className={facility==='Dome'?'active':''} onClick={()=>setFacility('Dome')}>Dome</button></div></div>
     <div className="battleToggleGroup"><span>Format</span><div className="levelToggle"><button className={mode==='Singles'?'active':''} onClick={()=>setMode('Singles')}>Singles</button><button className={mode==='Doubles'?'active':''} onClick={()=>setMode('Doubles')}>Doubles</button></div></div>
     <div className="streakControl"><span>Current streak</span><div><button onClick={()=>adjustStreak(-1)}>−</button><input type="number" min="0" value={streak} onChange={e=>setStreak(e.target.value)}/><button onClick={()=>adjustStreak(1)}>＋</button></div></div>
   </section>

   <section className="battleDesktopLayout">
     <div className="battleSelectionColumn">
       
       <section className="battleSelectionGrid compactBattleBuild">
         <div className="teamStripCard">
           <div className="teamStripSide">
             <div className="dockSideControl dockTeamControl">
               <select aria-label="Saved team" value={teamId} onChange={e=>{setTeamId(e.target.value);setMyMatch(null)}}>
                 <option value="">Team Select</option>{availableTeams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
               </select>
             </div>
             <div className="teamStripTitle"><span className="eyebrow">YOUR TEAM</span></div>
             <div className={`battleSlots compactSpriteSlots slots${slotCount}`}>{Array.from({length:slotCount},(_,i)=><BattleSlot key={i} record={mySlots[i]} teamLocked={!!selectedTeam} onPick={()=>{if(mySlots[i])setMyMatch(mySlots[i]);else if(!selectedTeam)setMyPickIndex(i)}} onClear={()=>clearManualSlot(i)}/>)}</div>
           </div>
           <div className="teamStripDivider"></div>
           <div className="teamStripSide">
             <div className="dockSideControl compactTrainerControl">
               <div className="compactTrainerInputWrap">
                 <input aria-label="Trainer search" autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} placeholder="Trainer search" value={trainerSearch} onKeyDown={handleTrainerKeyDown} onChange={e=>{setTrainerSearch(e.target.value);if(trainerId){setOppSlots([]);setOppMatch(null);setOppSearch('');setOpponentTargetSlot(null)}setTrainerId('')}}/>
                 {selectedTrainer&&<button className="compactTrainerReset" aria-label="Clear trainer" onClick={()=>{setTrainerId('');setTrainerSearch('');setOppSlots([]);setOppMatch(null);setOppSearch('');setOpponentTargetSlot(null)}}>×</button>}
               </div>
               {selectedTrainer&&<span className="compactTrainerClass">{selectedTrainer.class}</span>}
               {!!trainerSearch.trim()&&!selectedTrainer&&trainerList.length>0&&<div className="trainerSuggestions dockTrainerSuggestions">{trainerList.map(t=><button key={t.id} onClick={()=>chooseTrainer(t)}><b>{t.name}</b><span>{t.class} · {t.count} Pokémon</span></button>)}</div>}
             </div>
             <div className="teamStripTitle"><span className="eyebrow">OPPONENT</span></div>
             <div className={`battleSlots compactSpriteSlots slots${slotCount}`}>{Array.from({length:slotCount},(_,i)=><BattleSlot key={i} opponent record={oppSlots[i]||null} extraClass={opponentTargetSlot===i?'opponentSlotTarget':''} onPick={()=>{if(oppSlots[i])setOppMatch(oppSlots[i]);else{setOpponentTargetSlot(i);setOppSearch('');setHiddenOpponentKeys([])}}} onClear={()=>clearOpponent(i)}/>)}</div>
           </div>
         </div>

         {!selectedTeam&&myPickIndex!==null&&<div className="slotPokemonPicker manualPokemonPicker">
           <div className="slotPickerHeader"><b>Add Your Pokémon {myPickIndex+1}</b><button onClick={()=>{setMyPickIndex(null);setMySearch('')}}>×</button></div>
           <label><span>Pokémon search</span><input autoFocus autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} placeholder="Search Pokémon name" value={mySearch} onChange={e=>setMySearch(e.target.value)}/></label>
           <div className="opponentResultsHeader manualResultsHeader"><b>My Pokémon</b><span>{manualChoices.length} result{manualChoices.length===1?'':'s'}</span></div>
           <div className="opponentSetList limitedOpponentList manualPokemonList">{manualChoices.map(x=>{
             const p=master.get(Number(x.dex));
             const stats=calcStats(x,p);
             return <div className="opponentSetRow manualPokemonRow" key={x.id} role="button" tabIndex="0" onClick={()=>setManualSlot(myPickIndex,x.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setManualSlot(myPickIndex,x.id)}}}>
               <img src={sprite(x.dex,x.shiny)} alt=""/>
               <div className="oppSetIdentity"><b>{x.nickname||p.Pokemon}<span className="oppInlineItem manualInlineItem"> @{x.item||'No item'}</span></b>{x.nickname&&<small className="manualSpeciesName">{p.Pokemon}</small>}</div>
               <div className="oppSetMoves manualOwnedMoves">{[0,1,2,3].map(i=>{const m=x.moves?.[i]||'—';const moveType=moveTypeFor(m);const typeColor=TYPE_COLORS[moveType]||'#7b8792';return <span key={`${x.id}-${i}`} className={`manualTypedMove ${fitTextClass(m)}`} style={{'--moveTypeColor':typeColor}}>{m}</span>})}</div>
               <div className="oppSetStats">{statKeys.map(k=><span key={k}>{k} <b>{stats[k]}</b></span>)}</div>
             </div>
           })}{!manualChoices.length&&<div className="battleHint">No Pokémon match that search.</div>}</div>
         </div>}

         {opponentTargetSlot!==null&&<div className="slotPokemonPicker">
           <div className="slotPickerHeader"><b>Add Opponent {opponentTargetSlot+1}</b><button onClick={()=>{setOpponentTargetSlot(null);setOppSearch('');setHiddenOpponentKeys([])}}>×</button></div>
           <label><span>Pokémon search</span><input ref={oppSearchRef} autoFocus autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} placeholder="Search Pokémon name" value={oppSearch} onChange={e=>setOppSearch(e.target.value)}/></label>
           {(selectedTrainer||oppSearch.trim())&&<>
             <div className="opponentResultsHeader"><b>{selectedTrainer?`${selectedTrainer.name} · ${selectedTrainer.class}`:`${oppSearch.trim()} sets`}</b><span>{visibleOpponentSets.length} result{visibleOpponentSets.length===1?'':'s'}</span></div>
             <div className="opponentSetList limitedOpponentList">{visibleOpponentSets.map(fs=>{const effectiveIV=battleIVForSet(fs,facility,selectedTrainer);const stats=calcFrontierSetStats(fs,level,effectiveIV);const itemVisual=repeatedClueVisual(fs.item,repeatedOpponentClues.items,23);const rowKey=opponentSetKey(fs);return <div className="opponentSetRow" key={rowKey} role="button" tabIndex="0" onClick={()=>addOpponent(fs)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();addOpponent(fs)}}}><button className="tempHideOpponent" type="button" aria-label={`Temporarily hide ${fs.species} ${fs.instance}`} onClick={e=>{e.stopPropagation();setHiddenOpponentKeys(arr=>[...arr,rowKey])}}>×</button><img src={sprite(fs.dex,false)} alt=""/><div className="oppSetIdentity"><b>{fs.species} {fs.instance}<span className={`oppInlineItem ${itemVisual.className} ${itemVisual.className?'duplicateItem':''}`} style={itemVisual.style}> @{fs.item||'No item'}</span></b></div><div className="oppSetMoves">{fs.moves.map(m=>{const visual=repeatedClueVisual(m,repeatedOpponentClues.moves,0);return <span className={`${fitTextClass(m)} ${visual.className} ${visual.className?'duplicateMove':''}`} style={visual.style} key={m}>{m}</span>})}</div><div className="oppSetStats">{statKeys.map((k,i)=><span key={k}>{k} <b>{stats[i]}</b></span>)}</div></div>})}{!visibleOpponentSets.length&&<div className="battleHint">No Pokémon match that search.</div>}</div>
           </>}
         </div>}
       </section>
     </div>
     <div className="battleMatchupColumn">
       
       <section className="battleMatchup"><div className="matchupTitle"><h2>Current Matchup</h2></div><div className="matchupCards">{(()=>{const myLevel=Number(myMatch?.level)||50;const myStats=myMatch?calcStats({...myMatch,level:myLevel},master.get(Number(myMatch.dex))):null;const oppStats=oppMatch?calcFrontierSetStats(oppMatch,level,oppMatch.effectiveIV):null;const mySpe=Number(myStats?.Spe??myStats?.[5]??0);const oppSpe=Number(oppStats?.[5]??0);return <><BattleMatchCard record={myMatch} level={level} label="YOUR POKÉMON" isFaster={!!myMatch&&!!oppMatch&&mySpe>oppSpe}/><div className="versusBadge">VS</div><BattleMatchCard record={oppMatch} opponent level={level} label="OPPONENT POKÉMON" isFaster={!!myMatch&&!!oppMatch&&oppSpe>mySpe}/></>})()}</div></section>
     </div>
   </section>
   <footer>v1.25 Frontier Sets · Offline-ready PWA</footer>
 </main>;
}

function AppNav({screen,onBattle,onPokemon,onExtras}){
 const active=screen==='battle'?'battle':(['pc','teams'].includes(screen)?'pokemon':'extras');
 return <nav className="appBottomNav" aria-label="Main navigation">
   <button className={active==='battle'?'active':''} onClick={onBattle}><b>Battle</b></button>
   <button className={active==='pokemon'?'active':''} onClick={onPokemon}><b>My Pokemon</b></button>
   <button className={active==='extras'?'active':''} onClick={onExtras}><b>Extras</b></button>
 </nav>;
}

function App(){
 const [screen,setScreen]=useState('battle');
 const [collection,setCollection]=useState(loadCollection);
 const [teams,setTeams]=useState(loadTeams);
 const [topStreaks,setTopStreaks]=useState(loadTopStreaks);
 const [selected,setSelected]=useState(null);
 const [creating,setCreating]=useState(false);
 const [editing,setEditing]=useState(null);
 const [search,setSearch]=useState('');
 const [type,setType]=useState('');
 const [gen,setGen]=useState('');
 const [shiny,setShiny]=useState(false);
 const [backupMessage,setBackupMessage]=useState('');
 const [openTeamId,setOpenTeamId]=useState(null);
 const [teamReturnId,setTeamReturnId]=useState(null);
 const [showTeamsModal,setShowTeamsModal]=useState(false);
 const importRef=useRef(null);

 function exportBackup(){
   const payload={format:BACKUP_FORMAT,version:BACKUP_VERSION,exportedAt:new Date().toISOString(),pokemonCount:collection.length,teamCount:teams.length,collection,teams,topStreaks};
   const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
   const url=URL.createObjectURL(blob);
   const a=document.createElement('a');
   const date=new Date().toISOString().slice(0,10);
   a.href=url;a.download=`battle-frontier-pokemon-backup-${date}.json`;
   document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
   setBackupMessage(`Backup exported: ${collection.length} Pokémon, ${teams.length} teams, and Top Streaks.`);
 }
 async function importBackup(file){
   if(!file)return;
   try{
     const text=await file.text();
     const parsed=JSON.parse(text);
     if(parsed?.format&&parsed.format!==BACKUP_FORMAT)throw new Error('This is not a Battle Frontier App backup file.');
     const imported=validateImportedCollection(parsed);
     const importedIds=new Set(imported.map(x=>x.id));
     const importedTeams=Array.isArray(parsed?.teams)?parsed.teams.filter(t=>t&&['Singles','Doubles'].includes(t.mode)&&Array.isArray(t.memberIds)).map(t=>normalizeTeam({...t,id:String(t.id||makeTeamId()),memberIds:t.memberIds.filter(id=>importedIds.has(id))})):[];
     const message=(collection.length||teams.length)
       ?`Import ${imported.length} Pokémon and ${importedTeams.length} teams? This will replace the collection and teams currently saved in this browser.`
       :`Import ${imported.length} Pokémon and ${importedTeams.length} teams into this browser?`;
     if(!window.confirm(message))return;
     const importedStreaks=normalizeTopStreaks(parsed?.topStreaks||{});
     setCollection(imported);setTeams(importedTeams);setTopStreaks(importedStreaks);setSelected(null);setEditing(null);setCreating(false);
     setBackupMessage(`Import complete: ${imported.length} Pokémon, ${importedTeams.length} teams, and Top Streaks restored.`);
   }catch(err){
     window.alert(`Could not import backup: ${err?.message||'Invalid backup file.'}`);
   }finally{
     if(importRef.current)importRef.current.value='';
   }
 }

 useEffect(()=>{try{localStorage.setItem(STORAGE_KEY,JSON.stringify(collection));}catch(e){console.warn('Could not save Pokémon',e)}},[collection]);
 useEffect(()=>{try{localStorage.setItem(TEAMS_STORAGE_KEY,JSON.stringify(teams));}catch(e){console.warn('Could not save teams',e)}},[teams]);
 useEffect(()=>{try{localStorage.setItem(STREAKS_STORAGE_KEY,JSON.stringify(topStreaks));}catch(e){console.warn('Could not save top streaks',e)}},[topStreaks]);

 // Installed iPhone PWAs can report a shorter dynamic viewport on first paint,
 // then expand it after the page reflows. Pin the app to the physical standalone
 // screen height so the bottom navigation starts at the bottom and never moves.
 useEffect(()=>{
   const standalone=window.matchMedia?.('(display-mode: standalone)')?.matches;
   const coarse=window.matchMedia?.('(pointer: coarse)')?.matches;
   if(!standalone||!coarse)return;
   const syncStandaloneHeight=()=>{
     const portrait=window.innerHeight>=window.innerWidth;
     const screenExtent=portrait?window.screen.height:window.screen.width;
     const fullHeight=Math.max(window.innerHeight||0,document.documentElement.clientHeight||0,screenExtent||0);
     if(fullHeight)document.documentElement.style.setProperty('--standalone-phone-height',`${Math.round(fullHeight)}px`);
   };
   syncStandaloneHeight();
   requestAnimationFrame(syncStandaloneHeight);
   const t1=setTimeout(syncStandaloneHeight,120);
   const t2=setTimeout(syncStandaloneHeight,600);
   window.addEventListener('resize',syncStandaloneHeight);
   window.addEventListener('orientationchange',syncStandaloneHeight);
   window.addEventListener('pageshow',syncStandaloneHeight);
   document.addEventListener('visibilitychange',syncStandaloneHeight);
   return ()=>{
     clearTimeout(t1);clearTimeout(t2);
     window.removeEventListener('resize',syncStandaloneHeight);
     window.removeEventListener('orientationchange',syncStandaloneHeight);
     window.removeEventListener('pageshow',syncStandaloneHeight);
     document.removeEventListener('visibilitychange',syncStandaloneHeight);
   };
 },[]);

 const types=[...new Set(pokemon.flatMap(p=>[p['Type 1'],p['Type 2']]).filter(validValue))].sort();
 const list=useMemo(()=>{
   const filtered=collection.filter(x=>{
     const p=master.get(Number(x.dex));if(!p)return false;const q=search.trim().toLowerCase();
     const display=(x.nickname||p.Pokemon).toLowerCase();
     return (!q||p.Pokemon.toLowerCase().startsWith(q))&&(!type||p['Type 1']===type||p['Type 2']===type)&&(!gen||String(p.Gen)===gen)&&(!shiny||x.shiny);
   });
   return [...filtered].sort((a,b)=>Number(a.dex)-Number(b.dex));
 },[collection,search,type,gen,shiny]);

 const withNav=(node)=><div className={`appShell ${screen==='battle'?'battleShell':''}`}>{node}<AppNav screen={screen} onBattle={()=>{setShowTeamsModal(false);setSelected(null);setCreating(false);setEditing(null);setScreen('battle')}} onPokemon={()=>{setShowTeamsModal(false);setSelected(null);setCreating(false);setEditing(null);setOpenTeamId(null);setScreen('pc')}} onExtras={()=>{setShowTeamsModal(false);setSelected(null);setCreating(false);setEditing(null);setScreen('database')}}/></div>;

 if(screen==='database')return withNav(<DatabasePage onPokedex={()=>setScreen('pokedex')} onFrontierSets={()=>setScreen('frontier-sets')} onTrainers={()=>setScreen('trainers')} onTopStreaks={()=>setScreen('top-streaks')} onExportBackup={exportBackup} onImportBackup={importBackup} importRef={importRef} backupMessage={backupMessage}/>);
 if(screen==='top-streaks')return withNav(<TopStreaksPage collection={collection} topStreaks={topStreaks} setTopStreaks={setTopStreaks}/>);
 if(screen==='pokedex')return withNav(<Pokedex onHome={()=>setScreen('database')}/>);
 if(screen==='frontier-sets')return withNav(<FrontierSetsPage onHome={()=>setScreen('database')}/>);
 if(screen==='trainers')return withNav(<TrainerDatabasePage onHome={()=>setScreen('database')}/>);
 if(screen==='battle')return withNav(<BattlePage collection={collection} teams={teams} onHome={()=>setScreen('battle')}/>);
 if(screen==='teams')return withNav(<TeamsPage collection={collection} teams={teams} setTeams={setTeams} initialTeamId={openTeamId} onHome={()=>{setOpenTeamId(null);setScreen('pc')}} onOpenPokemon={(record,team)=>{setTeamReturnId(team.id);setOpenTeamId(team.id);setSelected(record);setScreen('pc');}}/>);

 if(creating)return withNav(<PokemonCreator onCancel={()=>setCreating(false)} onSave={record=>{setCollection(c=>[...c,record]);setCreating(false);setSelected(record);}}/>);
 if(editing)return withNav(<PokemonCreator initialRecord={editing} onCancel={()=>setEditing(null)} onDelete={record=>{if(window.confirm(`Delete ${record.nickname||master.get(Number(record.dex))?.Pokemon||'this Pokémon'} from your PC? It will also be removed from any teams.`)){setCollection(c=>c.filter(x=>x.id!==record.id));setTeams(t=>t.map(team=>({...team,memberIds:team.memberIds.filter(id=>id!==record.id)})));setEditing(null);setSelected(null);setTeamReturnId(null);}}} onSave={record=>{setCollection(c=>c.map(x=>x.id===record.id?record:x));setEditing(null);setSelected(record);}}/>);
 if(selected)return withNav(<Detail record={selected} onEdit={record=>{setSelected(null);setEditing(record);}}/>);

 const genCounts=[1,2,3].map(g=>collection.filter(x=>Number(master.get(Number(x.dex))?.Gen)===g).length);
 const shinyCount=collection.filter(x=>x.shiny).length;

 return withNav(<main className="pcPage pcPageRedesign">
   <section className="pcCompactTop">
     <button className="pcTopButton teamsButton" onClick={()=>setShowTeamsModal(true)}>Teams</button>
     <button className="pcTopButton pcAddButton" onClick={()=>setCreating(true)}>+ Add Pokemon</button>
     <div className="pcCounts"><b>{collection.length}</b><span>Pokemon</span><i>•</i><b>{shinyCount}</b><span>Shinies</span></div>
   </section>
   <section className="pcCompactControls">
     <input autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} placeholder="Search Pokemon" value={search} onChange={e=>setSearch(e.target.value)}/>
     <select value={type} onChange={e=>setType(e.target.value)}><option value="">Type</option>{types.map(t=><option key={t}>{t}</option>)}</select>
     <select value={gen} onChange={e=>setGen(e.target.value)}><option value="">Gen</option><option value="1">Gen I</option><option value="2">Gen II</option><option value="3">Gen III</option></select>
     <button className={shiny?'active shinyToggle':'shinyToggle'} onClick={()=>setShiny(v=>!v)}>★</button>
   </section>
   <section className="box giantBox pcScrollBox">
     {list.length?<div className="grid pcPokemonGrid">{list.map(x=>{const p=master.get(Number(x.dex));const tc=TYPE_COLORS[titleCaseType(p['Type 1'])]||'#607086';return <button className="slot" style={{'--type-color':tc}} key={x.id} onClick={()=>setSelected(x)}><div className="slotAccent"></div><div className="spritewrap">{x.shiny&&<i>★</i>}<img src={sprite(x.dex,x.shiny)} alt={p.Pokemon}/></div><strong>{x.nickname||p.Pokemon}</strong><small>#{String(x.dex).padStart(3,'0')}{x.nickname?` · ${p.Pokemon}`:''}</small></button>})}</div>:<div className="empty">No Pokemon match these filters.</div>}
   </section>
   <section className="pcGenerationSummary">
     {genCounts.map((n,i)=><div key={i}><b>Gen {['I','II','III'][i]}</b><progress className={`genProgress gen${i+1}`} max={Math.max(collection.length,1)} value={n}/><strong>{n}</strong></div>)}
   </section>
   {showTeamsModal&&<div className="teamsModalBackdrop"><div className="teamsModal"><TeamsPage collection={collection} teams={teams} setTeams={setTeams} initialTeamId={null} onHome={()=>setShowTeamsModal(false)} onOpenPokemon={(record,team)=>{setShowTeamsModal(false);setTeamReturnId(team.id);setOpenTeamId(team.id);setSelected(record);}}/></div></div>}
 </main>);
}

function Root(){
  useEffect(()=>{
    document.documentElement.dataset.theme='dark';
    try{localStorage.removeItem('battle-frontier-theme-v1');}catch(e){}
  },[]);
  return <App/>;
}

createRoot(document.getElementById('root')).render(<Root/>);

// Keep local development simple: the service worker is enabled only in production builds
// (GitHub Pages or `npm run build` + `npm run preview`).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    const swUrl = `${import.meta.env.BASE_URL}sw.js`;
    navigator.serviceWorker.register(swUrl, { scope: import.meta.env.BASE_URL })
      .then(async () => {
        // Installed web apps can ask the browser to make local storage less likely to be evicted.
        try { await navigator.storage?.persist?.(); } catch (_) {}
      })
      .catch(error => console.warn('PWA service worker could not be registered', error));
  });
}


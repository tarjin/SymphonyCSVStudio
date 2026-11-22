/* P068-U4 — explicit, non-destructive Project ZIP choices.
 * Native <dialog> preserves keyboard focus and gives Save and Open
 * the same visible actions. The caller owns all validation and commits.
 */
function modal({root,title,description,choices,fileChoice=false}){
  if(!root?.createElement||!root?.body)throw Error('Project choice dialog cannot be displayed.');
  return new Promise(resolve=>{
    const dlg=root.createElement('dialog');
    dlg.className='scsv-project-choice-dialog';
    dlg.setAttribute('aria-label',title);
    const h=root.createElement('h2');h.textContent=title;
    const p=root.createElement('p');p.textContent=description;
    const actions=root.createElement('div');actions.className='scsv-project-choice-actions';
    let settled=false;
    const finish=value=>{
      if(settled)return;settled=true;
      if(dlg.open)dlg.close();dlg.remove();resolve(value);
    };
    for(const choice of choices){
      const button=root.createElement('button');button.type='button';button.textContent=choice.label;
      button.className=choice.primary?'primary-button':'soft-button';
      button.addEventListener('click',()=>finish({action:choice.id}));actions.append(button);
    }
    if(fileChoice){
      const input=root.createElement('input');input.type='file';
      input.accept='.zip,application/zip';input.hidden=true;
      input.setAttribute('aria-label','Choose companion recorded audio ZIP');
      const button=root.createElement('button');button.type='button';button.className='primary-button';
      button.textContent='Choose Audio ZIP…';button.addEventListener('click',()=>input.click());
      input.addEventListener('change',()=>{
        if(input.files?.length===1)finish({action:'load',file:input.files[0]});
      });
      actions.prepend(button);dlg.append(input);
    }
    dlg.prepend(h,p);dlg.append(actions);
    dlg.addEventListener('cancel',event=>{event.preventDefault();finish({action:'cancel'});});
    root.body.append(dlg);
    if(typeof dlg.showModal!=='function'){
      dlg.remove();resolve({action:'cancel'});return;
    }
    try{dlg.showModal();}catch{dlg.remove();resolve({action:'cancel'});}
  });
}
export function chooseProjectSaveMode({root=document,title,sourceCount,bytes}={}){
  const mib=(bytes/1048576).toFixed(1);
  return modal({root,title:'Save Project — '+title,
    description:`This composition includes ${sourceCount} recorded WAV track(s) (${mib} MiB of original audio). Save music only, or package the WAV recordings separately?`,
    choices:[{id:'music',label:'Save Music Only',primary:false},
      {id:'both',label:'Save Music + Recorded Audio',primary:true},
      {id:'cancel',label:'Cancel',primary:false}]});
}
export function chooseProjectAudioRestore({root=document,title,fileName,reason=''}={}){
  return modal({root,title:'Open Project — recorded audio',
    description:`${title} has a companion audio archive (${fileName}). ${reason ? reason+' ' : ''}Load it to restore WAV Tracks 7–8, skip the recordings, or cancel without replacing the current Project.`,
    choices:[{id:'skip',label:'Skip Audio',primary:false},
      {id:'cancel',label:'Cancel Opening',primary:false}],fileChoice:true});
}

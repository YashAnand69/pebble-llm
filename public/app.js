const form=document.querySelector('#question-form'),prompt=document.querySelector('#prompt'),button=document.querySelector('#generate'),answer=document.querySelector('#answer'),status=document.querySelector('#status'),timing=document.querySelector('#timing'),temperature=document.querySelector('#temperature');
temperature.addEventListener('input',()=>document.querySelector('#temp-value').value=Number(temperature.value).toFixed(1));
document.querySelectorAll('[data-prompt]').forEach(item=>item.addEventListener('click',()=>{prompt.value=item.dataset.prompt;prompt.focus();}));
form.addEventListener('submit',async event=>{
 event.preventDefault();button.disabled=true;status.textContent='Generating…';answer.textContent='Thinking one character at a time…';timing.textContent='';
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),60000);
 try {
  const response=await fetch('/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:prompt.value,temperature:Number(temperature.value)}),signal:controller.signal});
  const result=await response.json();if(!response.ok)throw new Error(result.error||'Generation failed.');
  answer.textContent=result.answer||'(The model ended its answer immediately.)';status.textContent='Complete';timing.textContent=`${(result.elapsedMs/1000).toFixed(2)} seconds · 2,000,000 parameters · seed 2026`;
 }catch(error){status.textContent='Try again';answer.textContent=error.name==='AbortError'?'This answer took too long. Please try a shorter question.':error.message;}finally{clearTimeout(timeout);button.disabled=false;}
});
fetch('/results/evaluation.json').then(response=>{if(!response.ok)throw new Error();return response.json();}).then(result=>{document.querySelector('#accuracy').textContent=`${result.exactMatches ?? result.exactMatchCount ?? 0} / 40`;}).catch(()=>{document.querySelector('#accuracy').textContent='See report';});

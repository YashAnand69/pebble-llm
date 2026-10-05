const form = document.querySelector('#question-form');
const prompt = document.querySelector('#prompt');
const button = document.querySelector('#generate');
const answer = document.querySelector('#answer');
const status = document.querySelector('#status');
const timing = document.querySelector('#timing');
const temperature = document.querySelector('#temperature');
const responsePanel = document.querySelector('.response');

temperature.addEventListener('input', () => {
  document.querySelector('#temp-value').value = Number(temperature.value).toFixed(1);
});
prompt.addEventListener('input', () => prompt.setCustomValidity(''));
document.querySelectorAll('[data-prompt]').forEach(item => {
  item.addEventListener('click', () => {
    prompt.value = item.dataset.prompt;
    prompt.setCustomValidity('');
    prompt.focus();
  });
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (button.disabled) return;
  const question = prompt.value.trim();
  if (!question || prompt.value.length > 160 || !/^[\x20-\x7e\n\t]+$/.test(prompt.value)) {
    prompt.setCustomValidity('Enter a question using 1–160 ASCII characters.');
    prompt.reportValidity();
    return;
  }
  button.disabled = true;
  responsePanel.setAttribute('aria-busy', 'true');
  status.textContent = 'Generating…';
  answer.textContent = 'Thinking one character at a time…';
  timing.textContent = '';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({prompt: question, temperature: Number(temperature.value)}),
      signal: controller.signal,
    });
    // Platform errors may be HTML or plain text rather than our API's JSON.
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(result?.error || (response.status === 504
        ? 'This answer took too long. Please try a shorter question.'
        : 'The model is temporarily unavailable. Please try again.'));
    }
    if (!result || typeof result.answer !== 'string' || !Number.isFinite(result.elapsedMs)) {
      throw new Error('The model returned an incomplete response. Please try again.');
    }
    answer.textContent = result.answer || '(The model ended its answer immediately.)';
    status.textContent = 'Complete';
    timing.textContent = `${(result.elapsedMs / 1000).toFixed(2)} seconds · 2,000,000 parameters · seed 2026`;
  } catch (error) {
    status.textContent = 'Try again';
    answer.textContent = error.name === 'AbortError'
      ? 'This answer took too long. Please try a shorter question.'
      : error instanceof TypeError
        ? 'Could not connect to the model. Check your connection and try again.'
        : error.message;
  } finally {
    clearTimeout(timeout);
    responsePanel.setAttribute('aria-busy', 'false');
    button.disabled = false;
  }
});

fetch('/results/evaluation.json')
  .then(response => {
    if (!response.ok) throw new Error('Report unavailable');
    return response.json();
  })
  .then(result => {
    if (!Number.isInteger(result.exactMatches) || !Number.isInteger(result.total)
      || result.total < 1 || result.exactMatches < 0 || result.exactMatches > result.total) {
      throw new Error('Invalid report');
    }
    document.querySelector('#accuracy').textContent = `${result.exactMatches} / ${result.total}`;
  })
  .catch(() => { document.querySelector('#accuracy').textContent = 'See report'; });

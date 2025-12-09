let user = null;
function openModal(type) {
  document.getElementById('modal').style.display = 'flex';
  document.getElementById('modal-title').textContent = type === 'login' ? 'Login' : 'Sign Up';
  document.getElementById('username-field').style.display = type === 'register' ? 'block' : 'none';
}
function closeModal() { document.getElementById('modal').style.display = 'none'; }

document.getElementById('auth-form').onsubmit = async e => {
  e.preventDefault();
  const email = e.target[0].value;
  const password = e.target[1].value;
  const username = e.target[2].value;
  const endpoint = document.getElementById('modal-title').textContent.includes('Login') ? '/api/login' : '/api/register';
  const body = { email, password };
  if (username) body.username = username;
  const res = await fetch(endpoint, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
  const data = await res.json();
  if (res.ok) { user = data.user; closeModal(); alert('Welcome ' + data.user.username); }
};

function watchMovie(id) {
  if (!user) return openModal('login');
  alert('Watch Together room created! Share this link: ' + location.href + '?room=' + id);
}

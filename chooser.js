/*
 * The chooser a DA Preview / Publish tab is sent to: one button per
 * environment; choosing one replaces this tab with the page on that branch.
 */
import { DA_TARGET, envUrl, getEnvs } from './envs.js';

const target = new URLSearchParams(window.location.search).get('url') || '';
const match = target.match(DA_TARGET);
const list = document.querySelector('.da-env-list');

function go(branch) {
  // replace: Back returns to DA's history, not to this chooser
  window.location.replace(envUrl(target, branch));
}

async function init() {
  if (!match) {
    document.querySelector('.da-env-error').hidden = false;
    return;
  }
  const [, repo, org, tld, path = '/'] = match;
  const page = document.querySelector('.da-env-page');
  page.textContent = `${tld === 'live' ? page.dataset.live : page.dataset.page} ${org}/${repo}${path}`;

  const envs = await getEnvs();
  envs.forEach(({ name, branch }, i) => {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    const key = document.createElement('span');
    key.className = 'da-env-key';
    key.setAttribute('aria-hidden', 'true');
    key.textContent = i + 1;
    const title = document.createElement('span');
    title.className = 'da-env-name';
    title.textContent = name;
    const host = document.createElement('span');
    host.className = 'da-env-host';
    host.textContent = `${branch}--${repo}--${org}.aem.${tld}`;
    button.append(key, title, host);
    button.addEventListener('click', () => go(branch));
    item.append(button);
    list.append(item);
  });
  list.querySelector('button')?.focus();

  document.addEventListener('keydown', (e) => {
    const env = envs[Number(e.key) - 1];
    if (env && !e.altKey && !e.ctrlKey && !e.metaKey) go(env.branch);
  });
}

init();

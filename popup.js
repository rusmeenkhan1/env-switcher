/* global chrome */
/*
 * Toolbar popup: on a page of a configured source site (or on an EDS page),
 * one button per environment opens the matching EDS page in a new tab.
 */
import {
  edsPage, edsUrl, getEnvs, getSites,
} from './envs.js';

const $ = (selector) => document.querySelector(selector);

function renderList(envs, page, tab) {
  const list = $('.da-env-list');
  const tld = () => document.querySelector('input[name="tld"]:checked').value;
  const open = (branch) => {
    chrome.tabs.create({
      url: edsUrl(page, branch, tld()), index: tab.index + 1, openerTabId: tab.id,
    });
    window.close();
  };
  const items = [];

  envs.forEach(({ name, branch }, i) => {
    const button = document.createElement('button');
    button.type = 'button';
    const key = document.createElement('span');
    key.className = 'da-env-key';
    key.setAttribute('aria-hidden', 'true');
    key.textContent = i + 1;
    const title = document.createElement('span');
    title.className = 'da-env-name';
    title.textContent = name;
    const current = document.createElement('span');
    current.className = 'da-env-current';
    current.textContent = list.dataset.current;
    title.append(current);
    const host = document.createElement('span');
    host.className = 'da-env-host';
    items.push({
      button, current, host, branch,
    });
    button.append(key, title, host);
    button.addEventListener('click', () => open(branch));
    const item = document.createElement('li');
    item.append(button);
    list.append(item);
  });

  // the environment (and .page / .live) of the open EDS page can't be chosen again
  const refresh = () => items.forEach(({
    button, current, host, branch,
  }) => {
    const here = page.branch === branch && page.tld === tld();
    button.disabled = here;
    current.hidden = !here;
    host.textContent = new URL(edsUrl(page, branch, tld())).host;
  });
  refresh();
  $('.da-env-tld').addEventListener('change', () => {
    refresh();
    chrome.storage.local.set({ tld: tld() });
  });

  document.addEventListener('keydown', (e) => {
    const item = items[Number(e.key) - 1];
    if (item && !item.button.disabled && !e.altKey && !e.ctrlKey && !e.metaKey) open(item.branch);
  });
  list.querySelector('button:not(:disabled)')?.focus();
}

async function init() {
  $('.da-env-settings').addEventListener('click', () => chrome.runtime.openOptionsPage());

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const [envs, sites, { tld: lastTld }] = await Promise.all([
    getEnvs(), getSites(), chrome.storage.local.get('tld'),
  ]);
  const page = tab ? edsPage(tab.url, sites) : null;
  if (!page) {
    $('.da-env-none').hidden = false;
    return;
  }

  // on an EDS page keep its .page / .live; elsewhere use the last choice
  const tld = page.tld || lastTld || 'page';
  document.querySelector(`input[name="tld"][value="${tld === 'live' ? 'live' : 'page'}"]`).checked = true;
  $('.da-env-page').textContent = `${page.org}/${page.repo}${page.path}`;
  $('.da-env-ready').hidden = false;
  renderList(envs, page, tab);
}

init();

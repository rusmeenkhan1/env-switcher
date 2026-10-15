/* global chrome */
import {
  DEFAULT_ENVS, formatEnvs, formatSites, getEnvs, getSites, parseEnvs, parseSites,
} from './envs.js';

const form = document.querySelector('form');
const envsText = document.querySelector('#da-env-text');
const sitesText = document.querySelector('#da-env-sites');
const status = document.querySelector('.da-env-status');

const say = (key, extra = '') => {
  status.textContent = `${status.dataset[key]} ${extra}`.trim();
};

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const { envs, invalid: badEnvs } = parseEnvs(envsText.value);
  const { sites, invalid: badSites } = parseSites(sitesText.value);
  const invalid = [...badEnvs, ...badSites];
  if (invalid.length) { say('invalid', invalid.join(' | ')); return; }
  if (!envs.length) { say('empty'); return; }
  await chrome.storage.sync.set({ envs, sites });
  envsText.value = formatEnvs(envs);
  sitesText.value = formatSites(sites);
  say('saved');
});

document.querySelector('.da-env-reset').addEventListener('click', async () => {
  await chrome.storage.sync.remove('envs');
  envsText.value = formatEnvs(DEFAULT_ENVS);
  say('reset');
});

Promise.all([getEnvs(), getSites()]).then(([envs, sites]) => {
  envsText.value = formatEnvs(envs);
  sitesText.value = formatSites(sites);
});

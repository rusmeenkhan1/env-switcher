/* global chrome */
/*
 * Shared by the service worker, the chooser and the options page.
 * An environment = a display name + the git branch whose code renders the page
 * on https://{branch}--{repo}--{org}.aem.page|live.
 */
export const DEFAULT_ENVS = [
  { name: 'DEV', branch: 'develop' },
  { name: 'UAT', branch: 'uat' },
  { name: 'PRD', branch: 'main' },
];

export const BRANCH = /^[a-z0-9-]+$/;

// after Preview / Publish, DA opens the page on main--{repo}--{org}.aem.page|live
export const DA_TARGET = /^https:\/\/main--([a-z0-9-]+)--([a-z0-9-]+)\.aem\.(page|live)(\/[^?#]*)?/i;

// only tabs DA itself opens are intercepted
export const DA_ORIGINS = ['https://da.live'];

/**
 * @returns {Promise<{name: string, branch: string}[]>} the saved environments, or the defaults
 */
export async function getEnvs() {
  const { envs } = await chrome.storage.sync.get('envs');
  return Array.isArray(envs) && envs.length ? envs : DEFAULT_ENVS;
}

/**
 * Parses one environment per line, `NAME = branch`.
 * @param {string} text the options text
 * @returns {{envs: {name: string, branch: string}[], invalid: string[]}}
 *   the valid rows and the rejected lines
 */
export function parseEnvs(text) {
  const envs = [];
  const invalid = [];
  text.split('\n').map((line) => line.trim()).filter(Boolean).forEach((line) => {
    const [name = '', branch = ''] = line.split('=').map((part) => part.trim());
    const clean = branch.toLowerCase();
    if (name && BRANCH.test(clean)) envs.push({ name, branch: clean });
    else invalid.push(line);
  });
  return { envs, invalid };
}

export const formatEnvs = (envs) => envs.map(({ name, branch }) => `${name} = ${branch}`).join('\n');

/* ---- source site → EDS page (toolbar popup) -------------------------- */

const NAME = '[a-z0-9]+(?:-[a-z0-9]+)*';
const SITE_LINE = new RegExp(`^([a-z0-9.-]+(?::\\d+)?)(/[^\\s=]*)?\\s*=\\s*(${NAME})--(${NAME})$`, 'i');
const EDS_HOST = new RegExp(`^(${NAME})--(${NAME})--(${NAME})\\.aem\\.(page|live)$`, 'i');
const bareHost = (host) => host.toLowerCase().replace(/^www\./, '');

/**
 * @returns {Promise<{host: string, prefix: string, repo: string, org: string}[]>} the saved sites
 */
export async function getSites() {
  const { sites } = await chrome.storage.sync.get('sites');
  return Array.isArray(sites) ? sites : [];
}

/**
 * Parses one site per line, `source-host[/path-prefix] = repo--org`.
 * @param {string} text the options text
 * @returns {{sites: object[], invalid: string[]}} the valid sites and the rejected lines
 */
export function parseSites(text) {
  const sites = [];
  const invalid = [];
  text.split('\n').map((line) => line.trim()).filter(Boolean).forEach((line) => {
    const m = line.match(SITE_LINE);
    if (!m) { invalid.push(line); return; }
    const [, host, prefix = '', repo, org] = m;
    sites.push({
      host: host.toLowerCase(),
      prefix: prefix.replace(/\/+$/, ''),
      repo: repo.toLowerCase(),
      org: org.toLowerCase(),
    });
  });
  return { sites, invalid };
}

export const formatSites = (sites) => sites
  .map(({
    host, prefix, repo, org,
  }) => `${host}${prefix} = ${repo}--${org}`).join('\n');

// same as WebImporter.FileUtils.sanitizeFilename / sanitizePath (helix-importer),
// so the URL matches the page the importer created
function sanitizeSegment(name) {
  let decoded = name;
  try { decoded = decodeURIComponent(name); } catch { /* keep as is */ }
  return decoded.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function sanitizePath(path) {
  const extension = path.split('.').pop();
  const pathname = extension !== path ? path.substring(0, path.lastIndexOf('.')) : path;
  const clean = pathname.split('/').filter(Boolean).map((p) => `/${sanitizeSegment(p)}`).join('');
  return extension !== path ? `${clean}.${extension}` : clean;
}

/**
 * The EDS page for a URL: a page of a configured source site (path mapped like
 * the importer does), or an EDS page itself (any branch).
 * @param {string} href the tab URL
 * @param {object[]} sites the configured sites
 * @returns {{repo: string, org: string, path: string, branch: string|null, tld: string|null}|null}
 *   the page (branch and tld only for an EDS page), or null
 */
export function edsPage(href, sites) {
  let url;
  try { url = new URL(href); } catch { return null; }
  if (!/^https?:$/.test(url.protocol)) return null;

  const eds = url.hostname.match(EDS_HOST);
  if (eds) {
    const [, branch, repo, org, tld] = eds.map((part) => part.toLowerCase());
    return {
      repo, org, path: url.pathname, branch, tld,
    };
  }

  const host = bareHost(url.host);
  const site = sites
    .filter((s) => bareHost(s.host) === host
      && (!s.prefix || url.pathname === s.prefix || url.pathname.startsWith(`${s.prefix}/`)))
    .sort((a, b) => b.prefix.length - a.prefix.length)[0];
  if (!site) return null;

  // the importer's rule: drop a trailing slash and .htm(l), sanitize, '' = /index
  const raw = url.pathname.slice(site.prefix.length).replace(/\/$/, '').replace(/\.html?$/, '');
  const path = sanitizePath(raw === '' ? '/index' : raw).replace(/(^|\/)index$/, '$1') || '/';
  return {
    repo: site.repo, org: site.org, path, branch: null, tld: null,
  };
}

export const edsUrl = ({ repo, org, path }, branch, tld) => (
  `https://${branch}--${repo}--${org}.aem.${tld}${path}`
);

/**
 * The same page on another branch: only the host's branch prefix changes.
 * @param {string} url the main--… URL DA opened
 * @param {string} branch the target branch
 * @returns {string} the URL
 */
export const envUrl = (url, branch) => url.replace(/^https:\/\/main--/i, `https://${branch}--`);

/**
 * Find the original site URL for an EDS page.
 * @param {{repo: string, org: string, path: string}} page the EDS page
 * @param {object[]} sites the configured sites
 * @returns {string|null} the original site URL, or null if no site is configured
 */
export function originalSiteUrl(page, sites) {
  // Find a site that matches this repo--org
  const site = sites.find((s) => s.repo === page.repo && s.org === page.org);
  if (!site) return null;

  // Reconstruct the original URL with .html extension
  let path = page.path;

  // Add .html extension if the path doesn't already have an extension
  // and it's not the root path
  if (path !== '/' && !path.match(/\.[a-z0-9]+$/i)) {
    path = `${path}.html`;
  }

  // For root path, add /home.html or /index.html as a common pattern
  if (path === '/') {
    path = '/index.html';
  }

  return `https://${site.host}${site.prefix}${path}`;
}

/* global chrome */
/*
 * When DA (da.live) opens a page on main--{repo}--{org}.aem.page|live after
 * Preview / Publish, send that tab to the chooser instead. Navigations started
 * anywhere else (the chooser itself, links, the address bar) are left alone.
 */
import { DA_ORIGINS, DA_TARGET } from './envs.js';

const CHOOSER = chrome.runtime.getURL('chooser.html');

chrome.webRequest.onBeforeRequest.addListener(
  ({ tabId, url, initiator }) => {
    if (tabId < 0 || !DA_ORIGINS.includes(initiator) || !DA_TARGET.test(url)) return;
    chrome.tabs.update(tabId, { url: `${CHOOSER}?url=${encodeURIComponent(url)}` });
  },
  { urls: ['https://*.aem.page/*', 'https://*.aem.live/*'], types: ['main_frame'] },
);

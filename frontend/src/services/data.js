/**
 * NEXUS ESPORTS — Competitions data layer
 *
 * The data module (`src/vendor/competitions-data.js`, ~1,500 lines of
 * localStorage-backed state used by 38 pages) is executed as-is so its behaviour —
 * seeds, localStorage keys, merging and sync — is exact. It assigns
 * `window.NexusData` during evaluation, which this module re-exports.
 *
 * `window.NexusAPI` is published here so the backend-sync paths inside that module
 * keep working.
 */
import NexusAPI from './api.js';

// Executes the data layer; it sets window.NexusData itself.
import '../vendor/competitions-data.js';

if (typeof window !== 'undefined' && !window.NexusAPI) {
  window.NexusAPI = NexusAPI;
}

const NexusData = (typeof window !== 'undefined' && window.NexusData) ? window.NexusData : {};

export default NexusData;



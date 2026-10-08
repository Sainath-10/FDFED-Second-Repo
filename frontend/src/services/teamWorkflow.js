/**
 * NEXUS ESPORTS — Team workflow service
 *
 * The team workflow (`src/vendor/team-workflow.js`, ~1,200 lines of
 * localStorage-backed team operations used by the team + competition pages) is
 * loaded as-is so its behaviour is preserved exactly. It is a side-effect-free IIFE
 * that assigns `window.NexusTeamWorkflow`; this module re-exports it.
 *
 * Same rationale as src/services/data.js — the full conversion is deferred until it
 * can be exercised at runtime.
 */
import NexusAPI from './api.js';
import './data.js'; // ensures window.NexusData + window.NexusAPI exist first
import '../vendor/team-workflow.js';

if (typeof window !== 'undefined' && !window.NexusAPI) {
  window.NexusAPI = NexusAPI;
}

const NexusTeamWorkflow = (typeof window !== 'undefined' && window.NexusTeamWorkflow)
  ? window.NexusTeamWorkflow
  : null;

export default NexusTeamWorkflow;



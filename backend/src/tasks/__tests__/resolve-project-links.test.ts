import { describe, expect, it } from 'vitest';
import { chooseProjectLinkCandidate } from '../resolve-project-links.js';

describe('chooseProjectLinkCandidate', () => {
  const domainMatch = { projectId: 'project-domain', clientId: 'client-1' };
  const aliasMatch = { projectId: 'project-alias', clientId: 'client-2' };
  const clientInboxMatch = { projectId: 'project-inbox', clientId: 'client-3' };
  const globalInboxMatch = { projectId: 'project-global', clientId: 'client-global' };

  it('enforces precedence: domain -> alias -> client inbox -> global', () => {
    const resolved = chooseProjectLinkCandidate({
      domainMatch,
      aliasMatch,
      clientInboxMatch,
      globalInboxMatch,
    });

    expect(resolved.candidate?.projectId).toBe('project-domain');
    expect(resolved.source).toBe('domain_match');
  });

  it('uses title alias when no domain match exists', () => {
    const resolved = chooseProjectLinkCandidate({
      domainMatch: null,
      aliasMatch,
      clientInboxMatch,
      globalInboxMatch,
    });

    expect(resolved.candidate?.projectId).toBe('project-alias');
    expect(resolved.source).toBe('title_alias');
  });

  it('falls back to client inbox for known client routing', () => {
    const resolved = chooseProjectLinkCandidate({
      domainMatch: null,
      aliasMatch: null,
      clientInboxMatch,
      globalInboxMatch,
    });

    expect(resolved.candidate?.projectId).toBe('project-inbox');
    expect(resolved.source).toBe('client_inbox_fallback');
  });

  it('falls back to global triage for unknown client routing', () => {
    const resolved = chooseProjectLinkCandidate({
      domainMatch: null,
      aliasMatch: null,
      clientInboxMatch: null,
      globalInboxMatch,
    });

    expect(resolved.candidate?.projectId).toBe('project-global');
    expect(resolved.source).toBe('global_triage_fallback');
  });
});

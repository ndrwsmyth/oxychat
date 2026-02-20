import { defineTask } from '@ndrwsmyth/sediment';
import {
  extractDomainRoot,
  extractEmailDomain,
  normalizeTitle,
} from '../lib/transcript-normalization.js';
import { getSupabase } from '../lib/supabase.js';

export type TranscriptLinkSource =
  | 'domain_match'
  | 'title_alias'
  | 'client_inbox_fallback'
  | 'global_triage_fallback';

export interface ResolveProjectLinksInput {
  transcriptId: string;
}

export interface ResolveProjectLinksResult {
  transcriptId: string;
  visibility: 'private' | 'non_private' | 'unclassified';
  projectId: string | null;
  linkSource: TranscriptLinkSource | null;
}

export interface ProjectCandidate {
  projectId: string;
  clientId: string;
}

export function chooseProjectLinkCandidate(input: {
  domainMatch: ProjectCandidate | null;
  aliasMatch: ProjectCandidate | null;
  clientInboxMatch: ProjectCandidate | null;
  globalInboxMatch: ProjectCandidate | null;
}): { candidate: ProjectCandidate | null; source: TranscriptLinkSource | null } {
  if (input.domainMatch) {
    return { candidate: input.domainMatch, source: 'domain_match' };
  }
  if (input.aliasMatch) {
    return { candidate: input.aliasMatch, source: 'title_alias' };
  }
  if (input.clientInboxMatch) {
    return { candidate: input.clientInboxMatch, source: 'client_inbox_fallback' };
  }
  if (input.globalInboxMatch) {
    return { candidate: input.globalInboxMatch, source: 'global_triage_fallback' };
  }
  return { candidate: null, source: null };
}

async function resolveProjectByDomain(domains: string[]): Promise<ProjectCandidate | null> {
  if (domains.length === 0) return null;

  const supabase = getSupabase();
  const { data: domainRows, error: domainError } = await supabase
    .from('project_domains')
    .select('project_id')
    .in('normalized_domain', domains)
    .order('project_id', { ascending: true })
    .limit(1);

  if (domainError) {
    throw new Error(`Failed to resolve domain match: ${domainError.message}`);
  }

  const projectId = domainRows?.[0]?.project_id;
  if (!projectId) {
    return null;
  }

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, client_id')
    .eq('id', projectId)
    .maybeSingle();

  if (projectError || !project) {
    throw new Error(`Failed to load project for domain match: ${projectError?.message ?? 'not found'}`);
  }

  return {
    projectId: project.id,
    clientId: project.client_id,
  };
}

async function resolveProjectByTitleAlias(normalizedTitle: string): Promise<ProjectCandidate | null> {
  const supabase = getSupabase();
  const { data: aliasMatch, error: aliasError } = await supabase
    .from('project_aliases')
    .select('project_id')
    .eq('normalized_alias', normalizedTitle)
    .maybeSingle();

  if (aliasError) {
    throw new Error(`Failed to resolve title alias: ${aliasError.message}`);
  }

  if (!aliasMatch?.project_id) {
    return null;
  }

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, client_id')
    .eq('id', aliasMatch.project_id)
    .maybeSingle();

  if (projectError || !project) {
    throw new Error(`Failed to load project for alias match: ${projectError?.message ?? 'not found'}`);
  }

  return {
    projectId: project.id,
    clientId: project.client_id,
  };
}

async function resolveKnownClientInbox(domainRoots: string[]): Promise<ProjectCandidate | null> {
  if (domainRoots.length === 0) return null;

  const supabase = getSupabase();
  let clientId: string | null = null;

  for (const root of domainRoots) {
    const { data: exactMatch, error: exactError } = await supabase
      .from('clients')
      .select('id')
      .eq('normalized_name', root)
      .limit(1);

    if (exactError) {
      throw new Error(`Failed to resolve exact client match: ${exactError.message}`);
    }

    if (exactMatch?.[0]?.id) {
      clientId = exactMatch[0].id;
      break;
    }

    const { data: prefixMatch, error: prefixError } = await supabase
      .from('clients')
      .select('id, name')
      .ilike('normalized_name', `${root}%`)
      .order('name', { ascending: true })
      .limit(1);

    if (prefixError) {
      throw new Error(`Failed to resolve prefix client match: ${prefixError.message}`);
    }

    if (prefixMatch?.[0]?.id) {
      clientId = prefixMatch[0].id;
      break;
    }
  }

  if (!clientId) {
    return null;
  }

  const { data: inboxProject, error: inboxError } = await supabase
    .from('projects')
    .select('id, client_id, name')
    .eq('client_id', clientId)
    .eq('is_inbox', true)
    .order('name', { ascending: true })
    .limit(1);

  if (inboxError) {
    throw new Error(`Failed to resolve client inbox: ${inboxError.message}`);
  }

  if (!inboxProject?.[0]) {
    return null;
  }

  return {
    projectId: inboxProject[0].id,
    clientId: inboxProject[0].client_id,
  };
}

async function resolveGlobalTriageInbox(): Promise<ProjectCandidate | null> {
  const supabase = getSupabase();
  const { data: project, error } = await supabase
    .from('projects')
    .select('id, client_id, name')
    .eq('scope', 'global')
    .eq('is_inbox', true)
    .order('name', { ascending: true })
    .limit(1);

  if (error) {
    throw new Error(`Failed to resolve global triage inbox: ${error.message}`);
  }

  if (!project?.[0]) {
    return null;
  }

  return {
    projectId: project[0].id,
    clientId: project[0].client_id,
  };
}

export const resolveProjectLinksTask = defineTask<ResolveProjectLinksInput, ResolveProjectLinksResult>(
  'resolve_project_links',
  async function* (input) {
    const supabase = getSupabase();

    const { data: classification, error: classificationError } = await supabase
      .from('transcript_classification')
      .select('visibility')
      .eq('transcript_id', input.transcriptId)
      .maybeSingle();

    if (classificationError) {
      throw new Error(`Failed to load classification: ${classificationError.message}`);
    }

    if (!classification?.visibility) {
      await supabase
        .from('transcript_project_links')
        .delete()
        .eq('transcript_id', input.transcriptId);

      yield {
        transcriptId: input.transcriptId,
        visibility: 'unclassified',
        projectId: null,
        linkSource: null,
      };
      return;
    }

    if (classification.visibility === 'private') {
      await supabase
        .from('transcript_project_links')
        .delete()
        .eq('transcript_id', input.transcriptId);

      yield {
        transcriptId: input.transcriptId,
        visibility: 'private',
        projectId: null,
        linkSource: null,
      };
      return;
    }

    const { data: transcript, error: transcriptError } = await supabase
      .from('transcripts')
      .select('title')
      .eq('id', input.transcriptId)
      .maybeSingle();

    if (transcriptError || !transcript) {
      throw new Error(`Failed to load transcript: ${transcriptError?.message ?? 'not found'}`);
    }

    const { data: attendees, error: attendeeError } = await supabase
      .from('transcript_attendees')
      .select('email')
      .eq('transcript_id', input.transcriptId);

    if (attendeeError) {
      throw new Error(`Failed to load transcript attendees: ${attendeeError.message}`);
    }

    const attendeeEmails = (attendees ?? [])
      .map((row) => row.email)
      .filter((email): email is string => typeof email === 'string' && email.trim().length > 0);
    const attendeeDomains = [
      ...new Set(
        attendeeEmails
          .map((email) => extractEmailDomain(email))
          .filter((domain): domain is string => typeof domain === 'string' && domain.length > 0)
      ),
    ];
    const attendeeDomainRoots = [...new Set(attendeeDomains.map((domain) => extractDomainRoot(domain)))];

    const normalizedTitle = normalizeTitle(transcript.title);
    const domainMatch = await resolveProjectByDomain(attendeeDomains);
    const aliasMatch = domainMatch ? null : await resolveProjectByTitleAlias(normalizedTitle);
    const clientInboxMatch =
      domainMatch || aliasMatch ? null : await resolveKnownClientInbox(attendeeDomainRoots);
    const globalInboxMatch =
      domainMatch || aliasMatch || clientInboxMatch ? null : await resolveGlobalTriageInbox();

    const { candidate, source } = chooseProjectLinkCandidate({
      domainMatch,
      aliasMatch,
      clientInboxMatch,
      globalInboxMatch,
    });

    if (!candidate) {
      await supabase
        .from('transcript_project_links')
        .delete()
        .eq('transcript_id', input.transcriptId);

      yield {
        transcriptId: input.transcriptId,
        visibility: 'non_private',
        projectId: null,
        linkSource: null,
      };
      return;
    }

    const { data: link, error: linkError } = await supabase
      .from('transcript_project_links')
      .upsert(
        {
          transcript_id: input.transcriptId,
          project_id: candidate.projectId,
          link_source: source,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'transcript_id' }
      )
      .select('project_id, link_source')
      .single();

    if (linkError) {
      throw new Error(`Failed to persist transcript project link: ${linkError.message}`);
    }

    yield {
      transcriptId: input.transcriptId,
      visibility: 'non_private',
      projectId: link.project_id,
      linkSource: link.link_source as TranscriptLinkSource,
    };
  }
);

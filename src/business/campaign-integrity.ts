import { normaliseHttpUrl } from '../lib/qr';
import type { DynamicCampaign } from './store';

export type CampaignDraft = Pick<DynamicCampaign, 'name' | 'destination' | 'slug' | 'color'>;

export function campaignDraftMatchesSaved(initial: DynamicCampaign | undefined, draft: CampaignDraft): boolean {
  return Boolean(initial
    && initial.name === draft.name.trim()
    && initial.destination === normaliseHttpUrl(draft.destination)
    && initial.slug === draft.slug
    && initial.color === draft.color);
}

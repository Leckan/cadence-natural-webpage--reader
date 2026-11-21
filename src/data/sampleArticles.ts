import { SampleArticle } from '../types/reader';

export const SAMPLE_ARTICLES: SampleArticle[] = [
  {
    id: 'architecture',
    tabTitle: 'The Architecture of Quiet',
    url: 'https://foliojournal.org/design/architecture-of-quiet',
    publication: 'Folio Architecture Review',
    category: 'Acoustic Design',
    title: 'The Architecture of Quiet: How Timber Shapes the Way We Listen',
    subtitle:
      'Why modern concert halls and reading rooms are returning to grooved oak, curved ceilings, and subtle spatial diffusion to make human speech effortless to follow.',
    author: 'Clara Lindqvist',
    date: 'November 14, 2026',
    imageUrl: '/src/assets/images/article_architecture_acoustic_1795219945428.jpg',
    imageAlt:
      'Interior view of a sunlit Nordic timber concert hall with curved pale oak acoustic slats and natural daylight.',
    imageCaption:
      'Curved oak slats diffuse mid-frequency speech reflections while preserving natural warmth across every row.',
    paragraphs: [
      {
        type: 'body',
        text: 'Step inside a thoughtfully proportioned timber hall before an audience arrives and you immediately notice a rare physical sensation. The room does not feel dead or muffled, yet stray footsteps fade cleanly without bouncing back as harsh echoes. Good acoustic architecture never calls attention to itself; it simply clears away friction so the human voice carries with effortless clarity.',
      },
      {
        type: 'body',
        text: 'For decades, open glass atriums and polished concrete slabs dominated public libraries and civic spaces. Those materials photograph beautifully, yet they scatter overlapping reflections across every conversation. Researchers studying listening fatigue discovered that when background reverberation exceeds a single second, readers and listeners expend measurable extra cognitive effort just to separate consecutive syllables.',
      },
      {
        type: 'heading',
        text: 'Designing for Cadence and Clarity',
      },
      {
        type: 'body',
        text: 'Acoustic engineers now collaborate with woodworkers from the earliest schematic drawings. Rather than tacking foam panels onto finished walls, they mill narrow vertical ribs into pale ash and European oak at varying depths. Low frequencies pass gently behind the timber into mineral wool, while delicate vocal consonants bounce softly toward the listeners.',
      },
      {
        type: 'quote',
        text: 'A room tuned for the spoken word behaves like a well-typeset page. Margins, spacing, and rhythm guide your attention forward without tiring your eyes or your ears.',
      },
      {
        type: 'body',
        text: 'The same principle applies to how we read long essays on luminous screens. Pairing calm typography with spoken narration lets readers shift between listening and scanning at their own pace. When the eye can track each highlighted phrase in rhythm with a natural voice, dense technical arguments become noticeably easier to absorb during a busy afternoon.',
      },
    ],
  },
  {
    id: 'ocean',
    tabTitle: 'Listening to the Deep Ocean',
    url: 'https://oceanicfield.org/essays/listening-to-the-deep-ocean',
    publication: 'Oceanic Field Notes',
    category: 'Marine Acoustics',
    title: 'Listening to the Deep Ocean After Sunset',
    subtitle:
      'Anchored hydrophones two miles beneath the Pacific are revealing how sound travels across entire ocean basins—and how marine life navigates in perpetual twilight.',
    author: 'Dr. Kenji Takahashi',
    date: 'October 29, 2026',
    imageUrl: '/src/assets/images/article_ocean_bioluminescence_1795219946025.jpg',
    imageAlt:
      'Calm midnight-blue ocean surface illuminated from below by soft natural pale cyan bioluminescent ripples.',
    imageCaption:
      'Bioluminescent plankton trace subtle surface currents above deep acoustic monitoring stations in the Monterey Canyon.',
    paragraphs: [
      {
        type: 'body',
        text: 'Sunlight fades rapidly beneath the ocean surface, leaving the deep water in cool indigo twilight within two hundred meters. Sound, however, behaves in the opposite way. Because seawater is nearly incompressible, acoustic waves move more than four times faster underwater than they do through dry air, turning the dark interior of the sea into a vast acoustic landscape.',
      },
      {
        type: 'body',
        text: 'At roughly one thousand meters below sea level, changes in water temperature and hydrostatic pressure create a remarkable natural waveguide known as the deep sound channel. Signals emitted inside this layer bend continuously back toward its center instead of dissipating against the seafloor or the choppy surface above. Under calm winter conditions, a low-frequency call can remain audible thousands of kilometers away.',
      },
      {
        type: 'heading',
        text: 'A Chorus Beneath the Waves',
      },
      {
        type: 'body',
        text: 'When oceanographers first deployed continuous cabled observatories along the continental shelf, they expected long stretches of silence punctuated by passing whales. Instead, the recordings revealed a lively nocturnal rhythm: snapping shrimp crackling across rocky reefs, schools of fish pulsing in low choral waves, and distant storms rumbling across the horizon like slow kettle drums.',
      },
      {
        type: 'body',
        text: 'Today, marine biologists listen alongside automated classifiers to track seasonal migrations without disturbing a single animal. By dimming commercial shipping lanes near sensitive sanctuaries, coastal ports have already reduced underwater noise by nearly half—giving the ocean its quiet voice back.',
      },
    ],
  },
];

export const DEFAULT_CUSTOM_TEXT = `Welcome to the custom webpage test mode. Paste any article, study notes, documentation, or email right here to hear how Cadence reads your own text aloud.

You can click any sentence to start reading from that exact point, or select a specific phrase to listen to just your selection. Try adjusting the playback speed slider from 0.5x up to 2.5x while audio is playing to experience smooth, instant pacing changes.

Switch between Word + Sentence, Sentence Only, or Word Only highlight modes in the extension popup to find the visual tracking style that helps you focus best.`;

/**
 * First-launch guided tour for Neon Relic.
 * Uses Foundry VTT's Tour system to walk new users through the system.
 */

export function registerTours() {
  // Register the welcome tour
  game.tours.register('neon-relic', 'welcome', {
    title: 'NEONRELIC.Tour.WelcomeTitle',
    description: 'NEONRELIC.Tour.WelcomeDesc',
    canBeResumed: false,
    display: true,
    steps: [
      {
        id: 'welcome',
        title: 'NEONRELIC.Tour.Step1Title',
        content: 'NEONRELIC.Tour.Step1Content',
        selector: '#logo',
      },
      {
        id: 'actors',
        title: 'NEONRELIC.Tour.Step2Title',
        content: 'NEONRELIC.Tour.Step2Content',
        selector: '[data-tab="actors"]',
      },
      {
        id: 'items',
        title: 'NEONRELIC.Tour.Step3Title',
        content: 'NEONRELIC.Tour.Step3Content',
        selector: '[data-tab="items"]',
      },
      {
        id: 'compendium',
        title: 'NEONRELIC.Tour.Step4Title',
        content: 'NEONRELIC.Tour.Step4Content',
        selector: '[data-tab="compendium"]',
      },
      {
        id: 'combat',
        title: 'NEONRELIC.Tour.Step5Title',
        content: 'NEONRELIC.Tour.Step5Content',
        selector: '#combat',
      },
      {
        id: 'done',
        title: 'NEONRELIC.Tour.Step6Title',
        content: 'NEONRELIC.Tour.Step6Content',
      },
    ],
  });
}

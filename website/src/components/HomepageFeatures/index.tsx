import styles from './styles.module.css';
import Heading from '@theme/Heading';
import type { ReactNode } from 'react';

type FeatureItem = {
  title: string;
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'AI-Powered Generation',
    description: (
      <>
        Describe UI components or scripts in plain English. The AI agent writes React components, JavaScript, CSS, and
        background workers for you.
      </>
    ),
  },
  {
    title: 'Live Injection',
    description: (
      <>
        Components are injected directly into any webpage in real time. URL pattern matching auto-injects on every visit
        to matching pages.
      </>
    ),
  },
  {
    title: 'Autonomous Agent',
    description: (
      <>
        A LangGraph-based agent that can plan, generate, edit, deploy, inspect, and verify artifacts without manual
        intervention.
      </>
    ),
  },
  {
    title: 'Multi-Provider AI',
    description: (
      <>
        Supports OpenAI, Anthropic, and Google Gemini. Configure your preferred provider and model in the extension
        settings.
      </>
    ),
  },
  {
    title: 'Background Workers',
    description: (
      <>
        Generate persistent background workers that run in Chrome&apos;s offscreen document with access to extension
        storage and triggers.
      </>
    ),
  },
  {
    title: 'Version History',
    description: (
      <>
        All artifacts maintain version history with rollback support. Per-component data persists across sessions via
        IndexedDB.
      </>
    ),
  },
];

const Feature = ({ title, description }: FeatureItem) => (
  <div className="col col--4">
    <div className="text--center padding-horiz--md padding-vert--md">
      <Heading as="h3">{title}</Heading>
      <p>{description}</p>
    </div>
  </div>
);

const HomepageFeatures = (): ReactNode => (
  <section className={styles.features}>
    <div className="container">
      <div className="row">
        {FeatureList.map((props, idx) => (
          <Feature key={idx} {...props} />
        ))}
      </div>
    </div>
  </section>
);

export default HomepageFeatures;

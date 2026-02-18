# [1.4.0](https://github.com/nirberko/conjure/compare/v1.3.0...v1.4.0) (2026-02-18)


### Bug Fixes

* address PR review comments for ESM dependencies ([ae6f081](https://github.com/nirberko/conjure/commit/ae6f08162a920ac4f4ee98583cb9bf60a76f53d8))
* **e2e:** replace long-running evaluate with exposeFunction bridge to fix flaky test ([fb95fc2](https://github.com/nirberko/conjure/commit/fb95fc279174a947d5c4c6471438cb970dd7f1f9))


### Features

* **agent,content:** CSP-compatible ESM deps, auto-resolve imports, show deps in UI ([53e1bb9](https://github.com/nirberko/conjure/commit/53e1bb9dc35274d9fadffb8bc5272664cc707e52))
* **agent:** add add_dependency tool for resolving npm packages from esm.sh ([b9f5d42](https://github.com/nirberko/conjure/commit/b9f5d42cdda0fdc05bff77b885efe8883131ae49))
* **agent:** update system prompt with dependency and import map usage rules ([8bce600](https://github.com/nirberko/conjure/commit/8bce60008395a1666c1e496030a06e8ff9076f8b))
* **content,agent:** add ESM module execution path and dependency support ([99b3153](https://github.com/nirberko/conjure/commit/99b31539511c5495620d62f4eb4100ff708abc4e))
* **content:** add import map builder for ESM CDN dependencies ([f5da17c](https://github.com/nirberko/conjure/commit/f5da17c779881461d2e2eaccc4e5f497eb361a36))
* **content:** use batch injection on page load for import map ordering ([ee5d7da](https://github.com/nirberko/conjure/commit/ee5d7dab7a347350fdbe7de7dd9e07ee3a6d51eb))
* **types:** add dependencies field to Artifact interface ([806ee88](https://github.com/nirberko/conjure/commit/806ee88956a46a2228657303b3c822b4bebec805))

# [1.3.0](https://github.com/nirberko/conjure/compare/v1.2.0...v1.3.0) (2026-02-17)


### Features

* CSP-compatible ESM dependency loading with auto-resolve and UI badges ([#43](https://github.com/nirberko/conjure/issues/43)) ([759792c](https://github.com/nirberko/conjure/commit/759792cd739e8d7177329930b011c3fca970db88))

# [1.2.0](https://github.com/nirberko/conjure/compare/v1.1.0...v1.2.0) (2026-02-17)


### Bug Fixes

* **ci:** disable husky hooks during semantic-release ([0f7d390](https://github.com/nirberko/conjure/commit/0f7d390da11482d99416c5ee17c7030d7ad42a9c))
* **ci:** remove explicit pnpm version to resolve conflict with packageManager field ([29415ca](https://github.com/nirberko/conjure/commit/29415caeb9e9326cc74457d3b40b80ccfe596801))
* **website:** remove "type": "module" to fix Docusaurus SSR build ([4458375](https://github.com/nirberko/conjure/commit/4458375e7d723f536b29c376d50a4016188efc5b))


### Features

* add Docusaurus documentation site with GitHub Pages deployment ([#41](https://github.com/nirberko/conjure/issues/41)) ([df4793c](https://github.com/nirberko/conjure/commit/df4793c6c20b41e535d4774fee7465e1ad22aa85))
* enforce mandatory inspect_page_theme for visible UI artifacts ([#40](https://github.com/nirberko/conjure/issues/40)) ([097bb1f](https://github.com/nirberko/conjure/commit/097bb1fc8acbad3f801915269c75768bb8e43d17))

# [1.1.0](https://github.com/nirberko/conjure/compare/v1.0.0...v1.1.0) (2026-02-15)


### Features

* **agent:** add inspect_page_theme tool to analyze site design system and update prompts to emphasize styling alignment ([a37e5c0](https://github.com/nirberko/conjure/commit/a37e5c0e441fd8260fe6f2df958bc344fb3c8465))

# 1.0.0 (2026-02-15)


### Bug Fixes

* linting ([383f823](https://github.com/nirberko/conjure/commit/383f8231888536ebf06042cfe433e7ce2ca5da08))


### Features

* **agent:** add needsWorker property to think tool and schema for tasks requiring background workers ([9974fc9](https://github.com/nirberko/conjure/commit/9974fc9fd1a4008bc57cdb8ebdfdd1b2884c4c08))
* **agent:** extend pick_element tool to include XPath support for more precise element targeting ([2248fcf](https://github.com/nirberko/conjure/commit/2248fcf28a0c16c911b09ad77f9e8639f3195618))

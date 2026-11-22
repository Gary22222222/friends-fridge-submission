# Friend's Fridge

Repository: https://github.com/Gary22222222/friends-fridge-submission

Live app: https://friends-fridge-jianghui.app.space

Start there for installation, source review and tests.
DeepSpace is the sole deployment authority; this branch contains an exact
application snapshot of the cloud source commit recorded in
[`release/deepspace.json`](release/deepspace.json).

## Verify the submission

Python 3.9+ and Git are sufficient for source verification; no app credentials
are required. From this repository root:

```sh
python scripts/verify-deepspace-source.py
python scripts/verify-deepspace-source.py --live
```

The first command detects missing, extra or changed app files. The second also
checks the platform's public release stamp and the app's database/lookup health.
The manifest is outside the app directory so its release metadata does not
change the source bytes being verified. Production results are in
[`release/evidence/verification.json`](release/evidence/verification.json).
The subsequent repository-link update is recorded separately in
[`release/evidence/repository-migration.json`](release/evidence/repository-migration.json);
the earlier functional test results retain their original release identifiers.

## Build and test

Use the Node/npm engine versions in `deepspace-app/package.json`; this release
was verified with Node 22 and npm 11.6+. Then:

```sh
cd deepspace-app
npm ci
npm run validate
npm run build
```

Local development and native multi-account browser tests require an authorized
DeepSpace CLI session. Real provider tests are opt-in and consume bounded
owner credits. Never commit CLI credentials, `.dev.vars` or uploaded photos.

## What the app does

Private inventories, fixed-size scrollable fridge, image-only stock view,
friend requests and messages, recipe discovery/sharing, ingredient handoffs,
reviewable photo suggestions and public-price meal planning. Empty stock is
gray but remains editable. Lookup quotas are server-enforced, interrupted jobs
resume without creating another paid query, and expired prices prompt an
explicit refresh.

The price planner uses Apify and arithmetic, not an LLM. Photo suggestions use
native Anthropic. Online catalogue prices exclude tax, shipping and delivery
eligibility; nearby store listings do not supply local checkout prices.

- [Submission note](deepspace-app/SUBMISSION.md)
- [Current acceptance](deepspace-app/docs/upgrade-acceptance.md)
- [Source, quota, resume and gray-stock behavior](deepspace-app/docs/submission-readiness.md)

The applicant's personal verification section remains for their actual
observations. Automated agent checks are recorded separately. Deployment is
performed from the authoritative cloud checkout; the GitHub snapshot is not
a second deployment trunk.
